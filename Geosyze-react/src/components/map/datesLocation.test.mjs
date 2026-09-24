// resolveDatesLocation picks the coords used for /api/tiles/dates lookups:
// the map's current view center when available, else the fixed fallback.
import assert from 'node:assert/strict';
import { resolveDatesLocation } from './datesLocation.js';

const FALLBACK = { lat: 20.5937, lon: 78.9629 };

// Prefers the live view center.
assert.deepEqual(
  resolveDatesLocation({ lat: 28.6139, lon: 77.209 }, FALLBACK),
  { lat: 28.6139, lon: 77.209 }
);

// Falls back when the map isn't ready.
assert.deepEqual(resolveDatesLocation(null, FALLBACK), FALLBACK);
assert.deepEqual(resolveDatesLocation(undefined, FALLBACK), FALLBACK);

// Falls back on non-finite centers (never query with NaN).
assert.deepEqual(resolveDatesLocation({ lat: NaN, lon: 77.2 }, FALLBACK), FALLBACK);
assert.deepEqual(resolveDatesLocation({ lat: 28.6, lon: Infinity }, FALLBACK), FALLBACK);

console.log('dates location: OK');
