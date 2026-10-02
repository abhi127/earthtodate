import { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
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

async function polygonFromShapeZip(file) {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.keys(zip.files);
  const find = (ext) => entries.find((n) => n.toLowerCase().endsWith(ext) && !zip.files[n].dir);
  const needed = ['.shp', '.shx', '.dbf'].map(find);
  if (needed.some((n) => !n)) {
    throw new Error('Shapefile .zip must contain .shp, .shx and .dbf');
  }
  const prj = find('.prj');
  const names = [...needed, ...(prj ? [prj] : [])];

  const form = new FormData();
  for (const name of names) {
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
  const [dateStart, setDateStart] = useState('2025-01-01');
  const [dateEnd, setDateEnd] = useState('2025-12-31');
  const [cloudMax, setCloudMax] = useState(20);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const usePolygonAoi = useCallback((coordinates, mode) => {
    setAoi({ type: 'Polygon', coordinates });
    setAoiMode(mode);
    setAoiError('');
    mapRef.current?.addAoiFeature?.({ type: 'Feature', geometry: { type: 'Polygon', coordinates }, properties: {} });
    const bbox = bboxOfPolygon(coordinates);
    mapRef.current?.flyTo?.([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], 11);
  }, [mapRef]);

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
      } else if (ext === 'zip') {
        coordinates = await polygonFromShapeZip(file);
      } else {
        throw new Error('Unsupported file type. Use .geojson, .kml or a shapefile .zip');
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
          <button type="button" className={styles.aoiBtn} onClick={handleDrawPolygon} disabled={loading || importing}>
            Draw Polygon
          </button>
          <button type="button" className={styles.aoiBtn} onClick={handleUseView} disabled={loading || importing}>
            Use Current View
          </button>
          <button type="button" className={styles.aoiBtn} onClick={() => fileRef.current?.click()} disabled={loading || importing}>
            {importing ? 'Reading…' : 'Import File'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,.json,.kml,.zip"
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
