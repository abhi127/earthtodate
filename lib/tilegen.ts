// Procedural tile renderer. Produces a continuous, seamless "world" of
// synthetic imagery so the map has something real to display offline.
// Each view family gets a distinct, physically-suggestive colormap.
import { fbm, ridged } from "./noise";
import { encodePNG } from "./png";
import type { Family } from "./views";

const SIZE = 256;

type RGBA = [number, number, number, number];

function clamp(v: number, lo = 0, hi = 1) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t),
  ];
}
// piecewise color ramp over stops at [0..1]
function ramp(stops: [number, RGBA][], t: number): RGBA {
  t = clamp(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (t >= p0 && t <= p1) {
      const k = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
      return mix(c0, c1, k);
    }
  }
  return stops[stops.length - 1][1];
}

// hash a string to a small integer for per-view variation
function strseed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 100000;
}

interface Fields {
  elev: number; // 0..1
  veg: number;
  moist: number;
  light: number; // 0..1 city light concentration
}

function sampleFields(gx: number, gy: number, world: number): Fields {
  const u = gx / world;
  const v = gy / world;
  // geography (continents) + regional + micro texture
  const elev =
    0.58 * ridged(u * 4.5, v * 4.5, 1, 5) +
    0.28 * fbm(gx / 1100, gy / 1100, 2, 5) +
    0.14 * fbm(gx / 150, gy / 150, 3, 4);
  const veg = clamp(
    0.65 * fbm(u * 6 + 12, v * 6, 4, 5) + 0.35 * fbm(gx / 220, gy / 220, 9, 4)
  );
  const moist = clamp(0.7 * fbm(gx / 1400 + 5, gy / 1400, 5, 5) + 0.3 * fbm(gx / 260, gy / 260, 6, 4));
  const cluster = fbm(u * 8 + 30, v * 8, 7, 4);
  const cores = Math.pow(clamp(fbm(gx / 520, gy / 520, 8, 3)), 2.2);
  const light = clamp((cluster - 0.52) * 3) * cores;
  return { elev: clamp(elev), veg, moist, light };
}

const SEA = 0.46;

// ---- family colormaps ------------------------------------------------------

function natural(f: Fields): RGBA {
  if (f.elev < SEA) {
    const d = f.elev / SEA; // 0 deep .. 1 shore
    return ramp(
      [
        [0, [6, 22, 46, 255]],
        [0.6, [12, 54, 92, 255]],
        [0.9, [26, 96, 130, 255]],
        [1, [40, 130, 150, 255]],
      ],
      d
    );
  }
  const e = (f.elev - SEA) / (1 - SEA); // 0..1 land
  const veg = f.veg;
  // beach -> vegetation/soil -> rock -> snow
  let base: RGBA;
  if (e < 0.06) base = [206, 196, 150, 255]; // sand
  else if (e < 0.55) {
    const green: RGBA = [58, 104, 54, 255];
    const soil: RGBA = [120, 116, 72, 255];
    base = mix(soil, green, clamp(veg * 1.2));
  } else if (e < 0.8) base = mix([120, 110, 92, 255], [90, 82, 74, 255], (e - 0.55) / 0.25);
  else base = mix([150, 148, 150, 255], [240, 244, 250, 255], (e - 0.8) / 0.2);
  // subtle hillshade
  const sh = 0.85 + 0.3 * (f.elev - 0.5);
  return [base[0] * sh, base[1] * sh, base[2] * sh, 255];
}

// false-color band viz: start from natural then permute/emphasize channels
function bandviz(f: Fields, seed: number): RGBA {
  const n = natural(f);
  const nir = clamp(f.veg * 0.9 + (f.elev > SEA ? 0.2 : 0)) * 255;
  const swir = clamp(1 - f.moist) * 255;
  const modes = seed % 8;
  switch (modes) {
    case 0: return [nir, n[0] * 0.7, n[1] * 0.7, 255]; // veg -> red
    case 1: return [nir, swir, n[0] * 0.6, 255]; // crop/soil
    case 2: return [swir, nir, n[0] * 0.6, 255]; // stress
    case 3: return [swir, nir, n[1] * 0.7, 255]; // moisture
    case 4: return [swir * 0.8, nir, n[2] * 0.9, 255]; // geology
    case 5: return [nir, swir, n[2], 255]; // urban
    case 6: return [nir * 0.8, n[0] * 0.6, n[2], 255]; // water
    default: return [swir, n[0] * 0.7, n[1] * 0.7, 255];
  }
}

const NDVI_RAMP: [number, RGBA][] = [
  [0, [120, 96, 70, 255]],
  [0.3, [180, 160, 90, 255]],
  [0.5, [200, 210, 90, 255]],
  [0.7, [90, 175, 60, 255]],
  [1, [12, 92, 32, 255]],
];
const WATER_RAMP: [number, RGBA][] = [
  [0, [40, 30, 20, 255]],
  [0.4, [70, 110, 140, 255]],
  [0.7, [40, 140, 200, 255]],
  [1, [10, 60, 170, 255]],
];

function indexColor(f: Fields, suffix: string): RGBA {
  const waterish = /nd[wm]i|cwc|ndsi/.test(suffix);
  if (waterish) return ramp(WATER_RAMP, f.moist);
  // vegetation scalar
  const scalar = clamp(f.elev < SEA ? 0.02 : f.veg * 0.9 + 0.05);
  return ramp(NDVI_RAMP, scalar);
}

function sar(f: Fields, gx: number, gy: number, vh: boolean): RGBA {
  const speckle = fbm(gx / 3.1, gy / 3.1, vh ? 41 : 40, 2);
  let b = 0.35 * f.elev + 0.4 * (f.elev > SEA ? 0.7 : 0.15) + 0.35 * speckle;
  if (vh) b *= 0.8;
  const g = clamp(b) * 255;
  // faint cyan cast typical of colorized SAR
  return [g * 0.92, g, g * 1.02, 255];
}

function nightlight(f: Fields, variant: string): RGBA {
  const terrain = 40 + f.elev * 70;
  if (variant === "lighted") {
    const base: RGBA = [terrain * 0.7, terrain * 0.72, terrain * 0.8, 255];
    const gold: RGBA = [255, 208, 120, 255];
    return mix(base, gold, clamp(f.light * 1.4));
  }
  if (variant === "darkened") {
    const dim = (0.15 + f.light * 0.85) * terrain;
    return [dim * 0.9, dim * 0.92, dim, 255];
  }
  // intensity: black -> white by light
  const l = Math.pow(clamp(f.light), 0.7) * 255;
  return [l, l * 0.98, l * 0.9, 255];
}

function demColor(f: Fields): RGBA {
  return ramp(
    [
      [0, [10, 30, 60, 255]],
      [SEA, [30, 80, 110, 255]],
      [SEA + 0.001, [40, 90, 60, 255]],
      [0.65, [200, 190, 120, 255]],
      [0.85, [150, 110, 90, 255]],
      [1, [250, 250, 255, 255]],
    ],
    f.elev
  );
}

function analytics(f: Fields, suffix: string): RGBA {
  if (suffix.includes("biomass")) return ramp(NDVI_RAMP, clamp(f.veg));
  if (suffix.includes("moisture")) return ramp(WATER_RAMP, f.moist);
  if (suffix.includes("waterleak")) {
    const warn = f.moist > 0.72 && f.elev > SEA;
    return warn ? [240, 70, 60, 255] : [22, 30, 38, 120];
  }
  if (suffix.includes("class")) {
    // categorical salinity classes
    const c = Math.floor(clamp(f.moist + f.elev * 0.3) * 5) % 5;
    const table: RGBA[] = [
      [40, 120, 90, 255],
      [150, 190, 90, 255],
      [230, 200, 90, 255],
      [230, 140, 60, 255],
      [200, 60, 50, 255],
    ];
    return table[c];
  }
  if (suffix.includes("confidence")) {
    const c = clamp(0.4 + f.veg * 0.6);
    const g = c * 255;
    return [g * 0.5, g, g * 0.8, 255];
  }
  // salinity score 0..100 -> green..red
  const s = clamp(f.moist * 0.5 + (1 - f.veg) * 0.5);
  return ramp(
    [
      [0, [40, 130, 90, 255]],
      [0.5, [230, 210, 90, 255]],
      [1, [200, 50, 45, 255]],
    ],
    s
  );
}

function pollution(f: Fields, gx: number, gy: number): RGBA {
  // semi-transparent overlay; concentrated near "cities"
  const plume = clamp(f.light * 1.2 + 0.4 * fbm(gx / 300, gy / 300, 71, 3) - 0.15);
  const a = clamp(plume * 1.3) * 200;
  const col = ramp(
    [
      [0, [80, 200, 120, 255]],
      [0.4, [240, 220, 70, 255]],
      [0.7, [240, 140, 50, 255]],
      [1, [200, 40, 60, 255]],
    ],
    plume
  );
  return [col[0], col[1], col[2], a];
}

function scl(f: Fields, gx: number, gy: number): RGBA {
  const cloud = fbm(gx / 240, gy / 240, 91, 4);
  if (cloud > 0.66) return [232, 236, 240, 255]; // cloud
  if (cloud > 0.6) return [120, 128, 136, 255]; // cloud shadow
  if (f.elev < SEA) return [40, 90, 160, 255]; // water
  if (f.veg > 0.55) return [70, 150, 60, 255]; // vegetation
  if (f.elev > 0.82) return [230, 240, 250, 255]; // snow
  return [150, 130, 90, 255]; // bare soil
}

function flood(f: Fields): RGBA {
  const level = SEA + 0.06;
  if (f.elev < SEA) return natural(f);
  if (f.elev < level) {
    return [40, 120, 200, 190]; // newly flooded
  }
  const n = natural(f);
  return [n[0] * 0.7, n[1] * 0.7, n[2] * 0.7, 255];
}

function changes(f: Fields, gx: number, gy: number): RGBA {
  const d = fbm(gx / 180, gy / 180, 61, 4) - 0.5;
  if (Math.abs(d) < 0.12) return [20, 26, 34, 60];
  return d > 0 ? [60, 220, 120, 200] : [220, 60, 150, 200];
}

function mineral(f: Fields, gx: number, gy: number): RGBA {
  const c = Math.floor((fbm(gx / 120, gy / 120, 51, 4) + f.elev) * 6) % 6;
  const table: RGBA[] = [
    [180, 70, 200, 255],
    [70, 160, 220, 255],
    [220, 170, 60, 255],
    [90, 210, 160, 255],
    [230, 90, 90, 255],
    [160, 160, 170, 255],
  ];
  return table[c];
}

// Central per-pixel color dispatch, shared by tile + AOI rendering.
function pixelColor(
  view: string,
  family: Family,
  f: Fields,
  gx: number,
  gy: number
): RGBA {
  const seed = strseed(view);
  const suffix = view.split("_").slice(1).join("_") || view;
  const variant = view.replace(/^nightlight\d+m_?/, "");
  switch (family) {
    case "tci": return natural(f);
    case "bandviz": return bandviz(f, seed);
    case "index": return indexColor(f, suffix);
    case "sar": return sar(f, gx, gy, /vh/.test(view));
    case "nightlight": return nightlight(f, variant);
    case "pollution": return pollution(f, gx, gy);
    case "dem": return demColor(f);
    case "analytics": return analytics(f, suffix);
    case "scl": return scl(f, gx, gy);
    case "flood": return flood(f);
    case "changes": return changes(f, gx, gy);
    case "mineral": return mineral(f, gx, gy);
    default: return natural(f);
  }
}

export function renderTile(
  view: string,
  family: Family,
  z: number,
  x: number,
  y: number
): Uint8Array {
  const world = SIZE * Math.pow(2, z);
  const ox = x * SIZE;
  const oy = y * SIZE;
  const buf = new Uint8Array(SIZE * SIZE * 4);

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const gx = ox + px;
      const gy = oy + py;
      const f = sampleFields(gx, gy, world);
      const c = pixelColor(view, family, f, gx, gy);
      const i = (py * SIZE + px) * 4;
      buf[i] = clamp(c[0], 0, 255);
      buf[i + 1] = clamp(c[1], 0, 255);
      buf[i + 2] = clamp(c[2], 0, 255);
      buf[i + 3] = clamp(c[3] ?? 255, 0, 255);
    }
  }
  return encodePNG(SIZE, SIZE, buf);
}

function lonLatToWorld(lon: number, lat: number, world: number): [number, number] {
  const x = ((lon + 180) / 360) * world;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * world;
  return [x, y];
}

// Render an arbitrary bounding box to a PNG (used by AOI download).
export function renderBBox(
  view: string,
  family: Family,
  minLat: number,
  minLon: number,
  maxLat: number,
  maxLon: number,
  w = 640,
  h = 640
): Uint8Array {
  const z = 13;
  const world = SIZE * Math.pow(2, z);
  const buf = new Uint8Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const lat = maxLat + ((minLat - maxLat) * py) / (h - 1);
    for (let px = 0; px < w; px++) {
      const lon = minLon + ((maxLon - minLon) * px) / (w - 1);
      const [gx, gy] = lonLatToWorld(lon, lat, world);
      const f = sampleFields(gx, gy, world);
      const c = pixelColor(view, family, f, gx, gy);
      const i = (py * w + px) * 4;
      buf[i] = clamp(c[0], 0, 255);
      buf[i + 1] = clamp(c[1], 0, 255);
      buf[i + 2] = clamp(c[2], 0, 255);
      buf[i + 3] = clamp(c[3] ?? 255, 0, 255);
    }
  }
  return encodePNG(w, h, buf);
}

// Sample the world fields at a lat/lon/zoom — reused by data endpoints
// (DEM, pollution value, line-of-sight) so map + readouts stay consistent.
export function sampleAtLatLon(lat: number, lon: number, z = 12) {
  const world = SIZE * Math.pow(2, z);
  const x = ((lon + 180) / 360) * world;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    world;
  return { fields: sampleFields(x, y, world), world };
}

// Convert the world elevation field (0..1) into meters (ocean negative).
export function elevationMeters(elev: number): number {
  if (elev < SEA) return Math.round(-((SEA - elev) / SEA) * 800);
  return Math.round(((elev - SEA) / (1 - SEA)) * 3600);
}
