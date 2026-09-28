import { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import { canAddMap } from '../components/map/mapCount';
import styles from './MapPage.module.css';

const SAT_CATEGORY = { e2d: 'visual', ai: 'ai', analytics: 'analytics' };

export default function MapPage() {
  const [activePanel, setActivePanel] = useState(null);
  const [activeBasemap, setActiveBasemap] = useState('osm');
  const [satCategory, setSatCategory] = useState('visual');
  // Multi-map compare: main map always exists; extras are stable ids.
  // Up to MAX_MAPS total (main + extras), main is never closable.
  const [extraIds, setExtraIds] = useState([]);
  const nextExtraId = useRef(1);
  const [layoutMode, setLayoutMode] = useState('compare'); // 'compare' | 'swipe' (swipe: exactly 2 maps)
  const [satellitePanelOpen, setSatellitePanelOpen] = useState(false);
  const [extraSatOpen, setExtraSatOpen] = useState({}); // id -> bool
  const [searchTick, setSearchTick] = useState(0); // bumps on every search jump
  const [archivalResults, setArchivalResults] = useState([]);
  const [hoveredResultId, setHoveredResultId] = useState(null);
  const [pinnedResultIds, setPinnedResultIds] = useState([]);
  const [previewResultIds, setPreviewResultIds] = useState([]);
  // Ids of extra maps auto-added alongside the satellite panel (as opposed to
  // maps the user added manually via compare controls). Closing the satellite
  // panel removes auto-added maps but keeps manual ones.
  const autoSatIds = useRef(new Set());
  const mapRef = useRef(null);

  const extraIdsRef = useRef(extraIds);
  extraIdsRef.current = extraIds;
  const satellitePanelOpenRef = useRef(satellitePanelOpen);
  satellitePanelOpenRef.current = satellitePanelOpen;

  const addMap = useCallback(() => {
    if (!canAddMap(extraIdsRef.current.length + 1)) return;
    const id = nextExtraId.current++;
    setExtraIds(prev => (prev.includes(id) ? prev : [...prev, id]));
    // New maps inherit the main satellite panel state (open in compare).
    setExtraSatOpen(prev => ({ ...prev, [id]: satellitePanelOpenRef.current }));
  }, []);

  const removeMap = useCallback((id) => {
    autoSatIds.current.delete(id);
    setExtraIds(prev => prev.filter(x => x !== id));
    setExtraSatOpen(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeAllExtras = useCallback(() => {
    autoSatIds.current.clear();
    setExtraIds([]);
    setExtraSatOpen({});
  }, []);

  // Opening the satellite panel starts in compare view: ensure the second
  // map exists and record it as auto-added. Only fires on the closed->open
  // transition, so deleting back to the single main map while satellite stays
  // open is respected (min 1). Closing the satellite panel closes every
  // satellite panel and removes auto-added maps; manually added compare maps
  // are kept.
  const wasSatOpen = useRef(satellitePanelOpen);
  useEffect(() => {
    const was = wasSatOpen.current;
    wasSatOpen.current = satellitePanelOpen;
    if (satellitePanelOpen && !was && extraIds.length === 0) {
      // addMap() synchronously consumes nextExtraId.current, so the id is
      // known before the state updates flush.
      const id = nextExtraId.current;
      addMap();
      autoSatIds.current.add(id);
    } else if (!satellitePanelOpen && was) {
      const auto = autoSatIds.current;
      autoSatIds.current = new Set();
      if (auto.size > 0) setExtraIds(prev => prev.filter(x => !auto.has(x)));
      setExtraSatOpen({});
    }
  }, [satellitePanelOpen, extraIds.length, addMap]);

  // Earth to Date, AI and Analytics are the three satellite product categories.
  // They switch the satellite layer rather than opening a side panel; clicking
  // the one that's already showing turns Earth to Date off.
  const handleSelectPanel = useCallback((id) => {
    const cat = SAT_CATEGORY[id];
    if (cat) {
      if (satellitePanelOpen && satCategory === cat) {
        setSatellitePanelOpen(false);
        return;
      }
      setSatCategory(cat);
      setSatellitePanelOpen(true);
      setActivePanel(null);
      return;
    }
    setActivePanel(p => (p === id ? null : id));
  }, [satellitePanelOpen, satCategory]);

  const handleSelectBasemap = useCallback((id) => {
    mapRef.current?.setBasemap(id);
  }, []);

  const handleSearch = useCallback((lngLat, zoom) => {
    mapRef.current?.flyTo(lngLat, zoom);
    // Nudge open satellite panels to re-resolve their default date for the
    // new location once the fly-to animation lands.
    setSearchTick(t => t + 1);
  }, []);

  const handleClear = useCallback(() => {
    mapRef.current?.clearAll();
  }, []);

  const handleArchivalHover = useCallback((id) => setHoveredResultId(id), []);
  const handleArchivalTogglePin = useCallback((id) => {
    setPinnedResultIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);
  const handleArchivalClearPins = useCallback(() => setPinnedResultIds([]), []);
  const handleArchivalTogglePreview = useCallback((id) => {
    setPreviewResultIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // Clean up all archival layers (footprints, previews, labels) when the
  // archive panel closes or the user switches to another panel. Clearing
  // the state drives each map layer's own removal logic.
  const prevPanelRef = useRef(activePanel);
  useEffect(() => {
    if (prevPanelRef.current === 'archive' && activePanel !== 'archive') {
      setArchivalResults([]);
      setPinnedResultIds([]);
      setPreviewResultIds([]);
      setHoveredResultId(null);
    }
    prevPanelRef.current = activePanel;
  }, [activePanel]);

  const handleMenuAction = useCallback((action) => {
    switch (action) {
      case 'new-project':
        handleClear();
        break;
      case 'basemap-osm':
        mapRef.current?.setBasemap('osm');
        break;
      case 'basemap-satellite':
        mapRef.current?.setBasemap('satellite');
        break;
      case 'basemap-terrain':
        mapRef.current?.setBasemap('terrain');
        break;
      case 'basemap-sentinel':
        mapRef.current?.setBasemap('sentinel');
        break;
      case 'draw-point':
        mapRef.current?.activateDraw('point');
        break;
      case 'draw-line':
        mapRef.current?.activateDraw('line');
        break;
      case 'draw-polygon':
        mapRef.current?.activateDraw('polygon');
        break;
      case 'draw-clear':
        handleClear();
        break;
      case 'export-geojson':
        mapRef.current?.exportFeatures('geojson');
        break;
      case 'export-kml':
        mapRef.current?.exportFeatures('kml');
        break;
      case 'export-gpx':
        mapRef.current?.exportFeatures('gpx');
        break;
      case 'export-csv':
        mapRef.current?.exportFeatures('csv');
        break;
      case 'export-wkt':
        mapRef.current?.exportFeatures('wkt');
        break;
      case 'export-shapefile':
        mapRef.current?.exportFeatures('shapefile');
        break;
      case 'help-about':
        alert('GEOSYZE v1.0 \u2014 GIS Intelligence Platform');
        break;
      case 'help-shortcuts':
        alert('Keyboard shortcuts:\n\nD: Draw polygon\nM: Measure distance\nCtrl+Z: Undo');
        break;
      default:
        break;
    }
  }, [handleClear]);

  const anySatelliteOpen = satellitePanelOpen || Object.values(extraSatOpen).some(Boolean);

  return (
    <div className={styles.page}>
      <TopBar onMenuAction={handleMenuAction} onSearch={handleSearch} />
      <div className={styles.body}>
        <Sidebar
          activePanel={activePanel}
          onSelectPanel={handleSelectPanel}
          activeBasemap={activeBasemap}
          onSelectBasemap={handleSelectBasemap}
          satelliteOpen={anySatelliteOpen}
          satCategory={satCategory}
          mapRef={mapRef}
          onArchivalResultsChange={setArchivalResults}
          hoveredResultId={hoveredResultId}
          pinnedResultIds={pinnedResultIds}
          previewResultIds={previewResultIds}
          onArchivalHover={handleArchivalHover}
          onArchivalTogglePin={handleArchivalTogglePin}
          onArchivalClearPins={handleArchivalClearPins}
          onArchivalTogglePreview={handleArchivalTogglePreview}
        />
        <main className={styles.mapArea}>
          <MapView
            ref={mapRef}
            layoutMode={layoutMode}
            onLayoutChange={setLayoutMode}
            extraIds={extraIds}
            onAddMap={addMap}
            onRemoveMap={removeMap}
            onRemoveAllExtras={removeAllExtras}
            satellitePanelOpen={satellitePanelOpen}
            setSatellitePanelOpen={setSatellitePanelOpen}
            extraSatOpen={extraSatOpen}
            searchTick={searchTick}
            onBasemapChange={setActiveBasemap}
            satCategory={satCategory}
            onSatCategoryChange={setSatCategory}
            archivalResults={archivalResults}
            hoveredResultId={hoveredResultId}
            pinnedResultIds={pinnedResultIds}
            previewResultIds={previewResultIds}
            onArchivalHover={handleArchivalHover}
            onArchivalTogglePin={handleArchivalTogglePin}
            onArchivalTogglePreview={handleArchivalTogglePreview}
          />
        </main>
      </div>
    </div>
  );
}
