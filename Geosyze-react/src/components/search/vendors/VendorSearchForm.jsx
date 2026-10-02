import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { defaultArchiveRange } from './archiveDefaults.js';
import styles from './VendorSearchForm.module.css';

// AOI helpers: everything normalizes to a 2D GeoJSON Polygon in EPSG:4326.

function stripZ(ring) {
  return ring.map(([x, y]) => [x, y]);
}

function asPolygonCoords(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon' && geometry.coordinates?.[0]?.length >= 4) {
    return geometry.coordinates.map(stripZ);
  }
  if (geometry.type === 'MultiPolygon' && geometry.coordinates?.[0]?.[0]?.length >= 4) {
    return geometry.coordinates[0].map(stripZ);
  }
  return null;
}

function firstPolygonFromGeoJson(doc) {
  const features = doc?.type === 'FeatureCollection' ? doc.features
    : doc?.type === 'Feature' ? [doc]
    : doc?.type ? [{ type: 'Feature', geometry: doc, properties: {} }]
    : [];
  for (const f of features) {
    const coords = asPolygonCoords(f?.geometry);
    if (coords) return coords;
  }
  return null;
}

function firstPolygonFromKml(text) {
  const ol = window.ol;
  if (!ol) throw new Error('Map library not ready');
  const features = new ol.format.KML().readFeatures(text, {
    dataProjection: 'EPSG:4326',
    featureProjection: 'EPSG:4326',
  });
  const writer = new ol.format.GeoJSON();
  for (const f of features) {
    const obj = writer.writeFeatureObject(f);
    const coords = asPolygonCoords(obj?.geometry);
    if (coords) return coords;
  }
  return null;
}

async function polygonFromZipArchive(file) {
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  // KMZ: a zip containing a .kml doc — parse it directly, no backend needed.
  const kmlName = names.find((n) => n.toLowerCase().endsWith('.kml'));
  if (kmlName) {
    return firstPolygonFromKml(await zip.files[kmlName].async('text'));
  }
  const find = (ext) => names.find((n) => n.toLowerCase().endsWith(ext));
  const needed = ['.shp', '.shx', '.dbf'].map(find);
  if (needed.some((n) => !n)) {
    throw new Error('Zip must contain a .kml or shapefile parts (.shp, .shx, .dbf)');
  }
  const prj = find('.prj');
  const parts = [...needed, ...(prj ? [prj] : [])];

  const form = new FormData();
  for (const name of parts) {
    const blob = await zip.files[name].async('blob');
    form.append('files', new File([blob], name.split('/').pop()));
  }
  const token = sessionStorage.getItem('accessToken');
  const res = await fetch('/api/gis/parse', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Please log in again to import shapefiles');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.message || 'Could not parse shapefile');
  }
  return firstPolygonFromGeoJson(data);
}

function bboxOfPolygon(coordinates) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of coordinates) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

export default function VendorSearchForm({ mapRef, onSearch, loading }) {
  const [aoiMode, setAoiMode] = useState(null);
  const [aoi, setAoi] = useState(null);
  const [aoiError, setAoiError] = useState('');
  // Defaults: end = today, start = one calendar month earlier.
  const [dateStart, setDateStart] = useState(() => defaultArchiveRange().start);
  const [dateEnd, setDateEnd] = useState(() => defaultArchiveRange().end);
  const [cloudMax, setCloudMax] = useState(20);
  const [importing, setImporting] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const fileRef = useRef(null);

  const usePolygonAoi = useCallback((coordinates, mode) => {
    setAoi({ type: 'Polygon', coordinates });
    setAoiMode(mode);
    setAoiError('');
    mapRef.current?.addArchivalAoiFeature?.({ type: 'Feature', geometry: { type: 'Polygon', coordinates }, properties: {} });
    const bbox = bboxOfPolygon(coordinates);
    mapRef.current?.flyTo?.([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], 11);
  }, [mapRef]);

  const handleDrawComplete = useCallback((feature) => {
    setDrawing(false);
    const geom = feature?.geometry;
    if (geom?.type === 'Polygon' && geom.coordinates?.[0]?.length >= 4) {
      setAoi({ type: 'Polygon', coordinates: geom.coordinates });
      setAoiMode('draw');
      setAoiError('');
    } else {
      setAoiError('Drawn shape must be a valid polygon');
    }
  }, []);

  // Archival drawing uses the panel-owned AOI layer (not the shared drawing
  // tools), so no draw pill appears and panel close can clear just this AOI.
  // Clicking again while drawing cancels.
  const handleDrawPolygon = useCallback(() => {
    if (!mapRef?.current) return;
    if (drawing) {
      mapRef.current.cancelArchivalDraw?.();
      setDrawing(false);
      return;
    }
    setAoiError('');
    mapRef.current.activateArchivalDraw?.(handleDrawComplete);
    setDrawing(true);
  }, [mapRef, drawing, handleDrawComplete]);

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

  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setAoiError('');
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let coordinates = null;
      if (ext === 'geojson' || ext === 'json') {
        coordinates = firstPolygonFromGeoJson(JSON.parse(await file.text()));
      } else if (ext === 'kml') {
        coordinates = firstPolygonFromKml(await file.text());
      } else if (ext === 'zip' || ext === 'kmz') {
        coordinates = await polygonFromZipArchive(file);
      } else {
        throw new Error('Unsupported file type. Use .geojson, .kml, .kmz or a shapefile .zip');
      }
      if (!coordinates) throw new Error('No polygon found in file');
      usePolygonAoi(coordinates, 'file');
    } catch (err) {
      setAoiError(err.message || 'Could not read file');
    } finally {
      setImporting(false);
    }
  }, [usePolygonAoi]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!aoi) {
      setAoiError('Draw a polygon, use current view, or import a file');
      return;
    }
    // Collections are backend-owned config — the search is universal
    // across all vendors and whatever each backend is configured for.
    onSearch({ aoi, dateRange: { start: dateStart, end: dateEnd }, cloudMax });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.section}>
        <label className={styles.label}>Area of Interest</label>
        <div className={styles.aoiButtons}>
          <button type="button" className={`${styles.aoiBtn} ${drawing ? styles.aoiBtnActive : ''}`} onClick={handleDrawPolygon} disabled={loading || importing} title={drawing ? 'Cancel drawing' : 'Draw polygon'} aria-label={drawing ? 'Cancel drawing' : 'Draw polygon'}>
            {drawing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 22 8.5 18 22 6 22 2 8.5" /></svg>
            )}
          </button>
          <button type="button" className={styles.aoiBtn} onClick={handleUseView} disabled={loading || importing} title="Use current view" aria-label="Use current view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /></svg>
          </button>
          <button type="button" className={styles.aoiBtn} onClick={() => fileRef.current?.click()} disabled={loading || importing} title="Import file (.geojson, .kml, .kmz, shapefile .zip)" aria-label="Import file">
            {importing ? '…' : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><polyline points="6 9 12 3 18 9" /><path d="M4 21h16" /></svg>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,.kml,.kmz,.zip"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        {aoi && <p className={styles.aoiInfo}>
          AOI: {aoi.type === 'BBox' ? `BBox [${aoi.bbox.map(n => n.toFixed(3)).join(', ')}]` : `Polygon (${aoi.coordinates[0].length - 1} vertices${aoiMode === 'file' ? ', from file' : ''})`}
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
