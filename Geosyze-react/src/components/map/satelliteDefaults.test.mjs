// When the satellite panel opens, the map must settle at 3.8 m/px.
import assert from 'node:assert/strict';
import { SATELLITE_OPEN_RESOLUTION } from './satelliteDefaults.js';

assert.equal(SATELLITE_OPEN_RESOLUTION, 3.8);

// Sanity: 3.8 m/px is well above the z12 product floor (~38 m/px at the
// equator), so the satellite layer stays visible at the open resolution.
const Z12_RESOLUTION = 156543.03392804097 / 2 ** 12;
assert.ok(SATELLITE_OPEN_RESOLUTION < Z12_RESOLUTION);

console.log('satellite open resolution: OK');
