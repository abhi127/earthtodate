// Extracted queue: rolling debounce + concurrency cap, per loader instance.
import assert from 'node:assert/strict';
import { createTileLoader, createTestScheduler } from './satelliteTileLoader.js';

const sched = createTestScheduler();
const g = createTileLoader({ maxConcurrent: 6, stillDelay: 300, scheduler: sched });
const started = [];
const p1 = g.wait().then(() => started.push(1));
sched.advance(100);
const p2 = g.wait().then(() => started.push(2));
assert.equal(g.active, 0);
sched.advance(301);
await Promise.all([p1, p2]);
assert.equal(started.length, 2);
assert.equal(g.active, 2);

const sched2 = createTestScheduler();
const g2 = createTileLoader({ maxConcurrent: 6, stillDelay: 300, scheduler: sched2 });
const ps = [];
for (let i = 0; i < 6; i++) ps.push(g2.wait());
sched2.advance(301);
await Promise.all(ps);
assert.equal(g2.active, 6);
const extra = g2.wait();
sched2.advance(301);
assert.equal(g2.active, 6);
g2.release();
await extra;

// Default scheduler must delegate to the globals at call time (not hold
// detached copies): a captured window.setTimeout/clearTimeout called as a
// plain-object method throws "Illegal invocation" in Chrome. Create the
// loader BEFORE swapping the global, so a capturing implementation misses
// the spy while a delegating one hits it.
const lateLoader = createTileLoader({ stillDelay: 20 });
const realSetTimeout = globalThis.setTimeout;
let spyCalls = 0;
globalThis.setTimeout = (fn, ms, ...rest) => { spyCalls++; return realSetTimeout(fn, ms, ...rest); };
try {
  await lateLoader.wait();
  lateLoader.release();
  assert.ok(spyCalls > 0, 'default scheduler must call through to global setTimeout');
} finally {
  globalThis.setTimeout = realSetTimeout;
}

console.log('satellite tile loader: OK');
