import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './MapView.module.css';

const BASEMAP_NAMES = {
  osm: 'OSM', satellite: 'Esri', terrain: 'Terrain',
  light: 'CARTO', streets: 'Streets', dark: 'Dark',
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
  };
  return (map[id] || map.osm)();
}

function nextBasemap(current) {
  return BASEMAP_IDS[(BASEMAP_IDS.indexOf(current) + 1) % BASEMAP_IDS.length];
}

// Swap to a new basemap layer with overlap: old stays visible until new tiles load
function swapLayer(mapInstance, oldLayer, newId, onSwapped) {
  const ol = window.ol;
  if (!ol || !mapInstance) return oldLayer;

  const newLayer = new ol.layer.Tile({ source: createSource(newId) });
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

export default function MapCompare({ map, mode, basemapRefs, activeBasemap, onToggle, onMap2Ready }) {
  const ol = window.ol;
  const map2Ref = useRef(null);
  const map2Instance = useRef(null);
  const leftLayer = useRef(null);   // current left sidebar (temp)
  const rightLayer = useRef(null);  // current right sidebar (in map2)
  const guard = useRef(false);
  const syncRefs = useRef({});
  const [leftBase, setLeftBase] = useState(activeBasemap || 'osm');
  const [rightBase, setRightBase] = useState(() => nextBasemap(activeBasemap || 'osm'));
  const [splitPos, setSplitPos] = useState(0.5);
  const compareActive = !!mode;

  // ── Setup / teardown left side (only when entering/leaving compare mode) ──
  useEffect(() => {
    if (!compareActive || !ol || !map) return;
    // Hide original basemaps
    const saved = {};
    for (const key of BASEMAP_IDS) {
      const l = basemapRefs?.[key];
      if (l) { saved[key] = l.getVisible(); l.setVisible(false); }
    }
    // Create initial left layer (at bottom so satellite overlays stay visible)
    const ll = new ol.layer.Tile({ source: createSource(leftBase) });
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
  }, [compareActive]);

  // ── Left basemap switch (overlapping swap) ───────────────────────────
  useEffect(() => {
    if (!mode || !ol || !map) return;
    const old = leftLayer.current;
    leftLayer.current = swapLayer(map, old, leftBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftBase]);

  // ── Setup / teardown right side (only when entering/leaving compare mode) ──
  useEffect(() => {
    if (!compareActive || !ol || !map || !map2Ref.current) return;

    const mainView = map.getView();
    const view2 = new ol.View({
      center: mainView.getCenter(),
      zoom: mainView.getZoom(),
      projection: mainView.getProjection(),
    });

    const rl = new ol.layer.Tile({ source: createSource(rightBase) });
    const m2 = new ol.Map({
      target: map2Ref.current,
      layers: [rl],
      view: view2,
      controls: [],
      interactions: [],
    });
    map2Instance.current = m2;
    rightLayer.current = rl;
    onMap2Ready?.(m2);
    requestAnimationFrame(() => m2.updateSize());

    // View sync: main → map2 (one-way, map2 has no interactions)
    const syncM2 = () => {
      if (!guard.current) {
        view2.setCenter(mainView.getCenter());
        view2.setResolution(mainView.getResolution());
        view2.setRotation(mainView.getRotation());
      }
    };
    mainView.on('change:center', syncM2);
    mainView.on('change:resolution', syncM2);
    mainView.on('change:rotation', syncM2);
    syncRefs.current = { mainView, view2, syncM2 };

    return () => {
      const { mainView: mv, view2: v2, syncM2: cb } = syncRefs.current;
      if (mv && cb) {
        mv.un('change:center', cb);
        mv.un('change:resolution', cb);
        mv.un('change:rotation', cb);
      }
      if (m2) m2.setTarget(null);
      onMap2Ready?.(null);
      map2Instance.current = null;
      rightLayer.current = null;
      syncRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareActive]);

  // ── Right basemap switch (overlapping swap) ──────────────────────────
  useEffect(() => {
    if (!ol || !map2Instance.current) return;
    const old = rightLayer.current;
    rightLayer.current = swapLayer(map2Instance.current, old, rightBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rightBase]);

  // ── Clip map2 for swipe mode ──────────────────────────────────────────
  useEffect(() => {
    if (!mode || !map2Ref.current) return;
    map2Ref.current.style.clipPath = mode === 'swipe' ? `inset(0 0 0 ${splitPos * 100}%)` : '';
  }, [mode, splitPos]);

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

  if (!mode) return null;

  return (
    <>
      <div ref={map2Ref} className={styles.map2} />
      {mode === 'swipe' && (
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
          <span className={styles.compareLabel}>Left</span>
          <select className={styles.compareSelect} value={leftBase} onChange={e => setLeftBase(e.target.value)}>
            {BASEMAP_IDS.map(k => <option key={k} value={k}>{BASEMAP_NAMES[k]}</option>)}
          </select>
        </div>
        <div className={styles.compareDividerV} />
        <div className={styles.comparePicker}>
          <span className={styles.compareLabel}>Right</span>
          <select className={styles.compareSelect} value={rightBase} onChange={e => setRightBase(e.target.value)}>
            {BASEMAP_IDS.map(k => <option key={k} value={k}>{BASEMAP_NAMES[k]}</option>)}
          </select>
        </div>
        <div className={styles.compareDividerV} />
        <div className={styles.compareModeBtns}>
          <button className={`${styles.compareModeBtn} ${mode === 'compare' ? styles.compareModeActive : ''}`} onClick={() => onToggle('compare')} title="Side by side">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
          </button>
          <button className={`${styles.compareModeBtn} ${mode === 'swipe' ? styles.compareModeActive : ''}`} onClick={() => onToggle('swipe')} title="Swipe">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
          </button>
        </div>
        <button className={styles.compareClose} onClick={() => onToggle(null)} title="Close compare">&times;</button>
      </div>
    </>
  );
}
