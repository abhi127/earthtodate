import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import JSZip from 'jszip';
import MapOverlay from './MapOverlay';
import MeasureTool from './MeasureTool';
import MapControls from './MapControls';
import MapCompare from './MapCompare';
import SatellitePanel from './SatellitePanel';
import SatelliteLegend from './SatelliteLegend';
import { loadIndiaCompositeLayer } from './indiaCompositeLayer';
import styles from './MapView.module.css';

const BASEMAP_DEFS = [
  // ponytail: static tile URLs for thumbnails — same tile coords across all sources gives visual comparison
  { id: 'osm',       name: 'OSM',     thumbnail: 'https://a.tile.openstreetmap.org/3/4/2.png' },
  { id: 'satellite', name: 'Esri',    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/4/2' },
  { id: 'terrain',   name: 'Terrain', thumbnail: 'https://tile.opentopomap.org/3/4/2.png' },
  { id: 'light',     name: 'CARTO',   thumbnail: 'https://a.basemaps.cartocdn.com/light_all/3/4/2.png' },
  { id: 'streets',   name: 'Streets', thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/3/4/2' },
  { id: 'dark',      name: 'Dark',    thumbnail: 'https://a.basemaps.cartocdn.com/dark_all/3/4/2.png' },
];

const MapView = forwardRef(function MapView({ 
  compareMode, 
  setCompareMode, 
  satellitePanelOpen, 
  setSatellitePanelOpen, 
  satellitePanelOpen2, 
  setSatellitePanelOpen2,
  onCenterChange,
  center: initialCenter
}, ref) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const vectorSource = useRef(null);
  const basemapRefs = useRef({});
  const [center, setCenter] = useState(initialCenter ?? { lat: 20.5937, lon: 78.9629 });
  const drawInteractionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [coords, setCoords] = useState('Lon: \u2014  Lat: \u2014');
  const [zoom, setZoom] = useState('Zoom: \u2014');
  const [resolution, setResolution] = useState('Res: \u2014');
  const [activeBasemap, setActiveBasemap] = useState('osm');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [drawType, setDrawType] = useState(null);
  const [pillExportOpen, setPillExportOpen] = useState(false);
  const [satCategory, setSatCategory] = useState('visual');
  const cancelMeasureRef = useRef(null);
  const switcherRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const satelliteLayerRef2 = useRef(null);
  const map2Ref = useRef(null);

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    function handleClick(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [switcherOpen]);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !mapRef.current) return;

    vectorSource.current = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource.current });

    const layers = {
      osm: new ol.layer.Tile({ source: new ol.source.OSM(), visible: true }),
      satellite: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: '&copy; Esri',
        }),
        visible: false,
      }),
      terrain: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
          maxZoom: 17,
          attributions: '&copy; OpenTopoMap',
        }),
        visible: false,
      }),
      light: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          maxZoom: 19,
          attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
        }),
        visible: false,
      }),
      streets: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: '&copy; Esri',
        }),
        visible: false,
      }),
      dark: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          maxZoom: 19,
          attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
        }),
        visible: false,
      }),
    };
    basemapRefs.current = layers;

    const map = new ol.Map({
      target: mapRef.current,
      layers: [layers.osm, layers.satellite, layers.terrain, layers.light, layers.streets, layers.dark, vectorLayer],
      view: new ol.View({
        center: ol.proj.fromLonLat([78.9629, 20.5937]),
        zoom: 5,
      }),
      controls: new ol.Collection([
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.ScaleLine(),
      ]),
    });

    mapInstance.current = map;
    setMapReady(true);
    loadIndiaCompositeLayer(map);

    map.on('pointermove', (e) => {
      if (e.coordinate) {
        const ll = ol.proj.toLonLat(e.coordinate);
        setCoords(`Lon: ${ll[0].toFixed(4)}\u00b0  Lat: ${ll[1].toFixed(4)}\u00b0`);
      }
    });

    map.getView().on('change:resolution', () => {
      const view = map.getView();
      setZoom(`Zoom: ${view.getZoom().toFixed(1)}`);
      setResolution(`Res: ${view.getResolution().toFixed(2)} m/px`);
    });

    // Track center changes for calendar API
    let centerTimeout;
    const handleCenterChange = () => {
      clearTimeout(centerTimeout);
      centerTimeout = setTimeout(() => {
        const view = map.getView();
        const center = view.getCenter();
        if (center) {
          const ll = ol.proj.toLonLat(center);
          const newCenter = { lat: ll[1], lon: ll[0] };
          setCenter(newCenter);
          if (onCenterChange) {
            onCenterChange([ll[0], ll[1]]);
          }
        }
      }, 150); // debounce
    };
    map.getView().on('change:center', handleCenterChange);

    return () => {
      clearTimeout(centerTimeout);
      map.getView().un('change:center', handleCenterChange);
      map.setTarget(null);
      mapInstance.current = null;
      setMapReady(false);
    };
  }, [onCenterChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchBasemap = useCallback((val) => {
    const layers = Object.values(basemapRefs.current).filter(Boolean);
    if (!layers.length) return;
    layers.forEach((l) => l.setVisible(false));
    if (basemapRefs.current[val]) basemapRefs.current[val].setVisible(true);
    setActiveBasemap(val);
    setSwitcherOpen(false);
  }, []);

  // Cancel any active draw (called by MeasureTool before starting)
  const handleBeforeMeasureStart = useCallback(() => {
    if (drawInteractionRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    setDrawType(null);
  }, []);

  // Extracted so both imperative handle and pill can call it
  const deactivateDraw = useCallback(() => {
    if (drawInteractionRef.current && mapInstance.current) {
      mapInstance.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    setDrawType(null);
    setPillExportOpen(false);
  }, []);

  // ── download helper ─────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── CSV export helper ────────────────────────────────────────────────
  function featuresToCSV(features, ol) {
    const rows = [['WKT', 'ID']];
    features.forEach((f, i) => {
      const wkt = new ol.format.WKT().writeFeature(f, { featureProjection: 'EPSG:3857' });
      // Escape WKT if it contains commas or quotes
      const escaped = wkt.includes(',') || wkt.includes('"') ? `"${wkt.replace(/"/g, '""')}"` : wkt;
      rows.push([escaped, `${i + 1}`]);
    });
    return rows.map(r => r.join(',')).join('\n');
  }

  // ── shapefile binary writer ─────────────────────────────────────────
  // ponytail: minimal writer for Point / LineString / Polygon in EPSG:4326
  function writeShpHeader(dataView, fileLength, shapeType, bounds) {
    const dv = dataView;
    dv.setInt32(0, 9994, false);            // file code (big-endian)
    // bytes 4-23: 5 unused int32s
    for (let i = 4; i < 24; i += 4) dv.setInt32(i, 0, false);
    dv.setInt32(24, fileLength, false);     // file length in 16-bit words (big-endian)
    dv.setInt32(28, 1000, true);            // version (little-endian)
    dv.setInt32(32, shapeType, true);       // shape type (little-endian)
    dv.setFloat64(36, bounds.xMin, true);   // Xmin
    dv.setFloat64(44, bounds.yMin, true);   // Ymin
    dv.setFloat64(52, bounds.xMax, true);   // Xmax
    dv.setFloat64(60, bounds.yMax, true);   // Ymax
    dv.setFloat64(68, 0, true);             // Zmin
    dv.setFloat64(76, 0, true);             // Zmax
    dv.setFloat64(84, 0, true);             // Mmin
    dv.setFloat64(92, 0, true);             // Mmax
  }

  function shpContentLength(geom) {
    const type = geom.getType();
    if (type === 'Point') return 20;        // shapeType(4) + X(8) + Y(8) = 20 bytes
    const coords = geom.getCoordinates();
    const n = type === 'Polygon' ? coords[0].length : coords.length;
    if (type === 'LineString') return 4 + 32 + 4 + 4 + 4 + n * 16;  // type+box+1part+1part+npoints+npts*16
    if (type === 'Polygon') return 4 + 32 + 4 + 4 + 4 + n * 16;
    return 0;
  }

  function writeShpRecord(dv, offset, geom) {
    const type = geom.getType();
    const coords4326 = geom.clone().transform('EPSG:3857', 'EPSG:4326').getCoordinates();
    let pos = offset;

    if (type === 'Point') {
      dv.setInt32(pos, 1, true); pos += 4;  // shapeType Point
      dv.setFloat64(pos, coords4326[0], true); pos += 8;
      dv.setFloat64(pos, coords4326[1], true); pos += 8;
    } else if (type === 'LineString') {
      const pts = coords4326;
      const n = pts.length;
      // box
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
      for (const p of pts) { xMin = Math.min(xMin, p[0]); yMin = Math.min(yMin, p[1]); xMax = Math.max(xMax, p[0]); yMax = Math.max(yMax, p[1]); }
      dv.setInt32(pos, 3, true); pos += 4;  // shapeType PolyLine
      dv.setFloat64(pos, xMin, true); pos += 8;
      dv.setFloat64(pos, yMin, true); pos += 8;
      dv.setFloat64(pos, xMax, true); pos += 8;
      dv.setFloat64(pos, yMax, true); pos += 8;
      dv.setInt32(pos, 1, true); pos += 4;  // numParts
      dv.setInt32(pos, n, true); pos += 4;  // numPoints
      dv.setInt32(pos, 0, true); pos += 4;  // parts[0]
      for (const p of pts) { dv.setFloat64(pos, p[0], true); pos += 8; dv.setFloat64(pos, p[1], true); pos += 8; }
    } else if (type === 'Polygon') {
      const ring = coords4326[0];             // exterior ring
      const n = ring.length;
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
      for (const p of ring) { xMin = Math.min(xMin, p[0]); yMin = Math.min(yMin, p[1]); xMax = Math.max(xMax, p[0]); yMax = Math.max(yMax, p[1]); }
      dv.setInt32(pos, 5, true); pos += 4;  // shapeType Polygon
      dv.setFloat64(pos, xMin, true); pos += 8;
      dv.setFloat64(pos, yMin, true); pos += 8;
      dv.setFloat64(pos, xMax, true); pos += 8;
      dv.setFloat64(pos, yMax, true); pos += 8;
      dv.setInt32(pos, 1, true); pos += 4;  // numParts
      dv.setInt32(pos, n, true); pos += 4;  // numPoints
      dv.setInt32(pos, 0, true); pos += 4;  // parts[0]
      for (const p of ring) { dv.setFloat64(pos, p[0], true); pos += 8; dv.setFloat64(pos, p[1], true); pos += 8; }
    }
    return pos;
  }

  async function exportShapefile(features) {
    const ol = window.ol;
    if (!ol || !features.length) return;

    const zip = new JSZip();
    const geoms = features.map(f => f.getGeometry());

    // Compute bounds across all features
    const allBounds = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity };
    for (const g of geoms) {
      const cloned = g.clone().transform('EPSG:3857', 'EPSG:4326');
      const ext = cloned.getExtent();
      allBounds.xMin = Math.min(allBounds.xMin, ext[0]);
      allBounds.yMin = Math.min(allBounds.yMin, ext[1]);
      allBounds.xMax = Math.max(allBounds.xMax, ext[2]);
      allBounds.yMax = Math.max(allBounds.yMax, ext[3]);
    }

    // Determine shape type from first feature
    const firstType = geoms[0].getType();
    let shapeType;
    if (firstType === 'Point') shapeType = 1;
    else if (firstType === 'LineString') shapeType = 3;
    else shapeType = 5; // Polygon

    // Compute file sizes
    let shpContentSize = 0;
    const contentLengths = [];
    for (const g of geoms) {
      const cl = shpContentLength(g);
      contentLengths.push(cl);
      shpContentSize += 8 + cl; // 8 byte record header + content
    }
    const shpFileLengthWords = Math.ceil((100 + shpContentSize) / 2);

    // Write .shp
    const shpBuf = new ArrayBuffer(100 + shpContentSize);
    const shpDv = new DataView(shpBuf);
    writeShpHeader(shpDv, shpFileLengthWords, shapeType, allBounds);
    let offset = 100;
    for (let i = 0; i < geoms.length; i++) {
      const cl = contentLengths[i];
      shpDv.setInt32(offset, i + 1, false); offset += 4;  // record number (big-endian)
      shpDv.setInt32(offset, cl / 2, false); offset += 4; // content length in words (big-endian)
      offset = writeShpRecord(shpDv, offset, geoms[i]);
    }
    zip.file('export.shp', shpBuf);

    // Write .shx
    const shxHeaderSize = 100;
    const shxRecordSize = 8; // offset(4) + contentLength(4)
    const shxTotalSize = shxHeaderSize + geoms.length * shxRecordSize;
    const shxFileLengthWords = shxTotalSize / 2;
    const shxBuf = new ArrayBuffer(shxTotalSize);
    const shxDv = new DataView(shxBuf);
    writeShpHeader(shxDv, shxFileLengthWords, shapeType, allBounds);
    let recOffset = 50; // 100 bytes / 2 = 50 words
    for (let i = 0; i < geoms.length; i++) {
      shxDv.setInt32(100 + i * 8, recOffset, false);       // offset in words (big-endian)
      shxDv.setInt32(100 + i * 8 + 4, contentLengths[i] / 2, false); // content length in words (big-endian)
      recOffset += (8 + contentLengths[i]) / 2;             // 8 byte record header + content
    }
    zip.file('export.shx', shxBuf);

    // Write .dbf (minimal: FID field only)
    const numFields = 1;
    const headerLen = 32 + numFields * 32 + 1;
    const recLen = 1 + 10; // deletion marker + 10 char FID
    const dbfBuf = new ArrayBuffer(headerLen + features.length * recLen);
    const dbfDv = new DataView(dbfBuf);
    dbfDv.setUint8(0, 3);                      // dBASE III no memo
    dbfDv.setUint8(1, 25); dbfDv.setUint8(2, 7); dbfDv.setUint8(3, 20); // date
    dbfDv.setUint32(4, features.length, true); // number of records
    dbfDv.setUint16(8, headerLen, true);       // header length
    dbfDv.setUint16(10, recLen, true);         // record length
    // Field descriptor: FID (N, 10, 0)
    const enc = new TextEncoder();
    const fname = new Uint8Array(11); enc.encodeInto('FID', fname);
    for (let i = 0; i < 11; i++) dbfDv.setUint8(32 + i, fname[i]);
    dbfDv.setUint8(32 + 11, 78);               // 'N' = numeric
    dbfDv.setUint32(32 + 12, 0, true);         // field address
    dbfDv.setUint8(32 + 16, 10);               // field length
    dbfDv.setUint8(32 + 17, 0);                // decimal count
    dbfDv.setUint8(headerLen - 1, 0x0D);        // field terminator
    // Records
    for (let i = 0; i < features.length; i++) {
      const recOff = headerLen + i * recLen;
      dbfDv.setUint8(recOff, 0x20);            // not deleted
      const fidStr = `${i + 1}`.padStart(10, ' ').slice(0, 10);
      for (let j = 0; j < 10; j++) dbfDv.setUint8(recOff + 1 + j, fidStr.charCodeAt(j));
    }
    zip.file('export.dbf', dbfBuf);

    // Write .prj
    zip.file('export.prj', `GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]`);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'export-shapefile.zip');
  }

  // ── main export dispatcher ──────────────────────────────────────────
  const exportFeatures = useCallback((format) => {
    const ol = window.ol;
    if (!ol || !vectorSource.current) return;
    const features = vectorSource.current.getFeatures();
    if (!features.length) return;

    let content, filename, mimeType;
    switch (format) {
      case 'geojson':
        content = new ol.format.GeoJSON().writeFeatures(features, { featureProjection: 'EPSG:3857' });
        filename = 'export.geojson'; mimeType = 'application/geo+json';
        break;
      case 'kml':
        content = new ol.format.KML().writeFeatures(features, { featureProjection: 'EPSG:3857' });
        filename = 'export.kml'; mimeType = 'application/vnd.google-earth.kml+xml';
        break;
      case 'gpx':
        content = new ol.format.GPX().writeFeatures(features, { featureProjection: 'EPSG:3857' });
        filename = 'export.gpx'; mimeType = 'application/gpx+xml';
        break;
      case 'wkt':
        content = features.map(f => new ol.format.WKT().writeFeature(f, { featureProjection: 'EPSG:3857' })).join('\n');
        filename = 'export.wkt'; mimeType = 'text/plain';
        break;
      case 'csv':
        content = featuresToCSV(features, ol);
        filename = 'export.csv'; mimeType = 'text/csv';
        break;
      case 'shapefile':
        exportShapefile(features);
        return; // async, handles its own download
      default:
        return;
    }
    downloadBlob(new Blob([content], { type: mimeType }), filename);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    setBasemap: switchBasemap,
    exportFeatures,
    deactivateDraw,

    activateDraw(type) {
      cancelMeasureRef.current?.();
      deactivateDraw();
      const ol = window.ol;
      if (!ol || !mapInstance.current || !vectorSource.current) return;
      const geomMap = { point: 'Point', line: 'LineString', polygon: 'Polygon' };
      const draw = new ol.interaction.Draw({
        source: vectorSource.current,
        type: geomMap[type],
      });
      drawInteractionRef.current = draw;
      mapInstance.current.addInteraction(draw);
      setDrawType(type);
    },

    clearAll() {
      if (vectorSource.current) vectorSource.current.clear();
      deactivateDraw();
    },

    flyTo(lngLat, zoom = 16) {
      const ol = window.ol;
      const map = mapInstance.current;
      if (!ol || !map || !lngLat) return;
      map.getView().animate({
        center: ol.proj.fromLonLat(lngLat),
        zoom,
        duration: 600,
      });
    },
  }));

  // ── Satellite tile layer management ───────────────────────────────

  // For r5m_tci ("5m Combined"): resolve to actual source (s2r5m_tci or ls5_tci)
  const r5mActualRef = useRef(null);
  const r5mActualRef2 = useRef(null);

  async function resolveR5mViewtype(viewtype, date, r5mRef) {
    if (viewtype !== 'r5m_tci') return viewtype;
    const ol = window.ol;
    const map = mapInstance.current;
    if (!ol || !map) return viewtype;
    const center = ol.proj.toLonLat(map.getView().getCenter());
    const lat = center[1].toFixed(4);
    const lon = center[0].toFixed(4);
    try {
      const [s2Resp, lsResp] = await Promise.all([
        fetch(`/api/tiles/dates/${lat},${lon}/s2r5m_tci/${date}/365/100`).then(r => r.json()).catch(() => []),
        fetch(`/api/tiles/dates/${lat},${lon}/ls5_tci/${date}/365/100`).then(r => r.json()).catch(() => [])
      ]);
      // Merge: same date, pick lower clouds
      const merged = {};
      (s2Resp || []).forEach(d => { merged[d[0]] = { date: d[0], source: 's2r5m_tci', clouds: parseFloat(d[1]) }; });
      (lsResp || []).forEach(d => {
        if (!merged[d[0]] || parseFloat(d[1]) < merged[d[0]].clouds)
          merged[d[0]] = { date: d[0], source: 'ls5_tci', clouds: parseFloat(d[1]) };
      });
      const sorted = Object.values(merged).sort((a, b) => b.date.localeCompare(a.date));
      if (sorted.length > 0) { r5mRef.current = sorted[0].source; return sorted[0].source; }
    } catch (e) { /* fallback */ }
    r5mRef.current = 's2r5m_tci';
    return 's2r5m_tci';
  }

  function createSatelliteSource(viewtype, date, months) {
    const ol = window.ol;
    if (!ol) return null;
    const params = new URLSearchParams({ end_date: date, days_back: '1', max_clouds: '100' });
    if (months) params.set('months', String(months));

    // Pollution tiles use a separate backend route
    const isPollution = viewtype.startsWith('pollution') && viewtype.endsWith('_overlay');
    const basePath = isPollution ? '/api/tiles/pollution' : '/api/tiles/v2';

    return new ol.source.XYZ({
      url: basePath + '/' + viewtype + '/{z}/{x}/{y}?' + params.toString(),
      maxZoom: 21,
      attributions: '&copy; Earth to Date',
    });
  }

  function setSatelliteLayer(mapInstance, ref, viewtype, date, months) {
    const ol = window.ol;
    if (!mapInstance || !ol) return;
    // Remove old layer
    if (ref.current) { mapInstance.removeLayer(ref.current); ref.current = null; }
    if (!viewtype) return;
    const source = createSatelliteSource(viewtype, date, months);
    if (!source) return;
    const layer = new ol.layer.Tile({ source, visible: true });
    // Insert above basemaps but below vector layer
    const layers = mapInstance.getLayers();
    const vecIdx = layers.getArray().findIndex(l => l instanceof ol.layer.Vector);
    layers.insertAt(vecIdx >= 0 ? vecIdx : layers.getLength(), layer);
    ref.current = layer;
  }

  function removeSatelliteLayer(mapInstance, ref) {
    if (!mapInstance || !ref.current) return;
    mapInstance.removeLayer(ref.current);
    ref.current = null;
  }

  // Track latest values from satellite panel
  const satelliteStateRef = useRef({ viewtype: 's2_tci', date: new Date().toISOString().slice(0, 10), months: undefined });
  const satelliteStateRef2 = useRef({ viewtype: 's2_tci', date: new Date().toISOString().slice(0, 10), months: undefined });

  const handleSatelliteViewtype = useCallback(async ({ viewtype, date, months }) => {
    satelliteStateRef.current = { viewtype, date, months };
    if (!satellitePanelOpen) return;
    const actual = await resolveR5mViewtype(viewtype, date, r5mActualRef);
    setSatelliteLayer(mapInstance.current, satelliteLayerRef, actual, date, months);
  }, [satellitePanelOpen]);
  const handleSatelliteViewtype2 = useCallback(async ({ viewtype, date, months }) => {
    satelliteStateRef2.current = { viewtype, date, months };
    if (!satellitePanelOpen2) return;
    const actual = await resolveR5mViewtype(viewtype, date, r5mActualRef2);
    setSatelliteLayer(map2Ref.current || mapInstance.current, satelliteLayerRef2, actual, date, months);
  }, [satellitePanelOpen2]);

  // Show/hide satellite layers when panels open/close
  // For r5m_tci: skip here, handled async above
  useEffect(() => {
    if (satellitePanelOpen) {
      mapInstance.current?.getView().animate({ zoom: 16, duration: 500 });
      const s = satelliteStateRef.current;
      if (s.viewtype !== 'r5m_tci') setSatelliteLayer(mapInstance.current, satelliteLayerRef, s.viewtype, s.date, s.months);
    } else {
      removeSatelliteLayer(mapInstance.current, satelliteLayerRef);
    }
  }, [satellitePanelOpen]);

  useEffect(() => {
    const target = map2Ref.current || mapInstance.current;
    if (satellitePanelOpen2) {
      const s = satelliteStateRef2.current;
      if (s.viewtype !== 'r5m_tci') setSatelliteLayer(target, satelliteLayerRef2, s.viewtype, s.date, s.months);
    } else {
      removeSatelliteLayer(target, satelliteLayerRef2);
    }
  }, [satellitePanelOpen2]);

  // Close pill export dropdown on outside click
  useEffect(() => {
    if (!pillExportOpen) return;
    function handleClick(e) {
      if (!e.target.closest(`.${styles.drawPill}`)) setPillExportOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pillExportOpen]);

  // Clean up draw/measure when entering compare mode (from any toggle source)
  useEffect(() => {
    if (compareMode) { cancelMeasureRef.current?.(); deactivateDraw(); }
  }, [compareMode]);

  // Call updateSize when compare mode changes (map container resizes)
  // Wrap in rAF so layout settles before OL reads element dimensions
  useEffect(() => {
    if (!mapInstance.current) return;
    let id = requestAnimationFrame(() => mapInstance.current.updateSize());
    return () => cancelAnimationFrame(id);
  }, [compareMode]);

  let containerClass = styles.container;
  if (satellitePanelOpen && !compareMode) containerClass += ` ${styles.satelliteOpen}`;
  if (compareMode === 'compare') containerClass += ` ${styles.compareActive}`;
  else if (compareMode === 'swipe') containerClass += ` ${styles.compareActive} ${styles.compareSwipeMode}`;

  return (
    <div className={containerClass}>
      <div ref={mapRef} className={styles.map}></div>
      <MapOverlay coords={coords} zoom={zoom} resolution={resolution} docked={satellitePanelOpen} />
      {mapReady && <MeasureTool map={mapInstance.current} measureCancelRef={cancelMeasureRef} onBeforeMeasureStart={handleBeforeMeasureStart} />}
      {mapReady && <MapControls map={mapInstance.current} />}
      {mapReady && (
        <MapCompare
          map={mapInstance.current}
          mode={compareMode}
          basemapRefs={basemapRefs.current}
          activeBasemap={activeBasemap}
          onToggle={setCompareMode}
          onMap2Ready={m2 => { map2Ref.current = m2; }}
        />
      )}

      {drawType && (
        <div className={styles.drawPill}>
          <span className={styles.pillDot} />
          <span className={styles.drawPillLabel}>Drawing {drawType.charAt(0).toUpperCase() + drawType.slice(1)}</span>
          <div className={styles.drawPillDivider} />
          <div className={styles.pillExportWrap}>
            <button className={styles.pillExportBtn} onClick={() => setPillExportOpen(o => !o)} title="Export features">
              Export
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {pillExportOpen && (
              <div className={styles.pillExportMenu}>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('geojson'); }}>GeoJSON</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('kml'); }}>KML</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('gpx'); }}>GPX</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('csv'); }}>CSV</button>
                <button onClick={() => { setPillExportOpen(false); exportFeatures('wkt'); }}>WKT</button>
                <div className={styles.pillExportSep} />
                <button onClick={() => { setPillExportOpen(false); exportFeatures('shapefile'); }}>Shapefile (.zip)</button>
              </div>
            )}
          </div>
          <button className={styles.drawPillClose} onClick={deactivateDraw} title="Cancel draw">&times;</button>
        </div>
      )}
      <SatellitePanel
        open={satellitePanelOpen}
        onViewtypeChange={handleSatelliteViewtype}
        lat={center?.lat ?? 20.5937}
        lon={center?.lon ?? 78.9629}
        category={satCategory}
        onCategoryChange={setSatCategory}
      />
      {satellitePanelOpen && <SatelliteLegend viewtype={satelliteStateRef.current.viewtype} docked />}
      {compareMode && (
        <SatellitePanel
          open={satellitePanelOpen2}
          onViewtypeChange={handleSatelliteViewtype2}
          right
          lat={center?.lat ?? 20.5937}
          lon={center?.lon ?? 78.9629}
          category={satCategory}
          onCategoryChange={setSatCategory}
        />
      )}
      {compareMode && satellitePanelOpen2 && <SatelliteLegend viewtype={satelliteStateRef2.current.viewtype} right />}
      {mapReady && !compareMode && (() => {
        const currentBm = BASEMAP_DEFS.find(b => b.id === activeBasemap);
        return (
          <div className={styles.switcherWrapper} ref={switcherRef}>
            {switcherOpen ? (
              <div className={styles.gallery}>
                {BASEMAP_DEFS.map(bm => (
                  <button
                    key={bm.id}
                    className={`${styles.thumb} ${activeBasemap === bm.id ? styles.thumbActive : ''}`}
                    onClick={() => switchBasemap(bm.id)}
                    title={bm.name}
                    style={{ backgroundImage: `url(${bm.thumbnail})` }}
                  >
                    <span className={styles.thumbLabel}>{bm.name}</span>
                    {activeBasemap === bm.id && <span className={styles.thumbCheck}>✓</span>}
                  </button>
                ))}
              </div>
            ) : (
              <button className={styles.compactBtn} onClick={() => setSwitcherOpen(true)} title="Switch basemap">
                <span className={styles.compactThumb} style={{ backgroundImage: `url(${currentBm?.thumbnail})` }} />
                <span className={styles.compactLabel}>{currentBm?.name}</span>
                <svg className={styles.compactIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
});

export default MapView;
