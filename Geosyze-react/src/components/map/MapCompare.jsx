import { useState, useEffect, useRef, useCallback } from 'react';
import { loadIndiaCompositeLayer } from './indiaCompositeLayer';
import { MAX_MAPS, canAddMap } from './mapCount';
import styles from './MapView.module.css';

const BASEMAP_NAMES = {
  osm: 'OSM', satellite: 'Esri', terrain: 'Terrain',
  light: 'CARTO', streets: 'Streets', dark: 'Dark', sentinel: 'Sentinel',
};
const BASEMAP_IDS = Object.keys(BASEMAP_NAMES);

function createSource(id) {
  const ol = window.ol;
  const map = {
    osm: () => new ol.source.OSM(),
    satellite: () => new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, attributions: '&copy; Esri',
    }),
    terrain: () => new ol.source.XYZ({
      url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      maxZoom: 17, attributions: '&copy; OpenTopoMap',
    }),
    light: () => new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      maxZoom: 19, attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
    }),
    streets: () => new ol.source.XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19, attributions: '&copy; Esri',
    }),
    dark: () => new ol.source.XYZ({
      url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      maxZoom: 19, attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
    }),
    sentinel: () => new ol.source.XYZ({
      url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
      maxZoom: 14,
      attributions: 'Sentinel-2 cloudless - <a href="https://s2maps.eu">EOX</a> (Contains modified Copernicus Sentinel data)',
    }),
  };
  return (map[id] || map.osm)();
}

function nextBasemap(current) {
  return BASEMAP_IDS[(BASEMAP_IDS.indexOf(current) + 1) % BASEMAP_IDS.length];
}

// Swap to a new basemap layer with overlap: old stays visible until new tiles load
function swapLayer(mapInstance, oldLayer, newId, label, onSwapped) {
  const ol = window.ol;
  if (!ol || !mapInstance) return oldLayer;

  const newLayer = new ol.layer.Tile({
    source: createSource(newId),
    properties: {
      inspectorName: `${label}: ${BASEMAP_NAMES[newId]}`,
      inspectorCategory: 'Compare basemap',
    },
  });
  const layers = mapInstance.getLayers();
  // Insert at old layer's position so satellite overlays stay on top
  const idx = oldLayer ? layers.getArray().indexOf(oldLayer) : -1;
  if (idx >= 0) layers.insertAt(idx, newLayer);
  else layers.push(newLayer);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (oldLayer) {
      try { mapInstance.removeLayer(oldLayer); } catch {}
    }
    if (onSwapped) onSwapped();
  };

  // Remove old layer as soon as first new tile loads
  const src = newLayer.getSource();
  if (src) src.once('tileloadend', finish);
  // Fallback: force cleanup after 3s
  setTimeout(finish, 3000);

  return newLayer;
}

// Multi-map compare: main map + up to (MAX_MAPS - 1) extra maps.
// Extra maps are keyed by stable ids from the parent so add/remove of any
// map (not just the last) keeps instances, basemaps and satellite layers
// mapped to the right view. The main map (index 0) is never closable.
export default function MapCompare({
  map,
  extraIds,
  onAddMap,
  onRemoveMap,
  onRemoveAllExtras,
  layoutMode,
  onLayoutChange,
  basemapRefs,
  activeBasemap,
  onExtraMapsReady,
  renderPanel,
  renderLegend,
}) {
  const ol = window.ol;
  const cellDivs = useRef(new Map());   // id -> map div
  const extraMaps = useRef(new Map());  // id -> ol.Map
  const extraLayers = useRef(new Map());// id -> basemap Tile layer
  const leftLayer = useRef(null);       // main-map compare basemap
  const guard = useRef(false);
  const syncCleanup = useRef(null);
  const extraIdsRef = useRef(extraIds);
  extraIdsRef.current = extraIds;
  const [leftBase, setLeftBase] = useState(activeBasemap || 'osm');
  const [basesById, setBasesById] = useState({}); // id -> basemap id
  const [splitPos, setSplitPos] = useState(0.5);
  const hasExtras = extraIds.length > 0;
  const twoMaps = extraIds.length === 1;

  const defaultBaseFor = useCallback((id) => {
    const pos = Math.max(0, extraIdsRef.current.indexOf(id));
    const anchor = activeBasemap || 'osm';
    return BASEMAP_IDS[(BASEMAP_IDS.indexOf(anchor) + pos + 1) % BASEMAP_IDS.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseFor = useCallback((id) => basesById[id] || defaultBaseFor(id), [basesById, defaultBaseFor]);

  // ── Setup / teardown left side (only when entering/leaving compare) ──
  useEffect(() => {
    if (!hasExtras || !ol || !map) return;
    // Hide original basemaps
    const saved = {};
    for (const key of BASEMAP_IDS) {
      const l = basemapRefs?.[key];
      if (l) { saved[key] = l.getVisible(); l.setVisible(false); }
    }
    // Create initial left layer (at bottom so satellite overlays stay visible)
    const ll = new ol.layer.Tile({
      source: createSource(leftBase),
      properties: {
        inspectorName: `Compare left: ${BASEMAP_NAMES[leftBase]}`,
        inspectorCategory: 'Compare basemap',
      },
    });
    const mapLayers = map.getLayers();
    mapLayers.insertAt(0, ll);
    leftLayer.current = ll;
    requestAnimationFrame(() => map.updateSize());

    return () => {
      // Cleanup: remove left layer and restore basemap visibility
      const l = leftLayer.current;
      if (l) { try { map.removeLayer(l); } catch {} leftLayer.current = null; }
      for (const key of BASEMAP_IDS) {
        const l2 = basemapRefs?.[key];
        if (l2 && saved[key] !== undefined) l2.setVisible(saved[key]);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExtras]);

  // ── Left basemap switch (overlapping swap) ───────────────────────────
  useEffect(() => {
    if (!hasExtras || !ol || !map) return;
    const old = leftLayer.current;
    leftLayer.current = swapLayer(map, old, leftBase, 'Compare left');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftBase]);

  // ── Reconcile extra maps with extraIds (create + destroy) ────────────
  useEffect(() => {
    if (!ol || !map) return;
    const mainView = map.getView();

    // Destroy instances whose id is gone (covers remove-any + remove-all)
    for (const [id, m] of Array.from(extraMaps.current.entries())) {
      if (!extraIdsRef.current.includes(id)) {
        try { m.setTarget(null); } catch {}
        extraMaps.current.delete(id);
        extraLayers.current.delete(id);
      }
    }

    if (!hasExtras) {
      onExtraMapsReady?.(new Map());
      return undefined;
    }

    // Create instances for new ids, reusing the main view state
    for (const id of extraIdsRef.current) {
      if (extraMaps.current.has(id)) continue;
      const div = cellDivs.current.get(id);
      if (!div) continue;
      const base = baseFor(id);
      const view = new ol.View({
        center: mainView.getCenter(),
        zoom: mainView.getZoom(),
        projection: mainView.getProjection(),
      });
      const rl = new ol.layer.Tile({
        source: createSource(base),
        properties: {
          inspectorName: `Compare ${id}: ${BASEMAP_NAMES[base]}`,
          inspectorCategory: 'Compare basemap',
        },
      });
      const m2 = new ol.Map({
        target: div,
        layers: [rl],
        view: view,
        controls: [],
        interactions: ol.interaction.defaults(),
      });
      extraMaps.current.set(id, m2);
      extraLayers.current.set(id, rl);
      loadIndiaCompositeLayer(m2);
      requestAnimationFrame(() => m2.updateSize());
    }
    onExtraMapsReady?.(new Map(extraMaps.current));

    // View sync: N-way, guarded against feedback loops.
    // The guard check at entry is critical: without it the echo back into an
    // animating view cancels its zoom/rotate animation (View.applyTargetState_).
    const views = [mainView, ...extraIdsRef.current.map((id) => extraMaps.current.get(id)?.getView()).filter(Boolean)];
    const handlers = [];
    const syncFrom = (srcIdx) => () => {
      if (guard.current) return;
      guard.current = true;
      try {
        const src = views[srcIdx];
        const center = src.getCenter();
        const res = src.getResolution();
        const rot = src.getRotation();
        views.forEach((v, i) => {
          if (i === srcIdx) return;
          v.setCenter(center);
          v.setResolution(res);
          v.setRotation(rot);
        });
      } finally {
        guard.current = false;
      }
    };
    views.forEach((v, i) => {
      const h = syncFrom(i);
      v.on('change:center', h);
      v.on('change:resolution', h);
      v.on('change:rotation', h);
      handlers.push([v, h]);
    });
    syncCleanup.current = () => {
      handlers.forEach(([v, h]) => {
        v.un('change:center', h);
        v.un('change:resolution', h);
        v.un('change:rotation', h);
      });
    };

    return () => {
      syncCleanup.current?.();
      syncCleanup.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraIds.length, hasExtras]);

  // ── Unmount: destroy all extra maps ───────────────────────────────────
  useEffect(() => () => {
    for (const m of extraMaps.current.values()) {
      try { m.setTarget(null); } catch {}
    }
    extraMaps.current.clear();
    extraLayers.current.clear();
  }, []);

  // ── Extra basemap switches (overlapping swap) ─────────────────────────
  useEffect(() => {
    if (!ol) return;
    for (const [id, base] of Object.entries(basesById)) {
      const m = extraMaps.current.get(Number(id));
      if (!m) continue;
      const old = extraLayers.current.get(Number(id));
      extraLayers.current.set(Number(id), swapLayer(m, old, base, `Compare ${id}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basesById]);

  // ── Clip second map for swipe mode (exactly 2 maps only) ─────────────
  useEffect(() => {
    const id = extraIdsRef.current[0];
    const div = id !== undefined ? cellDivs.current.get(id) : undefined;
    if (!div) return;
    div.style.clipPath = (twoMaps && layoutMode === 'swipe') ? `inset(0 0 0 ${splitPos * 100}%)` : '';
  }, [layoutMode, splitPos, twoMaps, extraIds.length]);

  // ── Sizes after layout changes ────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const id = requestAnimationFrame(() => {
      map.updateSize();
      for (const m of extraMaps.current.values()) {
        try { m.updateSize(); } catch {}
      }
    });
    return () => cancelAnimationFrame(id);
  }, [map, extraIds.length, layoutMode]);

  // ── Swipe divider drag ────────────────────────────────────────────────
  const onDividerDown = useCallback((e) => {
    e.preventDefault();
    const container = map?.getTargetElement()?.parentElement;
    const rect = container?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (ev) => {
      setSplitPos(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [map]);

  if (!hasExtras) return null;

  const showSwipe = twoMaps && layoutMode === 'swipe';

  return (
    <>
      {extraIds.map((id, pos) => (
        <div key={id} className={styles.mapCell}>
          <div
            ref={(el) => {
              if (el) cellDivs.current.set(id, el);
              else cellDivs.current.delete(id);
            }}
            className={styles.map2}
          />
          {renderPanel?.(id)}
          {renderLegend?.(id)}
          <button className={styles.cellClose} onClick={() => onRemoveMap(id)} title={`Close map ${pos + 2}`}>
            &times;
          </button>
        </div>
      ))}
      {showSwipe && (
        <div className={styles.swipeDivider} style={{ left: `${splitPos * 100}%` }} onMouseDown={onDividerDown}>
          <div className={styles.swipeHandle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </div>
        </div>
      )}
      <div className={styles.comparePanel}>
        <div className={styles.comparePicker}>
          <span className={styles.compareLabel}>Map 1</span>
          <select className={styles.compareSelect} value={leftBase} onChange={e => setLeftBase(e.target.value)}>
            {BASEMAP_IDS.map(k => <option key={k} value={k}>{BASEMAP_NAMES[k]}</option>)}
          </select>
        </div>
        {extraIds.map((id, pos) => (
          <div key={id} style={{ display: 'contents' }}>
            <div className={styles.compareDividerV} />
            <div className={styles.comparePicker}>
              <span className={styles.compareLabel}>Map {pos + 2}</span>
              <select
                className={styles.compareSelect}
                value={baseFor(id)}
                onChange={e => setBasesById(prev => ({ ...prev, [id]: e.target.value }))}
              >
                {BASEMAP_IDS.map(k => <option key={k} value={k}>{BASEMAP_NAMES[k]}</option>)}
              </select>
              <button className={styles.compareClose} onClick={() => onRemoveMap(id)} title={`Close map ${pos + 2}`} style={{ borderLeft: 'none', width: 22 }}>
                &times;
              </button>
            </div>
          </div>
        ))}
        <div className={styles.compareDividerV} />
        <div className={styles.compareModeBtns}>
          {canAddMap(extraIds.length + 1) ? (
            <button className={styles.compareModeBtn} onClick={onAddMap} title={`Add map (${extraIds.length + 1}/${MAX_MAPS})`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          ) : null}
          {twoMaps && (
            <>
              <button className={`${styles.compareModeBtn} ${layoutMode !== 'swipe' ? styles.compareModeActive : ''}`} onClick={() => onLayoutChange('compare')} title="Side by side">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
              </button>
              <button className={`${styles.compareModeBtn} ${layoutMode === 'swipe' ? styles.compareModeActive : ''}`} onClick={() => onLayoutChange('swipe')} title="Swipe">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
              </button>
            </>
          )}
        </div>
        <button className={styles.compareClose} onClick={onRemoveAllExtras} title="Close all extra maps">&times;</button>
      </div>
    </>
  );
}
