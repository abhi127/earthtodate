// Sidebar rail uses the new vendor SVGs with theme-aware inversion: black
// artwork (blacksky, earthtodate, vantor) inverts on the dark rail only;
// multicolor earthdaily never inverts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const jsx = fs.readFileSync(path.join(dir, 'Sidebar.jsx'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'Sidebar.module.css'), 'utf8');

// New SVGs wired in, old rasters gone.
for (const f of ['earthtodate.svg', 'blacksky.svg', 'earthdaily.svg', 'vantor.svg']) {
  assert.ok(jsx.includes(`/vendors/${f}`), `Sidebar must use /vendors/${f}`);
}
for (const f of ['blacksky.png', 'earthtodate.jpeg', 'earthdaily.jpeg', 'vantor.jpeg']) {
  assert.ok(!jsx.includes(f), `Sidebar must not reference old raster ${f}`);
}

// Black logos invert; multicolor earthdaily does not.
function imgTagFor(src) {
  const i = jsx.indexOf(src);
  const start = jsx.lastIndexOf('<img', i);
  return jsx.slice(start, jsx.indexOf('/>', i) + 2);
}
assert.ok(imgTagFor('/vendors/blacksky.svg').includes('railLogoInvert'), 'blacksky must invert');
assert.ok(imgTagFor('/vendors/earthtodate.svg').includes('railLogoInvert'), 'earthtodate must invert');
assert.ok(imgTagFor('/vendors/vantor.svg').includes('railLogoInvert'), 'vantor must invert');
assert.ok(!imgTagFor('/vendors/earthdaily.svg').includes('railLogoInvert'), 'earthdaily must not invert');

// Inversion is theme-scoped: dark default inverts, light theme does not.
assert.ok(css.includes('.railLogoInvert'), 'CSS must define .railLogoInvert');
assert.ok(css.includes('data-theme'), 'CSS must scope inversion to the theme');
assert.ok(css.includes('light'), 'CSS must handle the light theme');

console.log('sidebar icons: OK');
