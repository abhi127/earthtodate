import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './LayerInspector.module.css';

const MAX_REQUESTS = 12;
let nextLayerId = 1;
let nextRequestId = 1;
const layerIds = new WeakMap();

function getLayerId(layer) {
  if (!layerIds.has(layer)) layerIds.set(layer, nextLayerId++);
  return layerIds.get(layer);
}

function getLayerName(layer) {
  return layer.get('inspectorName') || layer.get('name') || 'Unnamed layer';
}

function getSourceType(source) {
  return source?.constructor?.name || 'Unknown source';
}

function getTileRange(source, projection) {
  try {
    const grid = source.getTileGridForProjection?.(projection);
    if (!grid) return null;
    return `z${grid.getMinZoom()}–${grid.getMaxZoom()}`;
  } catch {
    return null;
  }
}

function getRequestUrl(tile) {
  const key = tile.getKey();
  const coord = tile.getTileCoord();
  const suffix = `/${coord.join(',')}`;
  return key.endsWith(suffix) ? key.slice(0, -suffix.length) : key;
}

function layerFitsView(layer, zoom, resolution) {
  if (!layer.getVisible() || resolution == null) return false;
  return (
    resolution >= layer.getMinResolution() &&
    resolution < layer.getMaxResolution() &&
    zoom > layer.getMinZoom() &&
    zoom <= layer.getMaxZoom()
  );
}

function sortTopFirst(layers) {
  return layers
    .map((layer, index) => ({ layer, index, zIndex: layer.getZIndex() ?? 0 }))
    .sort((a, b) => (b.zIndex - a.zIndex) || (b.index - a.index))
    .map(({ layer }) => layer);
}

export default function LayerInspector({ map, open, onClose }) {
  const ol = window.ol;
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(() => map?.getView()?.getZoom() ?? 0);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [pick, setPick] = useState(null);
  const [requests, setRequests] = useState([]);

  const refresh = useCallback(() => {
    setZoom(map?.getView()?.getZoom() ?? 0);
    setRevision(value => value + 1);
  }, [map]);

  const inspectPixel = useCallback((event) => {
    if (!map || !ol) return;
    const pixel = map.getEventPixel(event.originalEvent);
    const coordinate = map.getEventCoordinate(event.originalEvent);
    const currentZoom = map.getView().getZoom() ?? 0;
    const hitLayers = new Set();

    // Vector hit detection is public API. Raster layers are checked from their
    // rendered pixel when the canvas is readable; cross-origin tile canvases can
    // reject getData(), in which case the visible layer stack remains useful.
    map.forEachFeatureAtPixel(pixel, (_feature, layer) => {
      if (layer) hitLayers.add(layer);
    });

    const topFirst = sortTopFirst(map.getAllLayers());
    let readableRasterHit = false;
    for (const layer of topFirst) {
      if (layer instanceof ol.layer.Vector || !layerFitsView(layer, currentZoom, map.getView().getResolution())) continue;
      try {
        const data = layer.getData(pixel);
        if (data && (data.length < 4 || data[3] > 0)) {
          hitLayers.add(layer);
          readableRasterHit = true;
        }
      } catch {
        // A cross-origin basemap taints its canvas; it cannot be pixel-read here.
      }
    }

    // If no raster could be read, still identify the topmost layer that OpenLayers
    // is currently rendering at the clicked coordinate.
    if (!readableRasterHit) {
      const topVisible = topFirst.find(layer => (
        !(layer instanceof ol.layer.Vector) &&
        layerFitsView(layer, currentZoom, map.getView().getResolution())
      ));
      if (topVisible) hitLayers.add(topVisible);
    }

    const lonLat = ol.proj.toLonLat(coordinate);
    setPick({
      ids: new Set([...hitLayers].map(getLayerId)),
      lon: lonLat[0],
      lat: lonLat[1],
      zoom: currentZoom,
    });
  }, [map, ol]);

  useEffect(() => {
    if (!map || !open) return undefined;

    setRequests([]);
    setPick(null);
    setSelectedLayerId(null);

    const attached = new Map();
    const unlisten = [];

    const detachLayer = (layer) => {
      const entry = attached.get(layer);
      if (!entry) return;
      entry.layerKeys.forEach(key => ol.unByKey(key));
      entry.sourceKeys.forEach(key => ol.unByKey(key));
      attached.delete(layer);
    };

    const attachLayer = (layer) => {
      if (attached.has(layer)) return;
      const layerKeys = [layer.on('change', refresh)];
      const source = layer.getSource();
      const sourceKeys = [];
      if (source?.on) {
        const onTileLoadStart = (event) => {
          const tile = event.tile;
          const coord = tile.getTileCoord();
          setRequests(previous => [
            {
              id: nextRequestId++,
              layerId: getLayerId(layer),
              layerName: getLayerName(layer),
              url: getRequestUrl(tile),
              coord,
              mapZoom: map.getView().getZoom() ?? 0,
              time: new Date().toLocaleTimeString(),
            },
            ...previous,
          ].slice(0, MAX_REQUESTS));
        };
        sourceKeys.push(source.on('tileloadstart', onTileLoadStart));
      }
      attached.set(layer, { source, sourceKeys, layerKeys });
    };

    const syncLayers = () => {
      const layers = map.getAllLayers();
      const current = new Set(layers);
      for (const layer of [...attached.keys()]) {
        if (!current.has(layer)) detachLayer(layer);
      }
      layers.forEach(attachLayer);
      refresh();
    };

    unlisten.push(map.on('addlayer', syncLayers));
    unlisten.push(map.on('removelayer', syncLayers));
    unlisten.push(map.on('moveend', refresh));
    unlisten.push(map.on('singleclick', inspectPixel));
    const resolutionKey = map.getView().on('change:resolution', refresh);
    syncLayers();

    return () => {
      unlisten.forEach(key => ol.unByKey(key));
      ol.unByKey(resolutionKey);
      for (const layer of [...attached.keys()]) detachLayer(layer);
    };
  }, [inspectPixel, map, ol, open, refresh]);

  const rows = useMemo(() => {
    if (!map || !ol) return [];
    const projection = map.getView().getProjection();
    const resolution = map.getView().getResolution();
    return sortTopFirst(map.getAllLayers()).map(layer => {
      const source = layer.getSource();
      const isVector = layer instanceof ol.layer.Vector;
      return {
        id: getLayerId(layer),
        layer,
        name: getLayerName(layer),
        category: layer.get('inspectorCategory') || (isVector ? 'Vector' : 'Raster'),
        type: isVector ? 'Vector' : 'Tile',
        sourceType: getSourceType(source),
        sourceUrl: source?.getUrls?.()?.[0] || '',
        tileRange: isVector ? null : getTileRange(source, projection),
        visible: layer.getVisible(),
        active: layerFitsView(layer, zoom, resolution),
        opacity: layer.getOpacity(),
        zIndex: layer.getZIndex() ?? 0,
      };
    });
  }, [map, ol, revision, zoom]);

  if (!open) return null;

  const pickedRows = pick ? rows.filter(row => pick.ids.has(row.id)) : [];
  const topPicked = pickedRows[0];

  return (
    <aside className={styles.panel} aria-label="Layer inspector">
      <div className={styles.header}>
        <div>
          <strong>Layer Inspector</strong>
          <span>{rows.length} layers · map z{zoom.toFixed(1)}</span>
        </div>
        <button type="button" onClick={onClose} title="Close layer inspector" aria-label="Close layer inspector">&times;</button>
      </div>

      <div className={styles.hint}>
        {pick
          ? `Clicked ${pick.lat.toFixed(4)}°, ${pick.lon.toFixed(4)}° at z${pick.zoom.toFixed(1)}`
          : 'Click the map to identify the top visible layer.'}
      </div>

      {topPicked && (
        <div className={styles.picked}>
          <span>Identified</span>
          <strong>{topPicked.name}</strong>
          <small>{topPicked.sourceType}{topPicked.tileRange ? ` · ${topPicked.tileRange}` : ''}</small>
        </div>
      )}

      <div className={styles.list}>
        {rows.map(row => (
          <div
            key={row.id}
            className={`${styles.row} ${pick?.ids.has(row.id) ? styles.rowHit : ''} ${!row.visible ? styles.rowHidden : ''}`}
          >
            <button
              type="button"
              className={styles.rowButton}
              onClick={() => setSelectedLayerId(selectedLayerId === row.id ? null : row.id)}
              aria-expanded={selectedLayerId === row.id}
            >
              <span className={styles.rowTop}>
                <span className={styles.status} data-active={row.active} title={row.active ? 'Rendering at current zoom' : 'Not rendering at current zoom'} />
                <strong>{row.name}</strong>
                <small>{row.category}</small>
              </span>
              <span className={styles.summary}>
                {row.type} · {row.sourceType}{row.tileRange ? ` · ${row.tileRange}` : ''} · z-index {row.zIndex}
              </span>
            </button>
            {selectedLayerId === row.id && (
              <div className={styles.details}>
                <span>Visible: {row.visible ? 'yes' : 'no'}</span>
                <span>Opacity: {Math.round(row.opacity * 100)}%</span>
                {row.sourceUrl && <code title={row.sourceUrl}>{row.sourceUrl}</code>}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className={styles.requests} open>
        <summary>Recent tile requests ({requests.length})</summary>
        {requests.length === 0 ? (
          <p>No tile requests since this inspector opened.</p>
        ) : (
          <div className={styles.requestList}>
            {requests.map(request => (
              <div key={request.id} className={styles.request}>
                <span className={styles.requestMeta}>
                  <strong>{request.layerName}</strong>
                  <small>{request.time} · map z{request.mapZoom.toFixed(1)} · tile z{request.coord[0]}</small>
                </span>
                <code title={request.url}>{request.url}</code>
              </div>
            ))}
          </div>
        )}
      </details>
    </aside>
  );
}
