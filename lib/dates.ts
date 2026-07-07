// Deterministic "available acquisition dates" generator for a location+view.
import { sampleAtLatLon } from "./tilegen";

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DateEntry {
  date: string;
  clouds: number;
  available: boolean;
}

// revisit cadence (days) by sensor family
function revisit(view: string): number {
  if (view.startsWith("s1")) return 6; // Sentinel-1
  if (view.startsWith("ps") || view.startsWith("psrr")) return 1; // PlanetScope daily
  if (view.startsWith("ls")) return 16; // Landsat
  if (view.startsWith("nightlight")) return 1;
  return 5; // Sentinel-2
}

export function availableDates(
  latLon: [number, number],
  view: string,
  dateStr: string,
  daysBack: number,
  maxClouds: number
): DateEntry[] {
  const end = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(end.getTime())) return [];
  const cadence = revisit(view);
  const { fields } = sampleAtLatLon(latLon[0], latLon[1]);
  // cloudier over water / vegetation-moist areas
  const cloudBias = fields.moist * 0.5;
  const out: DateEntry[] = [];
  for (let day = 0; day <= daysBack; day += cadence) {
    const d = new Date(end.getTime() - day * 86400000);
    const seed = hashInt(`${view}|${fmt(d)}|${latLon[0].toFixed(2)}`);
    const clouds = Math.round(((seed % 1000) / 1000) * 90 * (0.5 + cloudBias));
    out.push({
      date: fmt(d),
      clouds: Math.min(clouds, 100),
      available: clouds <= maxClouds,
    });
  }
  return out;
}
