import { sampleAtLatLon, elevationMeters } from "./tilegen";

// Deterministic mock place-name generator so geocode results are stable.
const PREFIX = ["North", "New", "Port", "San", "Lake", "Mount", "Fort", "East", "Grand", "Cape"];
const CORE = ["Aurora", "Meridian", "Vernal", "Cobalt", "Harrow", "Sable", "Verde", "Cinder", "Wren", "Marlow", "Halden", "Otava", "Brenner", "Cresta"];
const SUFFIX = ["", " City", " Bay", " Ridge", " Flats", " Vale", " Heights"];

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function placeName(lat: number, lon: number): string {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const h = hashInt(key);
  const { fields } = sampleAtLatLon(lat, lon);
  if (fields.elev < 0.46) return `${["Open Ocean", "Coastal Waters", "Deep Basin"][h % 3]}`;
  const p = PREFIX[h % PREFIX.length];
  const c = CORE[(h >>> 3) % CORE.length];
  const s = SUFFIX[(h >>> 7) % SUFFIX.length];
  return `${p} ${c}${s}`;
}

const COUNTRIES = ["Ad634", "Belgrave", "Corvia", "Dunmere", "Estola", "Farland", "Gr_land", "Halstead"];
export function region(lat: number, lon: number): string {
  const h = hashInt(`${Math.round(lat)},${Math.round(lon)}`);
  return COUNTRIES[h % COUNTRIES.length];
}

export function parseLatLon(v: string | null): [number, number] | null {
  if (!v) return null;
  const parts = v.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1]];
}

// Air-quality style readout derived from the world "light"/pollution field.
export function pollutionAt(lat: number, lon: number) {
  const { fields } = sampleAtLatLon(lat, lon);
  const base = Math.max(0, fields.light * 1.15 - 0.05);
  const aqi = Math.round(15 + base * 240);
  const pm25 = +(3 + base * 90).toFixed(1);
  const pm10 = +(8 + base * 130).toFixed(1);
  const no2 = +(5 + base * 70).toFixed(1);
  const o3 = +(20 + (1 - base) * 60).toFixed(1);
  let category = "Good";
  if (aqi > 300) category = "Hazardous";
  else if (aqi > 200) category = "Very Unhealthy";
  else if (aqi > 150) category = "Unhealthy";
  else if (aqi > 100) category = "Unhealthy (Sensitive)";
  else if (aqi > 50) category = "Moderate";
  return { aqi, category, pm25, pm10, no2, o3 };
}

export { elevationMeters, sampleAtLatLon };
