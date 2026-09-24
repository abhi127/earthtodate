import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import JSZip from 'jszip';
import MapOverlay from './MapOverlay';
import MeasureTool from './MeasureTool';
import MapControls from './MapControls';
import MapCompare from './MapCompare';
import LayerInspector from './LayerInspector';
import SatellitePanel from './SatellitePanel';
import SatelliteLegend from './SatelliteLegend';
import { loadIndiaCompositeLayer } from './indiaCompositeLayer';
import { SATELLITE_PANEL_START, SATELLITE_OPEN_RESOLUTION } from './satelliteDefaults';
import { resolveLayout } from './mapCount';
import {Tile} from 'ol/layer'
import styles from './MapView.module.css';

// ponytail: coalesced satellite tile loader. Pan/zoom bursts ask OL to fetch many
// tiles at once; we hold them back (debounced) until the map has been still for
// STILL_DELAY ms, then flush at MAX_CONCURRENT_TILES fetches at a time. Debounce
// prevents firing a flood of requests mid-gesture; the concurrency cap bounds the
// post-still burst. Each tile is loaded into its own image exactly as OL's
// documented custom tileLoadFunction expects (no clobbering of OL's load/error
// listeners), so removed layers clean up instead of leaving a ghost layer.
const MAX_CONCURRENT_TILES = 6;
const STILL_DELAY = 300;
// Satellite products are unavailable below z12. The source tile grid alone does
// not enforce that floor: OpenLayers clamps the selected tile zoom to minZoom,
// so a z9.9 view would otherwise keep requesting z12 tiles.
const SATELLITE_MIN_ZOOM = 12;
const SATELLITE_MAX_ZOOM = 21;
let satActive = 0;
let satStill = false;
let satTimer = null;
const satQueue = [];

// Reset/arm the "still" window: every new tile request pushes the quiet start
// out by STILL_DELAY, so nothing fetches until the map stops moving.
function satArm() {
  satStill = false;
  clearTimeout(satTimer);
  satTimer = setTimeout(() => {
    satStill = true;
    satTick();
  }, STILL_DELAY);
}

// Start queued fetches — only when the map is still AND a slot is free.
function satTick() {
  while (satStill && satActive < MAX_CONCURRENT_TILES && satQueue.length) {
    const run = satQueue.shift();
    satActive++;
    run();
  }
}

function satWait() {
  satArm();
  return new Promise((resolve) => {
    satQueue.push(resolve);
    satTick();
  });
}
function satRelease() {
  satActive--;
  satTick();
}

// Tiles that failed (no imagery / upstream error). OL re-requests the same
// tile whenever it becomes visible again (pan, zoom, layer churn), so remember
// failures and short-circuit to a transparent tile instead of re-hitting the
// network each time.
const tileFailCache = new Set();
// A real 1×1 RGBA pixel with alpha 0. The previous value was half-green and
// OpenLayers scaled it across the whole tile during loading/abort transitions.
const TRANSPARENT_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

function abortError() {
  const error = new Error('Satellite tile request superseded');
  error.name = 'AbortError';
  return error;
}

function satelliteTileLoadFunction(tile, src, requestContext) {
  const image = tile.getImage();

  if (tileFailCache.has(src)) {
    image.src = TRANSPARENT_TILE;
    return;
  }

  satWait()
    .then(() => {
      // The layer may have been removed, replaced, or zoomed below its product
      // floor while this tile waited in the debounce queue. Do not turn that
      // stale queue entry into a server request.
      if (!requestContext.active) throw abortError();

      const controller = new AbortController();
      requestContext.controllers.add(controller);
      return fetch(src, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then((blob) => {
          if (!requestContext.active) throw abortError();
          const url = URL.createObjectURL(blob);
          // OpenLayers attaches its own load/error listeners (addEventListener)
          // before this resolves, so only set img.src and let it finalize the tile.
          image.src = url;
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        })
        .finally(() => requestContext.controllers.delete(controller));
    })
    .catch((err) => {
      // Fire OpenLayers' image error listener (via addEventListener) so the
      // tile finals as ERROR instead of hanging in LOADING; hanging LOADING
      // tiles are what leave a stale/ghost layer behind. Aborted/stale tiles
      // belong to a source that has already been removed, so finalize them as
      // transparent without recording a server failure.
      if (err?.name === 'AbortError') {
        image.src = TRANSPARENT_TILE;
      } else {
        tileFailCache.add(src);
        image.dispatchEvent(new Event('error'));
      }
    })
    .finally(satRelease);
}

const MapView = forwardRef(function MapView({
  layoutMode,
  onLayoutChange,
  extraIds,
  onAddMap,
  onRemoveMap,
  onRemoveAllExtras,
  satellitePanelOpen,
  setSatellitePanelOpen,
  extraSatOpen,
  onBasemapChange,
  satCategory,
  onSatCategoryChange
}, ref) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const vectorSource = useRef(null);
  const basemapRefs = useRef({});
  const drawInteractionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [coords, setCoords] = useState('Lon: \u2014  Lat: \u2014');
  const [zoom, setZoom] = useState('Zoom: \u2014');
  const [resolution, setResolution] = useState('Res: \u2014');
  const [activeBasemap, setActiveBasemap] = useState('osm');
  // DOM node inside the MapControls stack that MeasureTool portals its button into
  const [measureSlot, setMeasureSlot] = useState(null);
  const [drawType, setDrawType] = useState(null);
  const [pillExportOpen, setPillExportOpen] = useState(false);
  const [layerInspectorOpen, setLayerInspectorOpen] = useState(false);
  const cancelMeasureRef = useRef(null);
  const satelliteLayerRef = useRef(null);
  const satelliteRequestContextRef = useRef(null);
  const satPanelInitialPanRef = useRef(false);
  // Extra maps (compare views) + per-map satellite state, keyed by stable id.
  // The main map always exists; extras come and go via extraIds.
  const extraMapsRef = useRef(new Map()); // id -> ol.Map
  const [extraMapsTick, setExtraMapsTick] = useState(0);
  const extraSatLayers = useRef(new Map());   // id -> Tile layer
  const extraSatContexts = useRef(new Map()); // id -> request context
  const extraR5mActual = useRef(new Map());   // id -> resolved r5m source
  const extraSatStates = useRef(new Map());   // id -> { viewtype, date, months }
  const extraSatHandlers = useRef(new Map()); // id -> stable onViewtypeChange
  const [satTick, setSatTick] = useState(0);  // re-render legends on sat change
  const mapCount = 1 + (extraIds?.length ?? 0);
  const hasExtras = mapCount > 1;

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
      sentinel: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg',
          maxZoom: 14,
          attributions: 'Sentinel-2 cloudless - <a href="https://s2maps.eu">EOX</a> (Contains modified Copernicus Sentinel data)',
        }),
        visible: false,
      }),
    };
    basemapRefs.current = layers;

    const basemapNames = {
      osm: 'OSM',
      satellite: 'Esri',
      terrain: 'Terrain',
      light: 'CARTO',
      streets: 'Streets',
      dark: 'Dark',
      sentinel: 'Sentinel',
    };
    Object.entries(layers).forEach(([id, layer]) => {
      layer.set('inspectorName', `Basemap: ${basemapNames[id]}`);
      layer.set('inspectorCategory', 'Basemap');
      layer.set('basemapId', id);
    });
    vectorLayer.set('inspectorName', 'Drawn features');
    vectorLayer.set('inspectorCategory', 'Vector');

    const map = new ol.Map({
      target: mapRef.current,
      layers: [layers.osm, layers.satellite, layers.terrain, layers.light, layers.streets, layers.dark, layers.sentinel, vectorLayer],
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

    return () => {
      disposeRequestContext(satelliteRequestContextRef);
      for (const ctx of extraSatContexts.current.values()) {
        try { ctx.active = false; ctx.controllers.forEach(c => c.abort()); ctx.controllers.clear(); } catch {}
      }
      extraSatContexts.current.clear();
      map.setTarget(null);
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchBasemap = useCallback((val) => {
    const layers = Object.values(basemapRefs.current).filter(Boolean);
    if (!layers.length) return;
    layers.forEach((l) => l.setVisible(false));
    if (basemapRefs.current[val]) basemapRefs.current[val].setVisible(true);
    setActiveBasemap(val);
    onBasemapChange?.(val);
  }, [onBasemapChange]);

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

  async function resolveR5mViewtype(viewtype, date, r5mRef) {
    if (viewtype !== 'r5m_tci') return viewtype;
    const { lat, lon } = SATELLITE_PANEL_START;
    const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    try {
      const [s2Resp, lsResp] = await Promise.all([
        fetch(`/api/tiles/dates/${location}/s2r5m_tci/${date}/365/100`).then(r => r.json()).catch(() => []),
        fetch(`/api/tiles/dates/${location}/ls5_tci/${date}/365/100`).then(r => r.json()).catch(() => [])
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

  function createSatelliteSource(viewtype, date, months, requestContext) {
    const ol = window.ol;
    if (!ol) return null;
    const params = new URLSearchParams({ end_date: date, days_back: '1', max_clouds: '100' });
    if (months) params.set('months', String(months));

    // Pollution tiles use a separate backend route
    const isPollution = viewtype.startsWith('pollution') && viewtype.endsWith('_overlay');
    const basePath = isPollution ? '/api/tiles/pollution' : '/api/tiles/v2';

    return new ol.source.XYZ({
      url: basePath + '/' + viewtype + '/{z}/{x}/{y}?' + params.toString(),
      maxZoom: SATELLITE_MAX_ZOOM,
      minZoom: SATELLITE_MIN_ZOOM,
      cacheSize: 512,
      tileLoadFunction: (tile, src) => satelliteTileLoadFunction(tile, src, requestContext),
      attributions: '&copy; Earth to Date',
    });
  }

  function disposeRequestContext(contextRef) {
    const context = contextRef?.current;
    if (!context) return;
    context.active = false;
    context.controllers.forEach(controller => controller.abort());
    context.controllers.clear();
    contextRef.current = null;
  }

  function satRefsFor(key) {
    if (key === 'main') return { layerRef: satelliteLayerRef, contextRef: satelliteRequestContextRef };
    if (!extraSatLayers.current.has(key)) extraSatLayers.current.set(key, null);
    return {
      layerRef: { get current() { return extraSatLayers.current.get(key) ?? null; }, set current(v) { extraSatLayers.current.set(key, v); } },
      contextRef: { get current() { return extraSatContexts.current.get(key) ?? null; }, set current(v) { extraSatContexts.current.set(key, v); } },
    };
  }

  function mapFor(key) {
    if (key === 'main') return mapInstance.current;
    return extraMapsRef.current.get(key) ?? null;
  }

  function labelFor(key) {
    if (key === 'main') return 'Main';
    const pos = (extraIds ?? []).indexOf(key);
    return pos >= 0 ? `Map ${pos + 2}` : `Map ${key}`;
  }

  function defaultSatState() {
    return { viewtype: 's2_tci', date: new Date().toISOString().slice(0, 10), months: undefined };
  }

  // Current view center of a map as { lat, lon } (lon/lat order from OL).
  function centerOf(map) {
    try {
      const ol = window.ol;
      const view = map?.getView?.();
      if (!ol || !view) return null;
      const ll = ol.proj.toLonLat(view.getCenter());
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
      return { lat: ll[1], lon: ll[0] };
    } catch {
      return null;
    }
  }

  const getMainViewCenter = useCallback(() => centerOf(mapInstance.current), []);
  const getExtraViewCenter = useCallback((id) => centerOf(extraMapsRef.current.get(id)), []);

  function setSatelliteLayerFor(key, viewtype, date, months) {
    const mapInstance = mapFor(key);
    const { layerRef, contextRef } = satRefsFor(key);
    setSatelliteLayer(mapInstance, layerRef, contextRef, viewtype, date, months, labelFor(key));
  }

  function removeSatelliteLayerFor(key) {
    const mapInstance = mapFor(key);
    const { layerRef, contextRef } = satRefsFor(key);
    removeSatelliteLayer(mapInstance, layerRef, contextRef);
  }
  function setSatelliteLayer(mapInstance, ref, contextRef, viewtype, date, months, side = 'Main') {
    const ol = window.ol;
    if (!mapInstance || !ol) return;
    removeSatelliteLayer(mapInstance, ref, contextRef);
    if (!viewtype || (mapInstance.getView().getZoom() ?? 0) < SATELLITE_MIN_ZOOM) return;

    const requestContext = { active: true, controllers: new Set() };
    const source = createSatelliteSource(viewtype, date, months, requestContext);
    if (!source) return;
    const layer = new Tile({
      source,
      visible: true,
      preload: 0,
      // Source minZoom clamps z9.9 to a z12 tile. This layer-level floor
      // prevents the renderer from enqueueing that clamped tile at all. Layer
      // minZoom is exclusive, hence the tiny epsilon that keeps z12 visible.
      minZoom: SATELLITE_MIN_ZOOM - 0.001,
      properties: {
        inspectorName: `Satellite (${side}): ${viewtype}`,
        inspectorCategory: 'Satellite',
        satelliteViewtype: viewtype,
      },
    });

    // Insert above basemaps but below vector layer.
    const layers = mapInstance.getLayers();
    const vecIdx = layers.getArray().findIndex(l => l instanceof ol.layer.Vector);
    contextRef.current = requestContext;
    ref.current = layer;
    layers.insertAt(vecIdx >= 0 ? vecIdx : layers.getLength(), layer);
  }

  function removeSatelliteLayer(mapInstance, ref, contextRef) {
    disposeRequestContext(contextRef);
    if (mapInstance && ref?.current) {
      try { mapInstance.removeLayer(ref.current); } catch { /* already detached */ }
    }
    if (ref) ref.current = null;
  }

  // Track latest values from satellite panels (main + one per extra map).
  // Main-map r5m resolution ref (r5mActualRef) is declared above.
  const satelliteStateRef = useRef(defaultSatState());

  function extraStateFor(id) {
    if (!extraSatStates.current.has(id)) extraSatStates.current.set(id, defaultSatState());
    return extraSatStates.current.get(id);
  }
  function extraR5mFor(id) {
    if (!extraR5mActual.current.has(id)) extraR5mActual.current.set(id, null);
    return { get current() { return extraR5mActual.current.get(id); }, set current(v) { extraR5mActual.current.set(id, v); } };
  }
  function extraOpenFor(id) {
    return !!extraSatOpen?.[id];
  }

  const handleSatelliteViewtype = useCallback(async ({ viewtype, date, months }) => {
    satelliteStateRef.current = { viewtype, date, months };
    setSatTick(t => t + 1);
    if (!satellitePanelOpen) return;
    const actual = await resolveR5mViewtype(viewtype, date, r5mActualRef);
    setSatelliteLayerFor('main', actual, date, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellitePanelOpen]);

  const handleExtraSatelliteViewtype = useCallback(async (id, { viewtype, date, months }) => {
    extraSatStates.current.set(id, { viewtype, date, months });
    setSatTick(t => t + 1);
    if (!extraOpenFor(id)) return;
    if (!extraMapsRef.current.get(id)) return;
    const actual = await resolveR5mViewtype(viewtype, date, extraR5mFor(id));
    setSatelliteLayerFor(id, actual, date, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraSatOpen, extraMapsTick]);

  // Stable per-map callbacks (SatellitePanel notifies on every change, so
  // identity must not churn or panels re-notify in a loop).
  function extraHandlerFor(id) {
    if (!extraSatHandlers.current.has(id)) {
      extraSatHandlers.current.set(id, (v) => handleExtraSatelliteViewtype(id, v));
    }
    return extraSatHandlers.current.get(id);
  }

  const handleExtraMapsReady = useCallback((maps) => {
    extraMapsRef.current = maps instanceof Map ? maps : new Map();
    setExtraMapsTick(t => t + 1);
  }, []);

  const renderExtraPanel = useCallback((id) => (
    <SatellitePanel
      key={`sat-${id}`}
      open={!!extraSatOpen?.[id]}
      onViewtypeChange={extraHandlerFor(id)}
      right
      narrow={mapCount > 2}
      category={satCategory}
      onCategoryChange={onSatCategoryChange}
      getViewCenter={() => getExtraViewCenter(id)}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [extraSatOpen, satCategory, extraMapsTick, mapCount]);

  const renderExtraLegend = useCallback((id) => {
    if (!extraSatOpen?.[id]) return null;
    const s = extraSatStates.current.get(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return <SatelliteLegend key={`leg-${id}`} viewtype={s?.viewtype} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraSatOpen, satTick]);

  // Show/hide satellite layers when panels open/close
  // For r5m_tci: skip here, handled async above
  // On the very first open, center the map on the satellite start location.
  useEffect(() => {
    if (satellitePanelOpen) {
      const view = mapInstance.current?.getView();
      if (view) {
        if (!satPanelInitialPanRef.current) {
          satPanelInitialPanRef.current = true;
          view.animate({
            center: window.ol.proj.fromLonLat([SATELLITE_PANEL_START.lon, SATELLITE_PANEL_START.lat]),
            resolution: SATELLITE_OPEN_RESOLUTION,
            duration: 500,
          });
        } else {
          view.animate({ resolution: SATELLITE_OPEN_RESOLUTION, duration: 500 });
        }
      }
      const s = satelliteStateRef.current;
      if (s.viewtype !== 'r5m_tci') setSatelliteLayerFor('main', s.viewtype, s.date, s.months);
    } else {
      removeSatelliteLayerFor('main');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellitePanelOpen]);

  // Extra-map satellite layers: one per compare view, created only once the
  // extra map exists; never fall back to the main map, or a duplicate
  // satellite layer lands on top of another panel's.
  useEffect(() => {
    const ids = extraIds ?? [];
    // Drop state/handlers for removed maps so nothing leaks across add/remove.
    for (const id of Array.from(extraSatStates.current.keys())) {
      if (!ids.includes(id)) {
        removeSatelliteLayerFor(id);
        extraSatStates.current.delete(id);
        extraR5mActual.current.delete(id);
        extraSatHandlers.current.delete(id);
        extraSatLayers.current.delete(id);
      }
    }
    for (const id of ids) {
      const m = extraMapsRef.current.get(id);
      if (!m) continue;
      if (extraOpenFor(id)) {
        const s = extraStateFor(id);
        if (s.viewtype !== 'r5m_tci') setSatelliteLayerFor(id, s.viewtype, s.date, s.months);
      } else {
        removeSatelliteLayerFor(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraIds, extraSatOpen, extraMapsTick]);

  // Enforce the product zoom floor on the layer itself. Crossing below z12
  // removes it and aborts queued/in-flight product tiles; crossing back recreates
  // it with a fresh source, so OpenLayers cannot keep clamped z12 tiles around.
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return undefined;
    const view = map.getView();

    const stateForKey = (key) => (key === 'main' ? satelliteStateRef.current : extraStateFor(key));
    const r5mForKey = (key) => (key === 'main' ? r5mActualRef.current : (extraR5mActual.current.get(key) || null));
    const openForKey = (key) => (key === 'main' ? satellitePanelOpen : extraOpenFor(key));
    const layerForKey = (key) => (key === 'main' ? satelliteLayerRef.current : (extraSatLayers.current.get(key) ?? null));

    const syncLayerZoom = () => {
      const allowed = (view.getZoom() ?? 0) >= SATELLITE_MIN_ZOOM;
      const keys = ['main', ...(extraIds ?? [])];
      if (!allowed) {
        for (const key of keys) removeSatelliteLayerFor(key);
        return;
      }
      for (const key of keys) {
        if (key !== 'main' && !extraMapsRef.current.get(key)) continue;
        const s = stateForKey(key);
        if (openForKey(key) && !layerForKey(key)) {
          const viewtype = s.viewtype === 'r5m_tci' ? (r5mForKey(key) || 's2r5m_tci') : s.viewtype;
          setSatelliteLayerFor(key, viewtype, s.date, s.months);
        }
      }
    };

    view.on('change:resolution', syncLayerZoom);
    syncLayerZoom();
    return () => view.un('change:resolution', syncLayerZoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExtras, satellitePanelOpen, extraSatOpen, extraMapsTick]);

  // Panel-2 satellite layer lives on the second map only (compare mode). It is
  // created only once map2 exists; no fallback to the main map.

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
    if (hasExtras) { cancelMeasureRef.current?.(); deactivateDraw(); }
  }, [hasExtras]);

  // Call updateSize when compare mode changes (map container resizes)
  // Wrap in rAF so layout settles before OL reads element dimensions
  useEffect(() => {
    if (!mapInstance.current) return;
    const id = requestAnimationFrame(() => mapInstance.current.updateSize());
    return () => cancelAnimationFrame(id);
  }, [hasExtras, layoutMode, mapCount]);

  const layout = resolveLayout(mapCount, layoutMode);
  let containerClass = styles.container;
  if (layout === 'compare') containerClass += ` ${styles.compareActive}`;
  else if (layout === 'swipe') containerClass += ` ${styles.compareActive} ${styles.compareSwipeMode}`;
  else if (layout === 'grid') containerClass += ` ${styles.stripActive}`;

  return (
    <div className={containerClass}>
      <div className={styles.mapCell}>
        <div ref={mapRef} className={styles.map}></div>
        <SatellitePanel
          open={satellitePanelOpen}
          onViewtypeChange={handleSatelliteViewtype}
          narrow={mapCount > 2}
          category={satCategory}
          onCategoryChange={onSatCategoryChange}
          getViewCenter={getMainViewCenter}
        />
        {satellitePanelOpen && <SatelliteLegend viewtype={satelliteStateRef.current.viewtype} />}
      </div>
      <MapOverlay coords={coords} zoom={zoom} resolution={resolution} />
      {mapReady && <MeasureTool map={mapInstance.current} measureCancelRef={cancelMeasureRef} onBeforeMeasureStart={handleBeforeMeasureStart} buttonSlot={measureSlot} />}
      {mapReady && (
        <MapControls
          map={mapInstance.current}
          measureSlotRef={setMeasureSlot}
          layerInspectorOpen={layerInspectorOpen}
          onToggleLayerInspector={() => setLayerInspectorOpen(open => !open)}
        />
      )}
      {mapReady && (
        <LayerInspector
          map={mapInstance.current}
          open={layerInspectorOpen}
          onClose={() => setLayerInspectorOpen(false)}
        />
      )}
      {mapReady && (
        <MapCompare
          map={mapInstance.current}
          extraIds={extraIds ?? []}
          onAddMap={onAddMap}
          onRemoveMap={onRemoveMap}
          onRemoveAllExtras={onRemoveAllExtras}
          layoutMode={layoutMode}
          onLayoutChange={onLayoutChange}
          basemapRefs={basemapRefs.current}
          activeBasemap={activeBasemap}
          onExtraMapsReady={handleExtraMapsReady}
          renderPanel={renderExtraPanel}
          renderLegend={renderExtraLegend}
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
    </div>
  );
});

export default MapView;
