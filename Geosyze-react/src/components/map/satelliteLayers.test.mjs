// Zoom floor + request-context disposal (pure parts of satellite layer mgmt).
import assert from 'node:assert/strict';
import { SATELLITE_MIN_ZOOM, isSatelliteAllowed, disposeRequestContext } from './satelliteLayers.js';

assert.equal(SATELLITE_MIN_ZOOM, 12);
assert.equal(isSatelliteAllowed(11.9), false);
assert.equal(isSatelliteAllowed(12), true);
assert.equal(isSatelliteAllowed(16), true);

let aborted = 0;
const ctrl = { abort: () => { aborted++; } };
const ref = { current: { active: true, controllers: new Set([ctrl]) } };
disposeRequestContext(ref);
assert.equal(aborted, 1);
assert.equal(ref.current, null);
disposeRequestContext({ current: null });

console.log('satellite layers: OK');
