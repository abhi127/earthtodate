// ponytail: one runnable check for the coalesced tile-loader gate in MapView.jsx.
// Standalone so it runs with plain `node` (no framework). Simulates the queue /
// debounce gate with fake timers to prove: requests are held while tiles keep
// arriving, and flush only after a quiet window, capped at MAX_CONCURRENT.
import assert from 'node:assert';

const MAX_CONCURRENT_TILES = 6;
const STILL_DELAY = 300;

function makeGate() {
  let satActive = 0;
  let satStill = false;
  let satTimer = null;
  const satQueue = [];
  let now = 0;
  const timers = new Map();
  let nextId = 1;

  const fakeSetTimeout = (fn, ms) => {
    const id = nextId++;
    timers.set(id, { fn, at: now + ms });
    return id;
  };
  const fakeClearTimeout = (id) => timers.delete(id);
  const advance = (ms) => {
    now += ms;
    for (const [id, t] of [...timers]) {
      if (!timers.has(id)) continue;
      if (t.at <= now) {
        timers.delete(id);
        t.fn();
      }
    }
  };

  function satArm() {
    satStill = false;
    fakeClearTimeout(satTimer);
    satTimer = fakeSetTimeout(() => {
      satStill = true;
      satTick();
    }, STILL_DELAY);
  }
  function satTick() {
    while (satStill && satActive < MAX_CONCURRENT_TILES && satQueue.length) {
      const run = satQueue.shift();
      satActive++;
      run();
    }
  }
  function satWait() {
    satArm();
    return new Promise((resolve) => {
      satQueue.push(resolve);
      satTick();
    });
  }
  function satRelease() {
    satActive--;
    satTick();
  }

  return { satWait, satRelease, advance, get active() { return satActive; }, get queued() { return satQueue.length; } };
}

// Ready a batch of N requests, let the quiet window pass, await them resolving.
async function batch(g, n) {
  const ps = [];
  for (let i = 0; i < n; i++) ps.push(g.satWait());
  g.advance(STILL_DELAY + 1);
  await Promise.all(ps);
}

// 1. Continuous arrivals never start mid-gesture (rolling debounce).
const g = makeGate();
const started = [];
const p1 = g.satWait().then(() => started.push(1));
g.advance(100);
const p2 = g.satWait().then(() => started.push(2));
assert.strictEqual(g.active, 0, 'nothing starts while requests keep arriving');
// Rest the map: only after a full quiet window do the queued requests fire.
g.advance(STILL_DELAY + 1);
await Promise.all([p1, p2]);
assert.strictEqual(started.length, 2, 'queued requests fire only once still');
assert.strictEqual(g.active, 2, 'both now running');

// 2. Concurrency cap holds under a big post-still burst.
const g2 = makeGate();
await batch(g2, MAX_CONCURRENT_TILES);
assert.strictEqual(g2.active, MAX_CONCURRENT_TILES, 'cap reached');
const extra = g2.satWait();
g2.advance(STILL_DELAY + 1);
assert.strictEqual(g2.active, MAX_CONCURRENT_TILES, 'extra waits, cap held');
g2.satRelease();
assert.strictEqual(g2.active, MAX_CONCURRENT_TILES, 'release starts next, cap still held');
await extra;

console.log('loader gate: OK');
