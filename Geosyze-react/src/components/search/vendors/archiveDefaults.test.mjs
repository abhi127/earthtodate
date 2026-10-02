// defaultArchiveRange: end = given day, start = one calendar month earlier,
// both as YYYY-MM-DD. Used as the archival search form defaults.
import assert from 'node:assert/strict';
import { defaultArchiveRange } from './archiveDefaults.js';

// Plain case: 2026-10-02 -> 2026-09-02..2026-10-02.
assert.deepEqual(
  defaultArchiveRange(new Date(2026, 9, 2)),
  { start: '2026-09-02', end: '2026-10-02' }
);

// Month-end rollover: Mar 31 minus one month clamps to Feb 28 (2026 non-leap).
assert.deepEqual(
  defaultArchiveRange(new Date(2026, 2, 31)),
  { start: '2026-02-28', end: '2026-03-31' }
);

// Year boundary: Jan 15 -> Dec 15 previous year.
assert.deepEqual(
  defaultArchiveRange(new Date(2026, 0, 15)),
  { start: '2025-12-15', end: '2026-01-15' }
);

console.log('archive defaults: OK');
