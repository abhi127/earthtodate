import { useState, useRef, useCallback } from 'react';
import TopBar from '../components/layout/TopBar';
import Sidebar from '../components/layout/Sidebar';
import MapView from '../components/map/MapView';
import styles from './MapPage.module.css';

export default function MapPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mapRef = useRef(null);

  const handleClear = useCallback(() => {
    mapRef.current?.clearAll();
  }, []);

  const handleDrawComplete = useCallback(() => {
    setSidebarOpen(true);
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

  return (
    <div className={styles.page}>
      <TopBar onToggleSidebar={() => setSidebarOpen((o) => !o)} onMenuAction={handleMenuAction} />
      <div className={styles.body}>
        <Sidebar isOpen={sidebarOpen} />
        <main className={styles.mapArea}>
          <MapView ref={mapRef} onDrawComplete={handleDrawComplete} />
        </main>
      </div>
    </div>
  );
}
