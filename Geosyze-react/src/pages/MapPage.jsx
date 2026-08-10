import { useState, useRef, useCallback, useEffect } from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import styles from './MapPage.module.css';

export default function MapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(null);
  const [satellitePanelOpen, setSatellitePanelOpen] = useState(false);
  const [satellitePanelOpen2, setSatellitePanelOpen2] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lon: 78.9629 });
  const mapRef = useRef(null);

  const handleToggleSatellite = useCallback(() => {
    setSatellitePanelOpen(o => !o);
    setSatellitePanelOpen2(o => !o);
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
      case 'toggle-satellite-overlay':
        handleToggleSatellite();
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
  }, [handleClear, handleToggleSatellite]);

  // Track map center for calendar API
  const handleCenterChange = useCallback((center) => {
    if (center) {
      const [lon, lat] = center;
      setMapCenter({ lat, lon });
    }
  }, []);

  return (
    <div className={styles.page}>
      <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} onMenuAction={handleMenuAction} compareMode={compareMode} setCompareMode={setCompareMode} satelliteActive={satellitePanelOpen || satellitePanelOpen2} onSearch={handleSearch} />
      <div className={styles.body}>
        <Sidebar isOpen={sidebarOpen} />
        <main className={styles.mapArea}>
          <MapView
            ref={mapRef}
            compareMode={compareMode}
            setCompareMode={setCompareMode}
            satellitePanelOpen={satellitePanelOpen}
            setSatellitePanelOpen={setSatellitePanelOpen}
            satellitePanelOpen2={satellitePanelOpen2}
            setSatellitePanelOpen2={setSatellitePanelOpen2}
            onCenterChange={handleCenterChange}
            center={mapCenter}
          />
        </main>
      </div>
    </div>
  );
}
