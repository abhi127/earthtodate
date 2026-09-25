// featuresToCSV escapes commas/quotes per RFC 4180; shpContentLength matches writer.
import assert from 'node:assert/strict';
import { featuresToCSV, shpContentLength } from './mapExport.js';

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

console.log('map export: OK');
