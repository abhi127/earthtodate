// Sentinel basemap registry: BASEMAP_DEFS must include the EOX
// Sentinel-2 cloudless entry used by sidebar, MapView and compare pickers.
import assert from 'node:assert/strict';
import { BASEMAP_DEFS } from './basemaps.js';

const ids = BASEMAP_DEFS.map((d) => d.id);
assert.ok(ids.includes('sentinel'), 'BASEMAP_DEFS must include sentinel');

const entry = BASEMAP_DEFS.find((d) => d.id === 'sentinel');
assert.equal(entry.name, 'Sentinel');
assert.ok(
  entry.thumbnail.includes('s2cloudless-2023_3857'),
  'sentinel thumbnail must come from the EOX s2cloudless service'
);

console.log('basemap defs: OK');
