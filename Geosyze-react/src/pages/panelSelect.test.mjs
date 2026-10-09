// Panel switching: selecting a side-panel menu (archive, blacksky,
// earthdaily, vantor, basemap) must turn the satellite panel off; selecting
// a satellite category (e2d/ai/analytics) must close any side panel.
import assert from 'node:assert/strict';
import { resolvePanelSelect } from './panelSelect.js';

// Bug repro: satellite open + click Archive -> satellite must close.
assert.deepEqual(
  resolvePanelSelect({ activePanel: null, satelliteOpen: true, satCategory: 'visual' }, 'archive'),
  { activePanel: 'archive', satelliteOpen: false, satCategory: 'visual' }
);

// Same for the other separate menus.
for (const id of ['blacksky', 'earthdaily', 'vantor', 'basemap']) {
  const next = resolvePanelSelect({ activePanel: null, satelliteOpen: true, satCategory: 'visual' }, id);
  assert.equal(next.satelliteOpen, false, `${id} must close satellite panel`);
  assert.equal(next.activePanel, id, `${id} must open its side panel`);
}

// Toggling the open panel closed keeps satellite off.
assert.deepEqual(
  resolvePanelSelect({ activePanel: 'archive', satelliteOpen: false, satCategory: 'visual' }, 'archive'),
  { activePanel: null, satelliteOpen: false, satCategory: 'visual' }
);

// Satellite categories still open satellite + close side panels (existing behavior).
assert.deepEqual(
  resolvePanelSelect({ activePanel: 'archive', satelliteOpen: false, satCategory: 'visual' }, 'e2d'),
  { activePanel: null, satelliteOpen: true, satCategory: 'visual' }
);

// Clicking the active satellite category toggles it off.
assert.deepEqual(
  resolvePanelSelect({ activePanel: null, satelliteOpen: true, satCategory: 'visual' }, 'e2d'),
  { activePanel: null, satelliteOpen: false, satCategory: 'visual' }
);

console.log('panel select: OK');
