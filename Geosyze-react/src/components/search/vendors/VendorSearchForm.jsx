import { useState, useCallback } from 'react';
import styles from './VendorSearchForm.module.css';

export default function VendorSearchForm({ mapRef, onSearch, loading }) {
  const [aoiMode, setAoiMode] = useState(null);
  const [aoi, setAoi] = useState(null);
  const [aoiError, setAoiError] = useState('');
  const [dateStart, setDateStart] = useState('2025-01-01');
  const [dateEnd, setDateEnd] = useState('2025-12-31');
  const [cloudMax, setCloudMax] = useState(20);

  const handleDrawComplete = useCallback((feature) => {
    const geom = feature?.geometry;
    if (geom?.type === 'Polygon' && geom.coordinates?.[0]?.length >= 4) {
      setAoi({ type: 'Polygon', coordinates: geom.coordinates });
      setAoiMode('draw');
      setAoiError('');
    } else {
      setAoiError('Drawn shape must be a valid polygon');
    }
  }, []);

  const handleDrawPolygon = useCallback(() => {
    if (!mapRef?.current) return;
    setAoiMode('draw');
    setAoiError('');
    mapRef.current.activateDraw('polygon');
    mapRef.current.onDrawComplete(handleDrawComplete);
  }, [mapRef, handleDrawComplete]);

  const handleUseView = useCallback(() => {
    if (!mapRef?.current) return;
    const extent = mapRef.current.getViewExtent?.();
    if (!extent) {
      setAoiError('Cannot get map extent');
      return;
    }
    setAoi({ type: 'BBox', bbox: extent });
    setAoiMode('view');
    setAoiError('');
  }, [mapRef]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!aoi) {
      setAoiError('Draw a polygon or use current view');
      return;
    }
    // Collections are backend-owned config (MGP_COLLECTIONS) — the search
    // is universal across whatever the backend is configured for.
    onSearch({ aoi, dateRange: { start: dateStart, end: dateEnd }, cloudMax });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.section}>
        <label className={styles.label}>Area of Interest</label>
        <div className={styles.aoiButtons}>
          <button type="button" className={styles.aoiBtn} onClick={handleDrawPolygon} disabled={loading}>
            Draw Polygon
          </button>
          <button type="button" className={styles.aoiBtn} onClick={handleUseView} disabled={loading}>
            Use Current View
          </button>
        </div>
        {aoi && <p className={styles.aoiInfo}>
          AOI: {aoi.type === 'BBox' ? `BBox [${aoi.bbox.map(n => n.toFixed(3)).join(', ')}]` : `Polygon (${aoi.coordinates[0].length - 1} vertices)`}
        </p>}
        {aoiError && <p className={styles.error}>{aoiError}</p>}
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Date Range</label>
        <div className={styles.dateRow}>
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className={styles.dateInput} />
          <span>to</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className={styles.dateInput} />
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Max Cloud Cover: {cloudMax}%</label>
        <input type="range" min="0" max="100" value={cloudMax} onChange={e => setCloudMax(Number(e.target.value))} className={styles.slider} />
      </div>

      <button type="submit" className={styles.searchBtn} disabled={loading}>
        {loading ? 'Searching...' : 'Search Archive'}
      </button>
    </form>
  );
}
