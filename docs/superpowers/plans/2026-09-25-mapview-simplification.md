# MapView Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `MapView.jsx` from ~928 lines to ~250 lines by extracting 4 cohesive modules, with zero prop-interface or behavior changes.

**Architecture:** Extract-by-responsibility (approach A, chat-approved 2026-09-25). Move verbatim code blocks out of `MapView.jsx` into focused modules; `MapView` becomes composition + hook wiring only. Every task moves code without changing logic, guarded by the existing `node *.test.mjs` suite plus one new test per extracted module.

**Tech Stack:** React 18, OpenLayers 10 (`window.ol`), Vite 6, plain `node:assert/strict` `.test.mjs` files (no test framework), JSZip 3.

**Spec:** N/A — no separate spec doc (brainstorming sections 2–5 skipped per explicit user request 2026-09-25). Design authority is: approach A from brainstorming chat + module map from Section 1 (4 extraction targets, ~250-line `MapView` goal, unchanged component prop interfaces). Executors read this plan as the sole design source.

## Global Constraints

- Component prop interfaces MUST NOT change (`MapView`, `MapCompare`, `SatellitePanel`, `MapPage` props stay identical).
- Tile URLs, basemap IDs (`osm satellite terrain light streets dark sentinel`), zoom floor (`SATELLITE_MIN_ZOOM = 12`), concurrency cap (`MAX_CONCURRENT_TILES = 6`), still delay (`STILL_DELAY = 300`) stay byte-identical.
- Tests run with plain `node <file>` from `Geosyze-react/`; `npm test` script already chains all six suites and MUST stay green.
- No new runtime dependencies.
- `backend/`, login/search pages are out of scope.
- Commit after every task.

## Review Focus

- Satellite tiles at zoom 11.9 must NOT request (layer floor), and zoom 12.0 must render — a reasonable user expects the product to vanish below z12, not show clamped z12 tiles.
- Rapid pan/zoom bursts must NOT fire tile fetches mid-gesture, and the post-still burst must NOT exceed 6 concurrent fetches.
- Opening the satellite panel must pan to `SATELLITE_PANEL_START` at 3.8 m/px exactly once (first open only).
- Adding a 3rd/4th map after switching the main basemap must derive the new map's basemap from the CURRENT main basemap, not the initial one.
- A failed tile (HTTP 500) must render transparent without hanging in LOADING, and must NOT permanently poison a different date/viewtype URL.

---

## File Structure

New files (each one responsibility):

- `Geosyze-react/src/components/map/satelliteTileLoader.js` — coalesced tile-fetch queue + fail-cache + `satelliteTileLoadFunction`. Exports: `createTileLoader({ maxConcurrent, stillDelay })`, `satelliteTileLoadFunction(tile, src, requestContext)`, `TRANSPARENT_TILE`, `abortError()`. Default singleton preserves today's module-global behavior.
- `Geosyze-react/src/components/map/mapExport.js` — `downloadBlob(blob, filename)`, `featuresToCSV(features, ol)`, `writeShpHeader/writeShpRecord/shpContentLength`, `exportShapefile(features)`, `exportFeatures(features, format, ol)`.
- `Geosyze-react/src/components/map/useSatelliteLayers.js` — `SATELLITE_MIN_ZOOM`, `SATELLITE_MAX_ZOOM`, `createSatelliteSource(ol, viewtype, date, months, tileLoadFunction)`, `disposeRequestContext(contextRef)`, `resolveR5mViewtype(viewtype, date, r5mRef)`, `setSatelliteLayer/removeSatelliteLayer` keyed helpers.
- `Geosyze-react/src/components/map/satelliteTileLoader.test.mjs`, `mapExport.test.mjs`, `satelliteLayers.test.mjs` — one new suite per extracted module, same `node:assert/strict` style as existing suites.

Modified files:

- `Geosyze-react/src/components/map/basemaps.js` — ADD `BASEMAP_NAMES`, `createBasemapSource(ol, id)` (single source of truth).
- `Geosyze-react/src/components/map/MapView.jsx` (~928 → ~250 lines) — DELETE local tile-loader block (lines 16–128), DELETE export block (~lines 323–555), DELETE local basemap source table, IMPORT from new modules. No logic changes.
- `Geosyze-react/src/components/map/MapCompare.jsx` — DELETE local `createSource` (lines 12–43) + `BASEMAP_NAMES` (lines 6–10), IMPORT from `basemaps.js`.
- `Geosyze-react/src/components/map/SatellitePanel.jsx:231,307` — guard `RAIL_CATEGORIES[category]` with fallback.
- `Geosyze-react/src/components/map/mapCount.js` + `mapCount.test.mjs` — remove dead `canRemoveMap`/`nextMapCountOnSatelliteOpen` (unused in app code) and their test blocks.
- `Geosyze-react/package.json` — extend `test` script with the 3 new suites.

---

### Task 1: Branch + baseline

**Files:**
- Create: (none — git branch only)
- Modify: (none)
- Test: existing suite

**Interfaces:**
- Consumes: clean tree on `react-design` @ `a0ea01e`
- Produces: branch `refactor/mapview-simplification`, recorded baseline output

- [ ] **Step 1: Create the branch from current HEAD**

```bash
git status --short
git checkout -b refactor/mapview-simplification
git status --short
```

- [ ] **Step 2: Run the baseline suite and record output**

```bash
npm test
```

Run: `npm test` in `Geosyze-react/`
Expected: all six lines print (`basemap defs: OK`, `map count rules: OK`, `dates location: OK`, `satellite open resolution: OK`, `loader gate: OK`, `satellite zoom floor: OK`), exit 0. If any suite fails, STOP — fix or report before Task 2.

- [ ] **Step 3: Verify production build baseline**

```bash
npx vite build --mode production
```

Run: `npx vite build` in `Geosyze-react/`
Expected: `dist/` written, exit 0.

---

### Task 2: Extract `satelliteTileLoader.js`

**Files:**
- Create: `Geosyze-react/src/components/map/satelliteTileLoader.js`
- Create: `Geosyze-react/src/components/map/satelliteTileLoader.test.mjs`
- Modify: `Geosyze-react/src/components/map/MapView.jsx:16-128` (delete block, import from new module)
- Test: `Geosyze-react/src/components/map/satelliteTileLoader.test.mjs`

**Interfaces:**
- Consumes: nothing (first extraction)
- Produces: `createTileLoader({ maxConcurrent = 6, stillDelay = 300, scheduler })` → `{ wait(), release(), get active(), get queued() }`; `createTestScheduler()` → `{ setTimeout, clearTimeout, advance(ms) }`; `satelliteTileLoadFunction(tile, src, requestContext, loader)`; `TRANSPARENT_TILE` (string); `abortError()` → `Error` named `AbortError`. Task 6 imports the default singleton.

- [ ] **Step 1: Write the failing test** (`satelliteTileLoader.test.mjs`)

```js
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

console.log('satellite tile loader: OK');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node src/components/map/satelliteTileLoader.test.mjs
```

Run in `Geosyze-react/`
Expected: FAIL with `Cannot find module './satelliteTileLoader.js'` (or `createTileLoader is not a function`).

- [ ] **Step 3: Write minimal implementation** (`satelliteTileLoader.js` — verbatim move of `MapView.jsx:23-80`, parameterized)

```js
// Coalesced satellite tile loader (extracted verbatim from MapView.jsx).
// Pan/zoom bursts queue tile fetches; nothing fetches until the map has been
// still for stillDelay ms, then flushes at maxConcurrent fetches at a time.
// `scheduler` defaults to globals; tests inject a fake pair.
export const TRANSPARENT_TILE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

export function abortError() {
  const error = new Error('Satellite tile request superseded');
  error.name = 'AbortError';
  return error;
}

export function createTileLoader({ maxConcurrent = 6, stillDelay = 300, scheduler = { setTimeout, clearTimeout } } = {}) {
  let active = 0;
  let still = false;
  let timer = null;
  const queue = [];
  const api = { get active() { return active; }, get queued() { return queue.length; } };
  function arm() {
    still = false;
    scheduler.clearTimeout(timer);
    timer = scheduler.setTimeout(() => { still = true; tick(); }, stillDelay);
  }
  function tick() {
    while (still && active < maxConcurrent && queue.length) {
      const run = queue.shift();
      active++;
      run();
    }
  }
  api.wait = () => { arm(); return new Promise((resolve) => { queue.push(resolve); tick(); }); };
  api.release = () => { active--; tick(); };
  return api;
}

export function createTestScheduler() {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  return {
    setTimeout: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    advance: (ms) => {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (!timers.has(id)) continue;
        if (t.at <= now) { timers.delete(id); t.fn(); }
      }
    },
  };
}

const tileFailCache = new Set();

export function satelliteTileLoadFunction(tile, src, requestContext, loader) {
  const image = tile.getImage();
  if (tileFailCache.has(src)) { image.src = TRANSPARENT_TILE; return; }
  loader.wait()
    .then(() => {
      if (!requestContext.active) throw abortError();
      const controller = new AbortController();
      requestContext.controllers.add(controller);
      return fetch(src, { signal: controller.signal })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.blob(); })
        .then((blob) => {
          if (!requestContext.active) throw abortError();
          const url = URL.createObjectURL(blob);
          image.src = url;
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        })
        .finally(() => requestContext.controllers.delete(controller));
    })
    .catch((err) => {
      if (err?.name === 'AbortError') { image.src = TRANSPARENT_TILE; }
      else { tileFailCache.add(src); image.dispatchEvent(new Event('error')); }
    })
    .finally(() => loader.release());
}
```

In `MapView.jsx`, delete lines 16–128 (loader block) and add:

```js
import { createTileLoader, satelliteTileLoadFunction as satLoadFn, TRANSPARENT_TILE } from './satelliteTileLoader';
const __satLoader = createTileLoader({ maxConcurrent: 6, stillDelay: 300 });
function satelliteTileLoadFunction(tile, src, requestContext) {
  return satLoadFn(tile, src, requestContext, __satLoader);
}
```

Keep every other line identical.

- [ ] **Step 5: Run tests**

```bash
node src/components/map/satelliteTileLoader.test.mjs && npm test
```

Expected: `satellite tile loader: OK` plus all six existing OK lines, exit 0.

- [ ] **Step 6: Commit**

```bash
git add Geosyze-react/src/components/map/satelliteTileLoader.js Geosyze-react/src/components/map/satelliteTileLoader.test.mjs Geosyze-react/src/components/map/MapView.jsx
git commit -m "refactor: extract satelliteTileLoader from MapView"
```

---

### Task 3: Extract `mapExport.js`

**Files:**
- Create: `Geosyze-react/src/components/map/mapExport.js`
- Create: `Geosyze-react/src/components/map/mapExport.test.mjs`
- Modify: `Geosyze-react/src/components/map/MapView.jsx` (delete `downloadBlob`, `featuresToCSV`, shapefile writer, `exportShapefile`; delegate `exportFeatures`)
- Test: `Geosyze-react/src/components/map/mapExport.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 2
- Produces: `featuresToCSV(features, ol)` → CSV string; `shpContentLength(geom)` → byte count; `exportFeatures(features, format, ol)` → `{ filename, mimeType, content } | { zip: true }`. Task 6 wires these to the existing `useCallback`/`JSZip` call sites.

- [ ] **Step 1: Write the failing test**

```js
// featuresToCSV escapes commas/quotes per RFC 4180; shpContentLength matches writer.
import assert from 'node:assert/strict';
import { featuresToCSV, shpContentLength } from './mapExport.js';

const fakeOl = {
  format: { WKT: class { writeFeature(f) { return f._wkt; } } },
};
const csv = featuresToCSV([{ _wkt: 'POINT (1 2)' }, { _wkt: 'LINESTRING (0 0, 1,1)' }], fakeOl);
assert.equal(csv, 'WKT,ID\nPOINT (1 2),1\n"LINESTRING (0 0, 1,1)",2');

assert.equal(shpContentLength({ getType: () => 'Point' }), 20);
assert.equal(
  shpContentLength({ getType: () => 'LineString', getCoordinates: () => [[0, 0], [1, 1]] }),
  4 + 32 + 4 + 4 + 4 + 2 * 16
);

console.log('map export: OK');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node src/components/map/mapExport.test.mjs
```

Expected: FAIL with `Cannot find module './mapExport.js'`.

- [ ] **Step 3: Write minimal implementation** — move `featuresToCSV`, `writeShpHeader`, `shpContentLength`, `writeShpRecord`, `exportShapefile`, `downloadBlob` verbatim from `MapView.jsx` into `mapExport.js` with named exports; no logic edits.

- [ ] **Step 4: Rewire `MapView.jsx`** — delete the moved functions, import `{ downloadBlob, featuresToCSV, exportShapefile }` from `./mapExport`, keep the `exportFeatures` `useCallback` shell calling them.

- [ ] **Step 5: Run tests**

```bash
node src/components/map/mapExport.test.mjs && npm test
```

Expected: `map export: OK` + existing six OK lines, exit 0.

- [ ] **Step 6: Commit**

```bash
git add Geosyze-react/src/components/map/mapExport.js Geosyze-react/src/components/map/mapExport.test.mjs Geosyze-react/src/components/map/MapView.jsx
git commit -m "refactor: extract mapExport from MapView"
```

---

### Task 4: Centralize basemaps (single source of truth)

**Files:**
- Modify: `Geosyze-react/src/components/map/basemaps.js` (add `BASEMAP_NAMES` + `createBasemapSource(ol, id)`)
- Modify: `Geosyze-react/src/components/map/MapView.jsx` (delete local layer table, use factory)
- Modify: `Geosyze-react/src/components/map/MapCompare.jsx:6-43` (delete `BASEMAP_NAMES` + `createSource`, import from `basemaps.js`)
- Test: extend `Geosyze-react/src/components/map/basemaps.test.mjs` with factory key check

**Interfaces:**
- Consumes: nothing from Tasks 2–3
- Produces: `BASEMAP_NAMES` (id → label, 7 entries); `createBasemapSource(ol, id)` → `ol.source` instance, falls back to OSM for unknown ids. `MapView`/`MapCompare`/sidebar consume these; URLs and `maxZoom` values byte-identical to today.

- [ ] **Step 1: Write the failing test** — append to `basemaps.test.mjs`:

```js
import { BASEMAP_DEFS, BASEMAP_NAMES, createBasemapSource } from './basemaps.js';
const defIds = BASEMAP_DEFS.map((d) => d.id).sort();
assert.deepEqual(Object.keys(BASEMAP_NAMES).sort(), defIds);
const fakeOl = {
  source: {
    OSM: class { constructor() { this.kind = 'osm'; } },
    XYZ: class { constructor(o) { this.kind = 'xyz'; this.url = o.url; } },
  },
};
assert.equal(createBasemapSource(fakeOl, 'osm').kind, 'osm');
assert.ok(createBasemapSource(fakeOl, 'sentinel').url.includes('s2cloudless-2023_3857'));
assert.equal(createBasemapSource(fakeOl, 'nope').kind, 'osm');
console.log('basemap factory: OK');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node src/components/map/basemaps.test.mjs
```

Expected: FAIL with `BASEMAP_NAMES is not exported` (or `createBasemapSource is not a function`).

- [ ] **Step 3: Implement in `basemaps.js`** — add verbatim URL table from `MapCompare.jsx:12-43` as `createBasemapSource(ol, id)` with `(map[id] || map.osm)()` fallback, plus `BASEMAP_NAMES` moved verbatim from `MapCompare.jsx:6-9`. Keep `BASEMAP_DEFS` untouched.

- [ ] **Step 4: Rewire consumers** — `MapView.jsx`: replace the 7-entry `layers = {...}` literal with `Object.fromEntries(BASEMAP_IDS.map(id => [id, new ol.layer.Tile({ source: createBasemapSource(ol, id), visible: id === 'osm' })]))`. `MapCompare.jsx`: delete local `BASEMAP_NAMES`/`createSource`, import both from `./basemaps`. Sidebar untouched (already imports `BASEMAP_DEFS`).

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: `basemap factory: OK` + all existing OK lines, exit 0.

- [ ] **Step 6: Commit**

```bash
git add Geosyze-react/src/components/map/basemaps.js Geosyze-react/src/components/map/basemaps.test.mjs Geosyze-react/src/components/map/MapView.jsx Geosyze-react/src/components/map/MapCompare.jsx
git commit -m "refactor: centralize basemap sources in basemaps.js"
```

---

### Task 5: Extract satellite-layer helpers + fix stale closure

**Files:**
- Create: `Geosyze-react/src/components/map/satelliteLayers.js`
- Create: `Geosyze-react/src/components/map/satelliteLayers.test.mjs`
- Modify: `Geosyze-react/src/components/map/MapView.jsx` (use helpers; replace cached-handler ref-map with latest-callback ref)
- Test: `Geosyze-react/src/components/map/satelliteLayers.test.mjs`

**Interfaces:**
- Consumes: `satelliteTileLoadFunction` loader singleton from Task 2
- Produces: `SATELLITE_MIN_ZOOM = 12`, `SATELLITE_MAX_ZOOM = 21`; `disposeRequestContext(contextRef)`; `resolveR5mViewtype(viewtype, date, r5mRef)` (uses `SATELLITE_PANEL_START`, unchanged logic); `isSatelliteAllowed(zoom)` → boolean. Task 6 uses these inside `MapView`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node src/components/map/satelliteLayers.test.mjs
```

Expected: FAIL with `Cannot find module './satelliteLayers.js'`.

- [ ] **Step 3: Write minimal implementation** (`satelliteLayers.js`)

```js
import { SATELLITE_PANEL_START } from './satelliteDefaults.js';
export const SATELLITE_MIN_ZOOM = 12;
export const SATELLITE_MAX_ZOOM = 21;
export function isSatelliteAllowed(zoom) { return (zoom ?? 0) >= SATELLITE_MIN_ZOOM; }
export function disposeRequestContext(contextRef) {
  const context = contextRef?.current;
  if (!context) return;
  context.active = false;
  context.controllers.forEach((c) => c.abort());
  context.controllers.clear();
  contextRef.current = null;
}
export async function resolveR5mViewtype(viewtype, date, r5mRef) {
  if (viewtype !== 'r5m_tci') return viewtype;
  const { lat, lon } = SATELLITE_PANEL_START;
  const location = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  try {
    const [s2Resp, lsResp] = await Promise.all([
      fetch(`/api/tiles/dates/${location}/s2r5m_tci/${date}/365/100`).then((r) => r.json()).catch(() => []),
      fetch(`/api/tiles/dates/${location}/ls5_tci/${date}/365/100`).then((r) => r.json()).catch(() => []),
    ]);
    const merged = {};
    (s2Resp || []).forEach((d) => { merged[d[0]] = { date: d[0], source: 's2r5m_tci', clouds: parseFloat(d[1]) }; });
    (lsResp || []).forEach((d) => {
      if (!merged[d[0]] || parseFloat(d[1]) < merged[d[0]].clouds)
        merged[d[0]] = { date: d[0], source: 'ls5_tci', clouds: parseFloat(d[1]) };
    });
    const sorted = Object.values(merged).sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length > 0) { r5mRef.current = sorted[0].source; return sorted[0].source; }
  } catch { /* fallback below */ }
  r5mRef.current = 's2r5m_tci';
  return 's2r5m_tci';
}
```

Logic verbatim from `MapView.jsx:599-620`; only moved.

- [ ] **Step 4: Fix stale closure in `MapView.jsx`** — replace `extraHandlerFor`'s cache-once pattern with a latest-callback ref:

```js
const handleExtraRef = useRef(null);
handleExtraRef.current = handleExtraSatelliteViewtype;
function extraHandlerFor(id) {
  if (!extraSatHandlers.current.has(id)) {
    extraSatHandlers.current.set(id, (v) => handleExtraRef.current(id, v));
  }
  return extraSatHandlers.current.get(id);
}
```

Behavior identical except the handler now always calls the LATEST `handleExtraSatelliteViewtype` (fixes review finding #1). Also replace local `SATELLITE_MIN_ZOOM` checks with `isSatelliteAllowed(...)`.

- [ ] **Step 5: Run tests**

```bash
node src/components/map/satelliteLayers.test.mjs && npm test
```

Expected: `satellite layers: OK` + existing six OK lines, exit 0.

- [ ] **Step 6: Commit**

```bash
git add Geosyze-react/src/components/map/satelliteLayers.js Geosyze-react/src/components/map/satelliteLayers.test.mjs Geosyze-react/src/components/map/MapView.jsx
git commit -m "refactor: extract satelliteLayers helpers, fix stale extra-map handler"
```

---

### Task 6: Slim `MapView.jsx` composition + wire `package.json`

**Files:**
- Modify: `Geosyze-react/src/components/map/MapView.jsx` (final deletion pass; target ≤300 lines)
- Modify: `Geosyze-react/package.json` (`test` script += 3 new suites)
- Test: full `npm test` + `vite build`

**Interfaces:**
- Consumes: `satelliteTileLoader.js`, `mapExport.js`, `basemaps.js`, `satelliteLayers.js` from Tasks 2–5
- Produces: `MapView` with IDENTICAL props/ref API (`setBasemap`, `exportFeatures`, `activateDraw`, `clearAll`, `flyTo`); file ≤300 lines (`wc -l` check in Step 2).

- [ ] **Step 1: Delete remaining moved blocks from `MapView.jsx`**

Remove (already-imported elsewhere): loader constants/queue (done T2), export helpers (done T3), basemap URL literals (done T4), `SATELLITE_MIN/MAX_ZOOM` consts + `disposeRequestContext` + `resolveR5mViewtype` bodies (done T5 — leave thin imports). Keep: map init effect, `switchBasemap`, draw helpers, imperative handle, satellite-layer effects, JSX. No logic edits.

- [ ] **Step 2: Fix `MapCompare.jsx` stale basemap anchor + reconcile deps** (review findings, same files already touched in Task 4)

In `MapCompare.jsx`, change `defaultBaseFor` to depend on the current basemap:

```js
const defaultBaseFor = useCallback((id) => {
  const pos = Math.max(0, extraIdsRef.current.indexOf(id));
  const anchor = activeBasemap || 'osm';
  return BASEMAP_IDS[(BASEMAP_IDS.indexOf(anchor) + pos + 1) % BASEMAP_IDS.length];
}, [activeBasemap]);
```

(remove the `eslint-disable-next-line` for this hook). And change the reconcile effect deps from `[extraIds.length, hasExtras]` to `[extraIds, hasExtras]` so same-length id swaps still reconcile (compare `extraIdsRef.current` usage inside stays as-is).

- [ ] **Step 3: Verify line count**

```bash
wc -l Geosyze-react/src/components/map/MapView.jsx
```

Expected: ≤300 lines. If above, list the 3 largest remaining functions (`awk`/`wc`) and extract the largest pure helper into the owning module from Tasks 2–5 (no new modules).

- [ ] **Step 3: Extend the test script** (`package.json:10`)

```json
"test": "node src/components/map/basemaps.test.mjs && node src/components/map/mapCount.test.mjs && node src/components/map/datesLocation.test.mjs && node src/components/map/satelliteDefaults.test.mjs && node src/components/map/MapView.loader.test.mjs && node src/components/map/MapView.zoom.test.mjs && node src/components/map/satelliteTileLoader.test.mjs && node src/components/map/mapExport.test.mjs && node src/components/map/satelliteLayers.test.mjs"
```

- [ ] **Step 4: Run full suite + build**

```bash
npm test && npx vite build
```

Expected: all nine OK lines, `dist/` written, exit 0.

- [ ] **Step 5: Manual smoke (covers Review Focus lines with no node test)**

With `npm run dev` + `window.ol` loaded, verify and record results in the commit message body:
1. Zoom 11.9 with satellite open → no `/api/tiles/v2` requests (Network tab); zoom 12 → tiles load.
2. Open satellite panel → map pans once to start location at 3.8 m/px; close + reopen → no re-pan.
3. Switch main basemap to Dark, add Map 3 → Map 3 offers the next basemap after Dark, not after OSM.
4. Block `/api/tiles/v2` (offline) → tiles render transparent, no perpetual spinner; unblock + change date → tiles load (no cross-date poisoning).

- [ ] **Step 6: Commit**

```bash
git add Geosyze-react/src/components/map/MapView.jsx Geosyze-react/src/components/map/MapCompare.jsx Geosyze-react/package.json
git commit -m "refactor: slim MapView composition, wire new test suites"
```

---

### Task 7: Cleanup guards + dead code

**Files:**
- Modify: `Geosyze-react/src/components/map/SatellitePanel.jsx:231,307`
- Modify: `Geosyze-react/src/components/map/mapCount.js`
- Modify: `Geosyze-react/src/components/map/mapCount.test.mjs`
- Test: `npm test`

**Interfaces:**
- Consumes: all extractions complete
- Produces: `RAIL_CATEGORIES` fallback (`visual`); `mapCount.js` exports ONLY `{ MAX_MAPS, canAddMap, resolveLayout }`.

- [ ] **Step 1: Guard category lookup** (`SatellitePanel.jsx`)

Replace both occurrences:

```js
const list = RAIL_CATEGORIES[category].products;
```

with:

```js
const list = (RAIL_CATEGORIES[category] ?? RAIL_CATEGORIES.visual).products;
```

and:

```js
const categoryProducts = RAIL_CATEGORIES[category].products;
```

with:

```js
const categoryProducts = (RAIL_CATEGORIES[category] ?? RAIL_CATEGORIES.visual).products;
```

- [ ] **Step 2: Remove dead exports** (`mapCount.js`) — delete `canRemoveMap` and `nextMapCountOnSatelliteOpen` (grep confirms zero app imports; only the test imports them).

- [ ] **Step 3: Update `mapCount.test.mjs`** — remove the two imports and the 8 assert lines covering them (lines 7–8, 18–26 in the original). Keep `MAX_MAPS`, `canAddMap`, `resolveLayout` asserts.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all nine OK lines, exit 0. (`map count rules: OK` still prints from remaining asserts.)

- [ ] **Step 5: Commit**

```bash
git add Geosyze-react/src/components/map/SatellitePanel.jsx Geosyze-react/src/components/map/mapCount.js Geosyze-react/src/components/map/mapCount.test.mjs
git commit -m "refactor: guard rail category, drop dead mapCount helpers"
```

---

### Task 8: Full verification + 3 review passes

**Files:**
- Modify: (none — verification only; fixes get their own commits)

**Interfaces:**
- Consumes: Tasks 1–7 complete on `refactor/mapview-simplification`
- Produces: 3 documented review rounds with all findings fixed or explicitly waived.

- [ ] **Step 1: Run the complete gate**

```bash
npm test && npx vite build && git diff main...HEAD --stat
```

Expected: 9 OK lines, build exit 0. Record the `--stat` (expect `MapView.jsx` net −600 lines, 4 new modules, no `backend/` changes).

- [ ] **Step 2: Review round 1 (structure)** — dispatch a `general` subagent as code reviewer with: description of Tasks 1–7, `BASE_SHA = git merge-base main HEAD`, `HEAD_SHA = git rev-parse HEAD`. Ask: do extracted modules have single responsibilities and correct imports? Fix all Critical/Important findings, commit each fix separately.

- [ ] **Step 3: Review round 2 (behavior parity)** — dispatch a second reviewer subagent with the same SHAs. Ask: any prop-interface, URL, zoom-floor, or date-lookup behavior change vs `main`? Fix or waive with a code comment citing the waiver.

- [ ] **Step 4: Review round 3 (tests)** — dispatch a third reviewer subagent. Ask: do the 3 new suites pin the Review Focus behaviors (z12 floor, 6-concurrency, transparent-on-error)? Add any missing test the reviewer names, re-run `npm test`, commit.

- [ ] **Step 5: Push and report**

```bash
git push -u origin refactor/mapview-simplification
git log --oneline -8
```

Report: final `MapView.jsx` line count, `npm test` output, build status, 3 review verdicts.
