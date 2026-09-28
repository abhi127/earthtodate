import JSZip from 'jszip';

// ── download helper ─────────────────────────────────────────────────
export function downloadBlob(blob, filename) {
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
export function featuresToCSV(features, ol) {
  const rows = [['WKT', 'ID']];
  features.forEach((f, i) => {
    const wkt = new ol.format.WKT().writeFeature(f, { featureProjection: 'EPSG:3857' });
    // Escape WKT if it contains commas or quotes
    const escaped = wkt.includes(',') || wkt.includes('"') ? `"${wkt.replace(/"/g, '""')}"` : wkt;
    rows.push([escaped, `${i + 1}`]);
  });
  return rows.map(r => r.join(',')).join('\n');
}

// ── text export content builder ───────────────────────────────────────
// Pure content builder for the single-file text formats (geojson/kml/gpx/
// wkt/csv). Returns { content, filename, mimeType }, or null for formats
// handled elsewhere (shapefile) or unknown. Extracted from MapView.jsx.
export function featuresToExportContent(features, ol, format) {
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
    default:
      return null;
  }
  return { content, filename, mimeType };
}

// ── shapefile binary writer ─────────────────────────────────────────
// ponytail: minimal writer for Point / LineString / Polygon in EPSG:4326
export function writeShpHeader(dataView, fileLength, shapeType, bounds) {
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

export function shpContentLength(geom) {
  const type = geom.getType();
  if (type === 'Point') return 20;        // shapeType(4) + X(8) + Y(8) = 20 bytes
  const coords = geom.getCoordinates();
  const n = type === 'Polygon' ? coords[0].length : coords.length;
  if (type === 'LineString') return 4 + 32 + 4 + 4 + 4 + n * 16;  // type+box+1part+1part+npoints+npts*16
  if (type === 'Polygon') return 4 + 32 + 4 + 4 + 4 + n * 16;
  return 0;
}

export function writeShpRecord(dv, offset, geom) {
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

export async function exportShapefile(features) {
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
