import { useState, useCallback } from 'react';
import styles from './MgpProSearchForm.module.css';

const COLLECTIONS = [
  { id: 'wv01', label: 'WV01' },
  { id: 'wv02', label: 'WV02' },
  { id: 'wv03', label: 'WV03' },
  { id: 'wv04', label: 'WV04' },
  { id: 'ge01', label: 'GE01' },
  { id: 'qb02', label: 'QB02' },
];

export default function MgpProSearchForm({ mapRef, onSearch, loading }) {
  const [aoiMode, setAoiMode] = useState(null);
  const [aoi, setAoi] = useState(null);
  const [aoiError, setAoiError] = useState('');
  const [dateStart, setDateStart] = useState('2025-01-01');
  const [dateEnd, setDateEnd] = useState('2025-12-31');
  const [cloudMax, setCloudMax] = useState(20);
  const [collections, setCollections] = useState(['wv02', 'wv03']);

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

  const handleDrawComplete = useCallback((geojson) => {
    if (geojson?.type === 'Polygon' && geojson.coordinates?.[0]?.length >= 4) {
      setAoi({ type: 'Polygon', coordinates: geojson.coordinates });
      setAoiMode('draw');
      setAoiError('');
    } else {
      setAoiError('Drawn shape must be a valid polygon');
    }
  }, []);

  const handleCollectionToggle = (id) => {
    setCollections(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!aoi) {
      setAoiError('Draw a polygon or use current view');
      return;
    }
    if (collections.length === 0) {
      setAoiError('Select at least one collection');
      return;
    }
    onSearch({ aoi, dateRange: { start: dateStart, end: dateEnd }, cloudMax, collections });
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

      <div className={styles.section}>
        <label className={styles.label}>Collections</label>
        <div className={styles.checkboxRow}>
          {COLLECTIONS.map(c => (
            <label key={c.id} className={styles.checkbox}>
              <input type="checkbox" checked={collections.includes(c.id)} onChange={() => handleCollectionToggle(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className={styles.searchBtn} disabled={loading}>
        {loading ? 'Searching...' : 'Search Archive'}
      </button>
    </form>
  );
}
