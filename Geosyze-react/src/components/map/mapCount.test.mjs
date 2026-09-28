// Multi-map compare state rules (max 4 total, main map never closable,
// swipe layout only valid with exactly 2 maps).
import assert from 'node:assert/strict';
import {
  MAX_MAPS,
  canAddMap,
  resolveLayout,
} from './mapCount.js';

assert.equal(MAX_MAPS, 4);

assert.equal(canAddMap(1), true);
assert.equal(canAddMap(3), true);
assert.equal(canAddMap(4), false);

assert.equal(resolveLayout(1, 'compare'), 'single');
assert.equal(resolveLayout(2, 'compare'), 'compare');
assert.equal(resolveLayout(2, 'swipe'), 'swipe');
assert.equal(resolveLayout(3, 'swipe'), 'grid');
assert.equal(resolveLayout(4, 'compare'), 'grid');

console.log('map count rules: OK');
