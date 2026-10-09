// Compare bottom bar is merged upward: MapCompare renders no bottom
// comparePanel (cells + cell close + swipe stay); the first map's
// SatellitePanel bar owns add-map / layout / close-all as a second row;
// MapView wires those props into the main SatellitePanel only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const compare = fs.readFileSync(path.join(dir, 'MapCompare.jsx'), 'utf8');
const panel = fs.readFileSync(path.join(dir, 'SatellitePanel.jsx'), 'utf8');
const view = fs.readFileSync(path.join(dir, 'MapView.jsx'), 'utf8');

// Bottom bar gone from MapCompare (cell close buttons use cellClose, stays).
assert.ok(!compare.includes('comparePanel'), 'MapCompare must not render a bottom comparePanel');
assert.ok(!compare.includes('onRemoveAllExtras'), 'MapCompare must not take onRemoveAllExtras');
assert.ok(!compare.includes('onLayoutChange'), 'MapCompare must not take onLayoutChange');
assert.ok(compare.includes('cellClose'), 'MapCompare must keep per-cell close buttons');

// Merged second row lives in SatellitePanel.
assert.ok(panel.includes('onAddMap'), 'SatellitePanel must accept onAddMap');
assert.ok(panel.includes('onCloseAll'), 'SatellitePanel must accept onCloseAll');
assert.ok(panel.includes('Side by side'), 'SatellitePanel must render the layout toggle');
assert.ok(panel.includes('Add map'), 'SatellitePanel must render the add-map button');

// MapView wires compare controls into the main SatellitePanel...
// NOTE: both elements contain nested self-closing <svg> tags, so the tag
// end is the line-indented '/>' closing the element itself.
const satIdx = view.indexOf('<SatellitePanel');
assert.ok(satIdx >= 0, 'MapView must render a main SatellitePanel');
const satEnd = view.indexOf('\n        />', satIdx);
const satTag = view.slice(satIdx, satEnd);
assert.ok(satTag.includes('onAddMap={'), 'main SatellitePanel must receive onAddMap');
assert.ok(satTag.includes('onCloseAll={'), 'main SatellitePanel must receive onCloseAll');

// ...and no longer passes bottom-bar props to <MapCompare>.
const cmpIdx = view.indexOf('<MapCompare');
assert.ok(cmpIdx >= 0, 'MapView must render MapCompare');
const cmpEnd = view.indexOf('\n        />', cmpIdx);
const cmpTag = view.slice(cmpIdx, cmpEnd);
assert.ok(!cmpTag.includes('onRemoveAllExtras'), '<MapCompare> must not receive onRemoveAllExtras');
assert.ok(!cmpTag.includes('onLayoutChange'), '<MapCompare> must not receive onLayoutChange');

// Compare-row spacing: the merged row uses a dedicated class (with a
// divider separating it from the satellite controls), and the shared row
// class gives buttons a consistent flex gap instead of JSX whitespace.
const css = fs.readFileSync(path.join(dir, 'SatellitePanel.module.css'), 'utf8');
assert.ok(panel.includes('compareRow'), 'compare row must use the compareRow class');
assert.ok(css.includes('.compareRow'), 'CSS must define .compareRow');
assert.ok(css.includes('.row'), 'CSS must define .row');

console.log('satmerge compare: OK');
