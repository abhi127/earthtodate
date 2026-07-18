import { useCallback } from 'react';
import styles from './MapControls.module.css';

export default function MapControls({ map }) {
  const ol = window.ol;

  const zoomIn = useCallback(() => {
    const view = map.getView();
    view.animate({ zoom: view.getZoom() + 1 });
  }, [map]);

  const zoomOut = useCallback(() => {
    const view = map.getView();
    view.animate({ zoom: view.getZoom() - 1 });
  }, [map]);

  const resetNorth = useCallback(() => {
    map.getView().animate({ rotation: 0 });
  }, [map]);

  const rotateLeft = useCallback(() => {
    const view = map.getView();
    view.animate({ rotation: view.getRotation() - Math.PI / 4 });
  }, [map]);

  const rotateRight = useCallback(() => {
    const view = map.getView();
    view.animate({ rotation: view.getRotation() + Math.PI / 4 });
  }, [map]);

  const resetHome = useCallback(() => {
    map.getView().animate({
      center: ol.proj.fromLonLat([78.9629, 20.5937]),
      zoom: 5,
      rotation: 0,
    });
  }, [map, ol]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <button className={styles.btn} onClick={zoomIn} title="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button className={styles.btn} onClick={zoomOut} title="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
      </div>
      <div className={styles.section}>
        <button className={styles.btn} onClick={resetNorth} title="Reset north">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="8"/>
            <polygon points="12,4 6,14 18,14" fill="currentColor" stroke="none"/>
            <line x1="12" y1="14" x2="12" y2="20" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className={styles.btn} onClick={rotateLeft} title="Rotate left">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 16C18 9 15 6 12 6S6 9 6 16"/>
            <polyline points="10 12 6 16 12 17"/>
          </svg>
        </button>
        <button className={styles.btn} onClick={rotateRight} title="Rotate right">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16C6 9 9 6 12 6S18 9 18 16"/>
            <polyline points="14 12 18 16 12 17"/>
          </svg>
        </button>
      </div>
      <div className={styles.section}>
        <button className={styles.btn} onClick={resetHome} title="Home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m4 0a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4m6-8l2 2"/>
          </svg>
        </button>
        <button className={styles.btn} onClick={toggleFullscreen} title="Full screen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
