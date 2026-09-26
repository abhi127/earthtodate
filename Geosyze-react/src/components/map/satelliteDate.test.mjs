// pickBestDate: most recent date with clouds <= 2%, else least cloudy, else null.
import assert from 'node:assert/strict';
import { pickBestDate } from './satelliteDate.js';

// Closest-to-today qualifying date wins (not the oldest, not the clearest).
assert.equal(
  pickBestDate([['2026-09-20', '5.0'], ['2026-09-18', '1.2'], ['2026-09-19', '0.5']]),
  '2026-09-19'
);

// Boundary: exactly 2.0 qualifies.
assert.equal(pickBestDate([['2026-09-20', '2.0']]), '2026-09-20');

// None qualify -> least cloudy date.
assert.equal(
  pickBestDate([['2026-09-20', '10'], ['2026-09-18', '3.5']]),
  '2026-09-18'
);

// Empty -> null (caller keeps current date).
assert.equal(pickBestDate([]), null);

console.log('satellite date: OK');
