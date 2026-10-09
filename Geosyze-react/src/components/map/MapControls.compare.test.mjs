// Compare lives only in the first map's SatellitePanel bar: MapControls must
// not render its own compare toggle, while MapView must still wire compare
// into SatellitePanel exactly once (the first-map panel).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const controls = fs.readFileSync(path.join(dir, 'MapControls.jsx'), 'utf8');
const view = fs.readFileSync(path.join(dir, 'MapView.jsx'), 'utf8');

// MapControls has no compare toggle of its own.
assert.ok(!controls.includes('onToggleCompare'), 'MapControls must not accept onToggleCompare');
assert.ok(!controls.includes('compareActive'), 'MapControls must not accept compareActive');
assert.ok(!controls.includes('Compare maps'), 'MapControls must not render a Compare maps button');
assert.ok(!controls.includes('Exit compare'), 'MapControls must not render an Exit compare button');

// MapView still wires compare into the first-map SatellitePanel exactly once.
const toggleWires = view.match(/onToggleCompare=\{handleCompareToggle\}/g) || [];
assert.equal(toggleWires.length, 1, 'MapView must wire compare into SatellitePanel exactly once');

// ...and no longer passes compare props to <MapControls>.
const controlsBlock = view.slice(view.indexOf('<MapControls'));
const controlsTag = controlsBlock.slice(0, controlsBlock.indexOf('/>') + 2);
assert.ok(!controlsTag.includes('onToggleCompare'), '<MapControls> must not receive onToggleCompare');
assert.ok(!controlsTag.includes('compareActive'), '<MapControls> must not receive compareActive');

console.log('mapcontrols compare: OK');
