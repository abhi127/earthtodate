// Extra compare maps always open on OSM, regardless of position or the
// main map's basemap.
import assert from 'node:assert/strict';
import { defaultExtraBasemap } from './compareBasemap.js';

assert.equal(defaultExtraBasemap(), 'osm');
assert.equal(defaultExtraBasemap('satellite', 0), 'osm');
assert.equal(defaultExtraBasemap('terrain', 2), 'osm');

console.log('compare basemap: OK');
