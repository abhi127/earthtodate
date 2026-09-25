// Sentinel basemap registry: BASEMAP_DEFS must include the EOX
// Sentinel-2 cloudless entry used by sidebar, MapView and compare pickers.
import assert from 'node:assert/strict';
import { BASEMAP_DEFS, BASEMAP_NAMES, BASEMAP_IDS, createBasemapSource } from './basemaps.js';

const ids = BASEMAP_DEFS.map((d) => d.id);
assert.ok(ids.includes('sentinel'), 'BASEMAP_DEFS must include sentinel');

const entry = BASEMAP_DEFS.find((d) => d.id === 'sentinel');
assert.equal(entry.name, 'Sentinel');
assert.ok(
  entry.thumbnail.includes('s2cloudless-2023_3857'),
  'sentinel thumbnail must come from the EOX s2cloudless service'
);

console.log('basemap defs: OK');
const defIds = BASEMAP_DEFS.map((d) => d.id).sort();
assert.deepEqual(Object.keys(BASEMAP_NAMES).sort(), defIds);
assert.deepEqual([...BASEMAP_IDS].sort(), defIds);
const fakeOl = {
  source: {
    OSM: class { constructor() { this.kind = 'osm'; } },
    XYZ: class { constructor(o) { this.kind = 'xyz'; this.url = o.url; } },
  },
};
assert.equal(createBasemapSource(fakeOl, 'osm').kind, 'osm');
assert.ok(createBasemapSource(fakeOl, 'sentinel').url.includes('s2cloudless-2023_3857'));
assert.equal(createBasemapSource(fakeOl, 'nope').kind, 'osm');
console.log('basemap factory: OK');
