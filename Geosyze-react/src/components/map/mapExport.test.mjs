// featuresToCSV escapes commas/quotes per RFC 4180; shpContentLength matches writer.
import assert from 'node:assert/strict';
import { featuresToCSV, shpContentLength, featuresToExportContent } from './mapExport.js';

const fakeOl = {
  format: { WKT: class { writeFeature(f) { return f._wkt; } } },
};
const csv = featuresToCSV([{ _wkt: 'POINT (1 2)' }, { _wkt: 'LINESTRING (0 0, 1,1)' }], fakeOl);
assert.equal(csv, 'WKT,ID\nPOINT (1 2),1\n"LINESTRING (0 0, 1,1)",2');

assert.equal(shpContentLength({ getType: () => 'Point' }), 20);
assert.equal(
  shpContentLength({ getType: () => 'LineString', getCoordinates: () => [[0, 0], [1, 1]] }),
  4 + 32 + 4 + 4 + 4 + 2 * 16
);

// Pin featuresToExportContent triples (extracted MapView.jsx export switch):
// exact {content, filename, mimeType} per format, EPSG:3857 projection on every
// ol.format call, null for shapefile/unknown. csv exercises the real
// featuresToCSV as a pass-through over the stub WKT writer.
const fmtCalls = [];
function fmtRecorder(ret) {
  return class {
    writeFeatures(features, opts) { fmtCalls.push({ method: 'writeFeatures', opts }); return ret; }
    writeFeature(f, opts) { fmtCalls.push({ method: 'writeFeature', opts }); return f._wkt; }
  };
}
const stubFormats = {
  format: {
    GeoJSON: fmtRecorder('<geojson>'),
    KML: fmtRecorder('<kml>'),
    GPX: fmtRecorder('<gpx>'),
    WKT: fmtRecorder(),
  },
};
const pinFeatures = [{ _wkt: 'POINT (1 2)' }, { _wkt: 'POINT (3 4)' }];
const PROJ = { featureProjection: 'EPSG:3857' };

for (const [format, content, filename, mimeType, method] of [
  ['geojson', '<geojson>', 'export.geojson', 'application/geo+json', 'writeFeatures'],
  ['kml', '<kml>', 'export.kml', 'application/vnd.google-earth.kml+xml', 'writeFeatures'],
  ['gpx', '<gpx>', 'export.gpx', 'application/gpx+xml', 'writeFeatures'],
  ['wkt', 'POINT (1 2)\nPOINT (3 4)', 'export.wkt', 'text/plain', 'writeFeature'],
  ['csv', 'WKT,ID\nPOINT (1 2),1\nPOINT (3 4),2', 'export.csv', 'text/csv', 'writeFeature'],
]) {
  fmtCalls.length = 0;
  assert.deepEqual(featuresToExportContent(pinFeatures, stubFormats, format), { content, filename, mimeType });
  assert.ok(fmtCalls.length > 0, `${format} must call an ol.format writer`);
  assert.ok(fmtCalls.every(c => c.method === method), `${format} must use ${method}`);
  assert.ok(fmtCalls.every(c => JSON.stringify(c.opts) === JSON.stringify(PROJ)), `${format} must pass featureProjection EPSG:3857`);
}

fmtCalls.length = 0;
assert.equal(featuresToExportContent(pinFeatures, stubFormats, 'shapefile'), null);
assert.equal(featuresToExportContent(pinFeatures, stubFormats, 'bogus'), null);
assert.equal(fmtCalls.length, 0, 'shapefile/unknown must not touch ol.format');

console.log('map export: OK');
