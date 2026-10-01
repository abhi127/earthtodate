import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import MapOverlay from './MapOverlay';
import MeasureTool from './MeasureTool';
import MapControls from './MapControls';
import MapCompare from './MapCompare';
import LayerInspector from './LayerInspector';
import SatellitePanel from './SatellitePanel';
import SatelliteLegend from './SatelliteLegend';
import { loadIndiaCompositeLayer } from './indiaCompositeLayer';
import { SATELLITE_PANEL_START, SATELLITE_OPEN_RESOLUTION } from './satelliteDefaults';
import { SATELLITE_MIN_ZOOM, SATELLITE_MAX_ZOOM, isSatelliteAllowed, disposeRequestContext, resolveR5mViewtype } from './satelliteLayers';
import { resolveLayout } from './mapCount';
import {Tile} from 'ol/layer'
import { BASEMAP_IDS, BASEMAP_NAMES, createBasemapSource } from './basemaps';
import styles from './MapView.module.css';

import { createTileLoader, satelliteTileLoadFunction as satLoadFn } from './satelliteTileLoader';
import { downloadBlob, exportShapefile, featuresToExportContent } from './mapExport';
// Satellite products are unavailable below z12. The source tile grid alone does
// not enforce that floor: OpenLayers clamps the selected tile zoom to minZoom,
// so a z9.9 view would otherwise keep requesting z12 tiles.
const __satLoader = createTileLoader({ maxConcurrent: 6, stillDelay: 300 });
function satelliteTileLoadFunction(tile, src, requestContext) {
  return satLoadFn(tile, src, requestContext, __satLoader);
}

const MapView = forwardRef(function MapView({
  layoutMode,
  onLayoutChange,
  extraIds,
  onAddMap,
  onRemoveMap,
  onRemoveAllExtras,
  satellitePanelOpen,
  setSatellitePanelOpen,
  extraSatOpen,
  searchTick = 0,
  onBasemapChange,
  satCategory,
  onSatCategoryChange,
  archivalResults = [],
  hoveredResultId = null,
  pinnedResultIds = [],
  previewResultIds = [],
  onArchivalHover,
  onArchivalTogglePin,
  onArchivalTogglePreview,
}, ref) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const vectorSource = useRef(null);
  const basemapRefs = useRef({});
  const drawInteractionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [coords, setCoords] = useState('Lon: \u2014  Lat: \u2014');
  const [zoom, setZoom] = useState('Zoom: \u2014');
  const [resolution, setResolution] = useState('Res: \u2014');
  const [activeBasemap, setActiveBasemap] = useState('osm');
  // DOM node inside the MapControls stack that MeasureTool portals its button into
  const [measureSlot, setMeasureSlot] = useState(null);
  const [drawType, setDrawType] = useState(null);
  const [pillExportOpen, setPillExportOpen] = useState(false);
  const [layerInspectorOpen, setLayerInspectorOpen] = useState(false);
  const cancelMeasureRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const satelliteRequestContextRef = useRef(null);
  const satPanelInitialPanRef = useRef(false);
  // Extra maps (compare views) + per-map satellite state, keyed by stable id.
  // The main map always exists; extras come and go via extraIds.
  const extraMapsRef = useRef(new Map()); // id -> ol.Map
  const [extraMapsTick, setExtraMapsTick] = useState(0);
  const extraSatLayers = useRef(new Map());   // id -> Tile layer
  const extraSatContexts = useRef(new Map()); // id -> request context
  const extraR5mActual = useRef(new Map());   // id -> resolved r5m source
  const extraSatStates = useRef(new Map());   // id -> { viewtype, date, months }
  const extraSatHandlers = useRef(new Map()); // id -> stable onViewtypeChange
  const [satTick, setSatTick] = useState(0);  // re-render legends on sat change
  const mapCount = 1 + (extraIds?.length ?? 0);
  const hasExtras = mapCount > 1;

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !mapRef.current) return;

    vectorSource.current = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource.current });

    const layers = Object.fromEntries(BASEMAP_IDS.map((id) => [id, new ol.layer.Tile({ source: createBasemapSource(ol, id), visible: id === 'osm' })]));
    basemapRefs.current = layers;

    Object.entries(layers).forEach(([id, layer]) => {
      layer.set('inspectorName', `Basemap: ${BASEMAP_NAMES[id]}`);
      layer.set('inspectorCategory', 'Basemap');
      layer.set('basemapId', id);
    });
    vectorLayer.set('inspectorName', 'Drawn features');
    vectorLayer.set('inspectorCategory', 'Vector');

    const map = new ol.Map({
      target: mapRef.current,
      layers: [layers.osm, layers.satellite, layers.terrain, layers.light, layers.streets, layers.dark, layers.sentinel, vectorLayer],
      view: new ol.View({
        center: ol.proj.fromLonLat([78.9629, 20.5937]),
        zoom: 5,
      }),
      controls: new ol.Collection([
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.ScaleLine(),
      ]),
    });

    mapInstance.current = map;
    setMapReady(true);
    loadIndiaCompositeLayer(map);

    map.on('pointermove', (e) => {
      if (e.coordinate) {
        const ll = ol.proj.toLonLat(e.coordinate);
        setCoords(`Lon: ${ll[0].toFixed(4)}\u00b0  Lat: ${ll[1].toFixed(4)}\u00b0`);
      }
    });

    map.getView().on('change:resolution', () => {
      const view = map.getView();
      setZoom(`Zoom: ${view.getZoom().toFixed(1)}`);
      setResolution(`Res: ${view.getResolution().toFixed(2)} m/px`);
    });

    return () => {
      disposeRequestContext(satelliteRequestContextRef);
      for (const ctx of extraSatContexts.current.values()) {
        try { ctx.active = false; ctx.controllers.forEach(c => c.abort()); ctx.controllers.clear(); } catch {}
      }
      extraSatContexts.current.clear();
      map.setTarget(null);
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchBasemap = useCallback((val) => {
    const layers = Object.values(basemapRefs.current).filter(Boolean);
    if (!layers.length) return;
    layers.forEach((l) => l.setVisible(false));
    if (basemapRefs.current[val]) basemapRefs.current[val].setVisible(true);
    setActiveBasemap(val);
    onBasemapChange?.(val);
  }, [onBasemapChange]);

  // Cancel any active draw (called by MeasureTool before starting)
  const handleBeforeMeasureStart = useCallback(() => {
    if (drawInteractionRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    setDrawType(null);
  }, []);

  // Extracted so both imperative handle and pill can call it
  const deactivateDraw = useCallback(() => {
    if (drawInteractionRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    setDrawType(null);
    setPillExportOpen(false);
  }, []);

  // ── main export dispatcher ──────────────────────────────────────────
  const exportFeatures = useCallback((format) => {
    const ol = window.ol;
    if (!ol || !vectorSource.current) return;
    const features = vectorSource.current.getFeatures();
    if (!features.length) return;

    if (format === 'shapefile') {
      exportShapefile(features);
      return; // async, handles its own download
    }
    const result = featuresToExportContent(features, ol, format);
    if (!result) return;
    downloadBlob(new Blob([result.content], { type: result.mimeType }), result.filename);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    setBasemap: switchBasemap,
    exportFeatures,
    deactivateDraw,

    activateDraw(type) {
      cancelMeasureRef.current?.();
      deactivateDraw();
      const ol = window.ol;
      if (!ol || !mapInstance.current || !vectorSource.current) return;
      const geomMap = { point: 'Point', line: 'LineString', polygon: 'Polygon' };
      const draw = new ol.interaction.Draw({
        source: vectorSource.current,
        type: geomMap[type],
      });
      drawInteractionRef.current = draw;
      mapInstance.current.addInteraction(draw);
      setDrawType(type);
    },

    clearAll() {
      if (vectorSource.current) vectorSource.current.clear();
      deactivateDraw();
    },

    flyTo(lngLat, zoom = 16) {
      const ol = window.ol;
      const map = mapInstance.current;
      if (!ol || !map || !lngLat) return;
      map.getView().animate({
        center: ol.proj.fromLonLat(lngLat),
        zoom,
        duration: 600,
      });
    },

    getViewExtent() {
      const ol = window.ol;
      const map = mapInstance.current;
      if (!ol || !map) return null;
      const extent = map.getView().calculateExtent();
      const min = ol.proj.toLonLat([extent[0], extent[1]]);
      const max = ol.proj.toLonLat([extent[2], extent[3]]);
      return [min[0], min[1], max[0], max[1]];
    },

    onDrawComplete(callback) {
      const ol = window.ol;
      const map = mapInstance.current;
      if (!ol || !map) return;
      const draw = drawInteractionRef.current;
      if (!draw) return;
      draw.on('drawend', (e) => {
        const format = new ol.format.GeoJSON();
        const geojson = format.writeFeature(e.feature, {
          dataProjection: 'EPSG:4326',
          featureProjection: map.getView().getProjection(),
        });
        callback(JSON.parse(geojson));
      });
    },
  }));

  // ── Satellite tile layer management ───────────────────────────────

  // For r5m_tci ("5m Combined"): resolve to actual source (s2r5m_tci or ls5_tci)
  const r5mActualRef = useRef(null);

  function createSatelliteSource(viewtype, date, months, requestContext) {
    const ol = window.ol;
    if (!ol) return null;
    const params = new URLSearchParams({ end_date: date, days_back: '1', max_clouds: '100' });
    if (months) params.set('months', String(months));

    // Pollution tiles use a separate backend route
    const isPollution = viewtype.startsWith('pollution') && viewtype.endsWith('_overlay');
    const basePath = isPollution ? '/api/tiles/pollution' : '/api/tiles/v2';

    return new ol.source.XYZ({
      url: basePath + '/' + viewtype + '/{z}/{x}/{y}?' + params.toString(),
      maxZoom: SATELLITE_MAX_ZOOM,
      minZoom: SATELLITE_MIN_ZOOM,
      cacheSize: 512,
      tileLoadFunction: (tile, src) => satelliteTileLoadFunction(tile, src, requestContext),
      attributions: '&copy; Earth to Date',
    });
  }

  function satRefsFor(key) {
    if (key === 'main') return { layerRef: satelliteLayerRef, contextRef: satelliteRequestContextRef };
    if (!extraSatLayers.current.has(key)) extraSatLayers.current.set(key, null);
    return {
      layerRef: { get current() { return extraSatLayers.current.get(key) ?? null; }, set current(v) { extraSatLayers.current.set(key, v); } },
      contextRef: { get current() { return extraSatContexts.current.get(key) ?? null; }, set current(v) { extraSatContexts.current.set(key, v); } },
    };
  }

  function mapFor(key) {
    if (key === 'main') return mapInstance.current;
    return extraMapsRef.current.get(key) ?? null;
  }

  function labelFor(key) {
    if (key === 'main') return 'Main';
    const pos = (extraIds ?? []).indexOf(key);
    return pos >= 0 ? `Map ${pos + 2}` : `Map ${key}`;
  }

  function defaultSatState() {
    return { viewtype: 's2_tci', date: new Date().toISOString().slice(0, 10), months: undefined };
  }

  // Current view center of a map as { lat, lon } (lon/lat order from OL).
  function centerOf(map) {
    try {
      const ol = window.ol;
      const view = map?.getView?.();
      if (!ol || !view) return null;
      const ll = ol.proj.toLonLat(view.getCenter());
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
      return { lat: ll[1], lon: ll[0] };
    } catch {
      return null;
    }
  }

  const getMainViewCenter = useCallback(() => centerOf(mapInstance.current), []);
  const getExtraViewCenter = useCallback((id) => centerOf(extraMapsRef.current.get(id)), []);

  function setSatelliteLayerFor(key, viewtype, date, months) {
    const mapInstance = mapFor(key);
    const { layerRef, contextRef } = satRefsFor(key);
    setSatelliteLayer(mapInstance, layerRef, contextRef, viewtype, date, months, labelFor(key));
  }

  function removeSatelliteLayerFor(key) {
    const mapInstance = mapFor(key);
    const { layerRef, contextRef } = satRefsFor(key);
    removeSatelliteLayer(mapInstance, layerRef, contextRef);
  }
  function setSatelliteLayer(mapInstance, ref, contextRef, viewtype, date, months, side = 'Main') {
    const ol = window.ol;
    if (!mapInstance || !ol) return;
    removeSatelliteLayer(mapInstance, ref, contextRef);
    if (!viewtype || !isSatelliteAllowed(mapInstance.getView().getZoom())) return;

    const requestContext = { active: true, controllers: new Set() };
    const source = createSatelliteSource(viewtype, date, months, requestContext);
    if (!source) return;
    const layer = new Tile({
      source,
      visible: true,
      preload: 0,
      // Source minZoom clamps z9.9 to a z12 tile. This layer-level floor
      // prevents the renderer from enqueueing that clamped tile at all. Layer
      // minZoom is exclusive, hence the tiny epsilon that keeps z12 visible.
      minZoom: SATELLITE_MIN_ZOOM - 0.001,
      properties: {
        inspectorName: `Satellite (${side}): ${viewtype}`,
        inspectorCategory: 'Satellite',
        satelliteViewtype: viewtype,
      },
    });

    // Insert above basemaps but below vector layer.
    const layers = mapInstance.getLayers();
    const vecIdx = layers.getArray().findIndex(l => l instanceof ol.layer.Vector);
    contextRef.current = requestContext;
    ref.current = layer;
    layers.insertAt(vecIdx >= 0 ? vecIdx : layers.getLength(), layer);
  }

  function removeSatelliteLayer(mapInstance, ref, contextRef) {
    disposeRequestContext(contextRef);
    if (mapInstance && ref?.current) {
      try { mapInstance.removeLayer(ref.current); } catch { /* already detached */ }
    }
    if (ref) ref.current = null;
  }

  // Track latest values from satellite panels (main + one per extra map).
  // Main-map r5m resolution ref (r5mActualRef) is declared above.
  const satelliteStateRef = useRef(defaultSatState());

  function extraStateFor(id) {
    if (!extraSatStates.current.has(id)) extraSatStates.current.set(id, defaultSatState());
    return extraSatStates.current.get(id);
  }
  function extraR5mFor(id) {
    if (!extraR5mActual.current.has(id)) extraR5mActual.current.set(id, null);
    return { get current() { return extraR5mActual.current.get(id); }, set current(v) { extraR5mActual.current.set(id, v); } };
  }
  function extraOpenFor(id) {
    return !!extraSatOpen?.[id];
  }

  const handleSatelliteViewtype = useCallback(async ({ viewtype, date, months }) => {
    satelliteStateRef.current = { viewtype, date, months };
    setSatTick(t => t + 1);
    if (!satellitePanelOpen) return;
    const actual = await resolveR5mViewtype(viewtype, date, r5mActualRef);
    setSatelliteLayerFor('main', actual, date, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellitePanelOpen]);

  const handleExtraSatelliteViewtype = useCallback(async (id, { viewtype, date, months }) => {
    extraSatStates.current.set(id, { viewtype, date, months });
    setSatTick(t => t + 1);
    if (!extraOpenFor(id)) return;
    if (!extraMapsRef.current.get(id)) return;
    const actual = await resolveR5mViewtype(viewtype, date, extraR5mFor(id));
    setSatelliteLayerFor(id, actual, date, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraSatOpen, extraMapsTick]);

  // Stable per-map callbacks (SatellitePanel notifies on every change, so
  // identity must not churn or panels re-notify in a loop).
  const handleExtraRef = useRef(null);
  handleExtraRef.current = handleExtraSatelliteViewtype;
  function extraHandlerFor(id) {
    if (!extraSatHandlers.current.has(id)) {
      extraSatHandlers.current.set(id, (v) => handleExtraRef.current(id, v));
    }
    return extraSatHandlers.current.get(id);
  }

  const handleExtraMapsReady = useCallback((maps) => {
    extraMapsRef.current = maps instanceof Map ? maps : new Map();
    setExtraMapsTick(t => t + 1);
  }, []);

  const renderExtraPanel = useCallback((id) => (
    <SatellitePanel
      key={`sat-${id}`}
      open={!!extraSatOpen?.[id]}
      onViewtypeChange={extraHandlerFor(id)}
      right
      narrow={mapCount > 2}
      category={satCategory}
      onCategoryChange={onSatCategoryChange}
      getViewCenter={() => getExtraViewCenter(id)}
      relocateTick={searchTick}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [extraSatOpen, satCategory, extraMapsTick, mapCount, searchTick]);

  const renderExtraLegend = useCallback((id) => {
    if (!extraSatOpen?.[id]) return null;
    const s = extraSatStates.current.get(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return <SatelliteLegend key={`leg-${id}`} viewtype={s?.viewtype} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraSatOpen, satTick]);

  // Show/hide satellite layers when panels open/close
  // For r5m_tci: skip here, handled async above
  // On the very first open, center the map on the satellite start location.
  useEffect(() => {
    if (satellitePanelOpen) {
      const view = mapInstance.current?.getView();
      if (view) {
        if (!satPanelInitialPanRef.current) {
          satPanelInitialPanRef.current = true;
          view.animate({
            center: window.ol.proj.fromLonLat([SATELLITE_PANEL_START.lon, SATELLITE_PANEL_START.lat]),
            resolution: SATELLITE_OPEN_RESOLUTION,
            duration: 500,
          });
        } else {
          view.animate({ resolution: SATELLITE_OPEN_RESOLUTION, duration: 500 });
        }
      }
      const s = satelliteStateRef.current;
      if (s.viewtype !== 'r5m_tci') setSatelliteLayerFor('main', s.viewtype, s.date, s.months);
    } else {
      removeSatelliteLayerFor('main');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellitePanelOpen]);

  // Extra-map satellite layers: one per compare view, created only once the
  // extra map exists; never fall back to the main map, or a duplicate
  // satellite layer lands on top of another panel's.
  useEffect(() => {
    const ids = extraIds ?? [];
    // Drop state/handlers for removed maps so nothing leaks across add/remove.
    for (const id of Array.from(extraSatStates.current.keys())) {
      if (!ids.includes(id)) {
        removeSatelliteLayerFor(id);
        extraSatStates.current.delete(id);
        extraR5mActual.current.delete(id);
        extraSatHandlers.current.delete(id);
        extraSatLayers.current.delete(id);
      }
    }
    for (const id of ids) {
      const m = extraMapsRef.current.get(id);
      if (!m) continue;
      if (extraOpenFor(id)) {
        const s = extraStateFor(id);
        if (s.viewtype !== 'r5m_tci') setSatelliteLayerFor(id, s.viewtype, s.date, s.months);
      } else {
        removeSatelliteLayerFor(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraIds, extraSatOpen, extraMapsTick]);

  // Enforce the product zoom floor on the layer itself. Crossing below z12
  // removes it and aborts queued/in-flight product tiles; crossing back recreates
  // it with a fresh source, so OpenLayers cannot keep clamped z12 tiles around.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return undefined;
    const view = map.getView();

    const stateForKey = (key) => (key === 'main' ? satelliteStateRef.current : extraStateFor(key));
    const r5mForKey = (key) => (key === 'main' ? r5mActualRef.current : (extraR5mActual.current.get(key) || null));
    const openForKey = (key) => (key === 'main' ? satellitePanelOpen : extraOpenFor(key));
    const layerForKey = (key) => (key === 'main' ? satelliteLayerRef.current : (extraSatLayers.current.get(key) ?? null));

    const syncLayerZoom = () => {
      const allowed = isSatelliteAllowed(view.getZoom());
      const keys = ['main', ...(extraIds ?? [])];
      if (!allowed) {
        for (const key of keys) removeSatelliteLayerFor(key);
        return;
      }
      for (const key of keys) {
        if (key !== 'main' && !extraMapsRef.current.get(key)) continue;
        const s = stateForKey(key);
        if (openForKey(key) && !layerForKey(key)) {
          const viewtype = s.viewtype === 'r5m_tci' ? (r5mForKey(key) || 's2r5m_tci') : s.viewtype;
          setSatelliteLayerFor(key, viewtype, s.date, s.months);
        }
      }
    };

    view.on('change:resolution', syncLayerZoom);
    syncLayerZoom();
    return () => view.un('change:resolution', syncLayerZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExtras, satellitePanelOpen, extraSatOpen, extraMapsTick]);

  // Panel-2 satellite layer lives on the second map only (compare mode). It is
  // created only once map2 exists; no fallback to the main map.

  // Close pill export dropdown on outside click
  useEffect(() => {
    if (!pillExportOpen) return;
    function handleClick(e) {
      if (!e.target.closest(`.${styles.drawPill}`)) setPillExportOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pillExportOpen]);

  // Clean up draw/measure when entering compare mode (from any toggle source)
  useEffect(() => {
    if (hasExtras) { cancelMeasureRef.current?.(); deactivateDraw(); }
  }, [hasExtras]);

  // Call updateSize when compare mode changes (map container resizes)
  // Wrap in rAF so layout settles before OL reads element dimensions
  useEffect(() => {
    if (!mapInstance.current) return;
    const id = requestAnimationFrame(() => mapInstance.current.updateSize());
    return () => cancelAnimationFrame(id);
  }, [hasExtras, layoutMode, mapCount]);

  const layout = resolveLayout(mapCount, layoutMode);
  const handleCompareToggle = useCallback(() => {
    if (hasExtras) onRemoveAllExtras?.();
    else onAddMap?.();
  }, [hasExtras, onAddMap, onRemoveAllExtras]);
  let containerClass = styles.container;
  if (layout === 'compare') containerClass += ` ${styles.compareActive}`;
  else if (layout === 'swipe') containerClass += ` ${styles.compareActive} ${styles.compareSwipeMode}`;
  else if (layout === 'grid') containerClass += ` ${styles.stripActive}`;

  return (
    <div className={containerClass}>
      <div className={styles.mapCell}>
        <div ref={mapRef} className={styles.map}></div>
        <SatellitePanel
          open={satellitePanelOpen}
          onViewtypeChange={handleSatelliteViewtype}
          narrow={mapCount > 2}
          category={satCategory}
          onCategoryChange={onSatCategoryChange}
          getViewCenter={getMainViewCenter}
          compareActive={hasExtras}
          onToggleCompare={handleCompareToggle}
          relocateTick={searchTick}
        />
        {satellitePanelOpen && <SatelliteLegend viewtype={satelliteStateRef.current.viewtype} />}
      </div>
      <MapOverlay coords={coords} zoom={zoom} resolution={resolution} />
      {mapReady && <MeasureTool map={mapInstance.current} measureCancelRef={cancelMeasureRef} onBeforeMeasureStart={handleBeforeMeasureStart} buttonSlot={measureSlot} />}
      {mapReady && (
        <MapControls
          map={mapInstance.current}
          measureSlotRef={setMeasureSlot}
          layerInspectorOpen={layerInspectorOpen}
          onToggleLayerInspector={() => setLayerInspectorOpen(open => !open)}
          compareActive={hasExtras}
          onToggleCompare={handleCompareToggle}
        />
      )}
      {mapReady && (
        <LayerInspector
          map={mapInstance.current}
          open={layerInspectorOpen}
          onClose={() => setLayerInspectorOpen(false)}
        />
      )}
      {mapReady && (
        <MapCompare
          map={mapInstance.current}
          extraIds={extraIds ?? []}
          onAddMap={onAddMap}
          onRemoveMap={onRemoveMap}
          onRemoveAllExtras={onRemoveAllExtras}
          layoutMode={layoutMode}
          onLayoutChange={onLayoutChange}
          basemapRefs={basemapRefs.current}
          activeBasemap={activeBasemap}
          onExtraMapsReady={handleExtraMapsReady}
          renderPanel={renderExtraPanel}
          renderLegend={renderExtraLegend}
        />
      )}

      {mapReady && (
        <ArchivalResultsLayer
          map={mapInstance.current}
          results={archivalResults}
          hoveredId={hoveredResultId}
          pinnedIds={pinnedResultIds}
          onHover={onArchivalHover}
          onTogglePin={onArchivalTogglePin}
        />
      )}

      {mapReady && (
        <ArchivalPreviewLayer
          map={mapInstance.current}
          results={archivalResults}
          previewIds={previewResultIds}
        />
      )}

      {drawType && (
        <div className={styles.drawPill}>
          <span className={styles.pillDot} />
          <span className={styles.drawPillLabel}>Drawing {drawType.charAt(0).toUpperCase() + drawType.slice(1)}</span>
          <div className={styles.drawPillDivider} />
          <div className={styles.pillExportWrap}>
            <button className={styles.pillExportBtn} onClick={() => setPillExportOpen(o => !o)} title="Export features">
              Export
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {pillExportOpen && (
              <div className={styles.pillExportMenu}>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('geojson'); }}>GeoJSON</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('kml'); }}>KML</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('gpx'); }}>GPX</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('csv'); }}>CSV</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('wkt'); }}>WKT</button>
                <div className={styles.pillExportSep} />
                <button onClick={() => { setPillExportOpen(false); exportFeatures('shapefile'); }}>Shapefile (.zip)</button>
              </div>
            )}
          </div>
          <button className={styles.drawPillClose} onClick={deactivateDraw} title="Cancel draw">&times;</button>
        </div>
      )}
    </div>
  );
});

function ArchivalResultsLayer({ map, results, hoveredId, pinnedIds, onHover, onTogglePin }) {
  const layerRef = useRef(null);
  const sourceRef = useRef(null);
  const labelRef = useRef(null);
  const labelDivRef = useRef(null);

  useEffect(() => {
    const ol = window.ol;
    if (!ol) return;

    const source = new ol.source.Vector();
    sourceRef.current = source;

    const layer = new ol.layer.Vector({ source });
    layer.set('inspectorName', 'Archival Results');
    layer.set('inspectorCategory', 'Archival');
    layerRef.current = layer;

    return () => {
      const m = layerRef.current?.getMap?.();
      if (m) {
        if (labelRef.current) m.removeOverlay(labelRef.current);
        if (layerRef.current) { try { m.removeLayer(layerRef.current); } catch {} }
      }
    };
  }, []);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !layerRef.current) return;
    // Re-set style on every hover/pin change so the closure always sees
    // current values (a style set once would capture stale state).
    layerRef.current.setStyle((feature) => {
      const id = feature.get('resultId');
      const isHovered = id === hoveredId;
      const isPinned = pinnedIds.includes(id);

      if (isPinned) {
        return new ol.style.Style({
          fill: new ol.style.Fill({ color: 'rgba(230, 126, 34, 0.25)' }),
          stroke: new ol.style.Stroke({ color: '#e67e22', width: 2 }),
        });
      }
      if (isHovered) {
        return new ol.style.Style({
          fill: new ol.style.Fill({ color: 'rgba(241, 196, 15, 0.35)' }),
          stroke: new ol.style.Stroke({ color: '#f1c40f', width: 2 }),
        });
      }
      return new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.15)' }),
        stroke: new ol.style.Stroke({ color: 'rgba(255, 255, 255, 0.4)', width: 1 }),
      });
    });
    if (sourceRef.current) sourceRef.current.changed();
  }, [hoveredId, pinnedIds]);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !sourceRef.current || !map) return;
    const viewProj = map.getView().getProjection();
    sourceRef.current.clear();
    // Only the hovered and held footprints are rendered — nothing
    // is shown by default.
    const visibleIds = new Set([hoveredId, ...pinnedIds].filter(Boolean));
    if (visibleIds.size === 0) return;
    results.forEach(r => {
      if (!r.footprint || !visibleIds.has(r.id)) return;
      try {
        const format = new ol.format.GeoJSON();
        // Footprint is a geometry in EPSG:4326 — read as geometry and
        // reproject to the map's view projection.
        const geometry = format.readGeometry(r.footprint, {
          dataProjection: 'EPSG:4326',
          featureProjection: viewProj,
        });
        const feature = new ol.Feature({ geometry });
        feature.set('resultId', r.id);
        feature.set('title', r.title);
        sourceRef.current.addFeature(feature);
      } catch { /* skip invalid footprint */ }
    });
  }, [results, map, hoveredId, pinnedIds]);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !layerRef.current || !map) return;

    if (results.length > 0) {
      if (!map.getLayers().getArray().includes(layerRef.current)) {
        const layers = map.getLayers();
        const vecIdx = layers.getArray().findIndex(l => l instanceof ol.layer.Vector && l.get('inspectorName') === 'Drawn features');
        layers.insertAt(vecIdx >= 0 ? vecIdx : layers.getLength(), layerRef.current);
      }
    } else {
      if (map.getLayers().getArray().includes(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
    }
  }, [results, map]);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !map) return;

    const handlePointerMove = (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (l) => l === layerRef.current,
      });
      onHover?.(feature?.get('resultId') || null);
    };

    const handleClick = (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        layerFilter: (l) => l === layerRef.current,
      });
      const resultId = feature?.get('resultId');
      if (resultId) onTogglePin?.(resultId);
    };

    map.on('pointermove', handlePointerMove);
    map.on('click', handleClick);
    return () => {
      map.un('pointermove', handlePointerMove);
      map.un('click', handleClick);
    };
  }, [map, onHover, onTogglePin]);

  // Zoom below which the footprint label is hidden entirely, and the
  // zoom at/above which it renders at full size. In between, font size
  // interpolates so the label shrinks as you zoom out.
  const LABEL_HIDE_ZOOM = 8;
  const LABEL_FULL_ZOOM = 13;
  const LABEL_MIN_PX = 9;
  const LABEL_MAX_PX = 12;

  function applyLabelScale(zoom) {
    const div = labelDivRef.current;
    if (!div) return;
    if (zoom == null || zoom < LABEL_HIDE_ZOOM) {
      div.style.display = 'none';
      return;
    }
    div.style.display = '';
    const t = Math.min(1, Math.max(0, (zoom - LABEL_HIDE_ZOOM) / (LABEL_FULL_ZOOM - LABEL_HIDE_ZOOM)));
    div.style.fontSize = `${(LABEL_MIN_PX + t * (LABEL_MAX_PX - LABEL_MIN_PX)).toFixed(1)}px`;
  }

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !map) return;

    if (labelRef.current) {
      map.removeOverlay(labelRef.current);
      labelRef.current = null;
    }
    if (labelDivRef.current) labelDivRef.current = null;

    const activeId = hoveredId || pinnedIds[pinnedIds.length - 1];
    if (!activeId) return;

    const feature = sourceRef.current?.getFeatures().find(f => f.get('resultId') === activeId);
    if (!feature) return;

    const centroid = ol.extent.getCenter(feature.getGeometry().getExtent());
    const div = document.createElement('div');
    div.style.cssText = 'background:rgba(0,0,0,0.7);color:#fff;padding:2px 6px;border-radius:3px;pointer-events:none;white-space:nowrap;';
    div.textContent = feature.get('title') || activeId;
    labelDivRef.current = div;

    const overlay = new ol.Overlay({ position: centroid, element: div, positioning: 'bottom-center' });
    map.addOverlay(overlay);
    labelRef.current = overlay;
    applyLabelScale(map.getView().getZoom());
  }, [map, hoveredId, pinnedIds]);

  // Keep the label sized to the current zoom; hide it when zoomed far out.
  useEffect(() => {
    if (!map) return;
    const view = map.getView();
    const onChange = () => applyLabelScale(view.getZoom());
    view.on('change:resolution', onChange);
    onChange();
    return () => view.un('change:resolution', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

function ArchivalPreviewLayer({ map, results, previewIds }) {
  const layersRef = useRef(new Map()); // resultId -> preview layer (Image or WebGLTile)

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !map) return;

    const byId = new Map(results.map(r => [r.id, r]));

    // Remove previews that are no longer requested or no longer in results
    for (const [id, layer] of Array.from(layersRef.current.entries())) {
      if (!previewIds.includes(id) || !byId.has(id)) {
        try { map.removeLayer(layer); } catch {}
        layersRef.current.delete(id);
      }
    }

    // Add newly requested previews
    for (const id of previewIds) {
      if (layersRef.current.has(id)) continue;
      const result = byId.get(id);
      if (!result?.previewUrl) continue;
      try {
        const proxyUrl = `/api/vendors/${result.vendor || 'mgp-pro'}/browse?url=${encodeURIComponent(result.previewUrl)}`;
        const viewProj = map.getView().getProjection();
        let layer;
        if (/\.(png|jpe?g|webp)(\?|$)/i.test(result.previewUrl)) {
          // Displayable raster (e.g. BlackSky PNG browse): overlay at the
          // footprint's bbox extent. No footprint → can't place it.
          if (!result.footprint) continue;
          const format = new ol.format.GeoJSON();
          const geometry = format.readGeometry(result.footprint, {
            dataProjection: 'EPSG:4326',
            featureProjection: viewProj,
          });
          const source = new ol.source.ImageStatic({
            url: proxyUrl,
            imageExtent: geometry.getExtent(),
            projection: viewProj,
          });
          layer = new ol.layer.Image({ source, opacity: 1 });
        } else {
          // Note: GeoTIFF is a DataTile source — it requires the WebGLTile
          // layer renderer (Canvas tile/image renderers cannot draw raw
          // array tile data). MGP browse images are JPEG-compressed YCbCr,
          // so convertToRGB is needed to display true colors instead of
          // raw Y/Cb/Cr mapped to R/G/B (red cast).
          const source = new ol.source.GeoTIFF({
            sources: [{ url: proxyUrl }],
            convertToRGB: true,
          });
          layer = new ol.layer.WebGLTile({ source, opacity: 1 });
        }
        layer.set('inspectorName', `Preview: ${result.title}`);
        layer.set('inspectorCategory', 'Archival');
        layer.set('resultId', id);
        // Insert above footprints so the image covers its outline
        const layers = map.getLayers();
        const arr = layers.getArray();
        const topIdx = arr.findIndex(l => l.get('inspectorName') === 'Drawn features');
        layers.insertAt(topIdx >= 0 ? topIdx : layers.getLength(), layer);
        layersRef.current.set(id, layer);
      } catch { /* skip unloadable preview */ }
    }
  }, [map, results, previewIds]);

  // Cleanup on unmount
  useEffect(() => {
    const layers = layersRef.current;
    return () => {
      if (!map) return;
      for (const layer of layers.values()) {
        try { map.removeLayer(layer); } catch {}
      }
      layers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export default MapView;
