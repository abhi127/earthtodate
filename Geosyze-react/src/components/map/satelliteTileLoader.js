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

// `scheduler` delegates to the globals; tests inject a fake pair.
// NOTE: the default must NOT capture `{ setTimeout, clearTimeout }` by value:
// detached window timers called as plain-object methods throw
// "Illegal invocation" in Chrome. Bare global calls are the safe shape.
const defaultScheduler = {
  setTimeout: (...args) => setTimeout(...args),
  clearTimeout: (id) => clearTimeout(id),
};

export function createTileLoader({ maxConcurrent = 6, stillDelay = 300, scheduler = defaultScheduler } = {}) {
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

// Tiles that failed (no imagery / upstream error). OL re-requests the same
// tile whenever it becomes visible again (pan, zoom, layer churn), so remember
// failures and short-circuit to a transparent tile instead of re-hitting the
// network each time.
export const tileFailCache = new Set();

export function satelliteTileLoadFunction(tile, src, requestContext, loader) {
  const image = tile.getImage();

  if (tileFailCache.has(src)) {
    image.src = TRANSPARENT_TILE;
    return;
  }

  loader.wait()
    .then(() => {
      // The layer may have been removed, replaced, or zoomed below its product
      // floor while this tile waited in the debounce queue. Do not turn that
      // stale queue entry into a server request.
      if (!requestContext.active) throw abortError();

      const controller = new AbortController();
      requestContext.controllers.add(controller);
      return fetch(src, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then((blob) => {
          if (!requestContext.active) throw abortError();
          const url = URL.createObjectURL(blob);
          // OpenLayers attaches its own load/error listeners (addEventListener)
          // before this resolves, so only set img.src and let it finalize the tile.
          image.src = url;
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        })
        .finally(() => requestContext.controllers.delete(controller));
    })
    .catch((err) => {
      // Fire OpenLayers' image error listener (via addEventListener) so the
      // tile finals as ERROR instead of hanging in LOADING; hanging LOADING
      // tiles are what leave a stale/ghost layer behind. Aborted/stale tiles
      // belong to a source that has already been removed, so finalize them as
      // transparent without recording a server failure.
      if (err?.name === 'AbortError') {
        image.src = TRANSPARENT_TILE;
      } else {
        tileFailCache.add(src);
        image.dispatchEvent(new Event('error'));
      }
    })
    .finally(() => loader.release());
}
