import { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import { MAX_MAPS, canAddMap } from '../components/map/mapCount';
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
  const mapRef = useRef(null);

  const mapCount = 1 + extraIds.length;
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
    setExtraIds(prev => prev.filter(x => x !== id));
    setExtraSatOpen(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeAllExtras = useCallback(() => {
    setExtraIds([]);
    setExtraSatOpen({});
  }, []);

  const toggleCompare = useCallback(() => {
    if (extraIds.length > 0) removeAllExtras();
    else addMap();
  }, [extraIds.length, addMap, removeAllExtras]);

  // Opening the satellite panel starts in compare view: ensure the second
  // map exists. Only fires on the closed->open transition, so deleting back
  // to the single main map while satellite stays open is respected (min 1).
  // Closing satellite never forces maps closed.
  const wasSatOpen = useRef(satellitePanelOpen);
  useEffect(() => {
    const was = wasSatOpen.current;
    wasSatOpen.current = satellitePanelOpen;
    if (satellitePanelOpen && !was && extraIds.length === 0) addMap();
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
  }, []);

  const handleClear = useCallback(() => {
    mapRef.current?.clearAll();
  }, []);

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
      <TopBar onMenuAction={handleMenuAction} mapCount={mapCount} maxMaps={MAX_MAPS} onToggleCompare={toggleCompare} onSearch={handleSearch} />
      <div className={styles.body}>
        <Sidebar
          activePanel={activePanel}
          onSelectPanel={handleSelectPanel}
          activeBasemap={activeBasemap}
          onSelectBasemap={handleSelectBasemap}
          satelliteOpen={anySatelliteOpen}
          satCategory={satCategory}
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
            onBasemapChange={setActiveBasemap}
            satCategory={satCategory}
            onSatCategoryChange={setSatCategory}
          />
        </main>
      </div>
    </div>
  );
}
