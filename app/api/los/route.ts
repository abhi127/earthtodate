import { NextResponse } from "next/server";
import { parseLatLon, sampleAtLatLon, elevationMeters } from "@/lib/geo";

export const runtime = "nodejs";

// Great-circle-ish distance in metres (equirectangular approx, fine for LOS)
function distM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const mLat = (((a[0] + b[0]) / 2) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = dLon * Math.cos(mLat);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

// GET /api/los?p1=LAT,LON&p2=LAT,LON&obs_h=2&tgt_h=2
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p1 = parseLatLon(url.searchParams.get("p1"));
  const p2 = parseLatLon(url.searchParams.get("p2"));
  if (!p1 || !p2) {
    return NextResponse.json(
      { detail: "Provide p1=LAT,LON & p2=LAT,LON" },
      { status: 422 }
    );
  }
  const obsH = parseFloat(url.searchParams.get("obs_h") || "2");
  const tgtH = parseFloat(url.searchParams.get("tgt_h") || "2");
  const N = 128;
  const total = distM(p1, p2);

  const profile: { d: number; ground: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const lat = p1[0] + (p2[0] - p1[0]) * t;
    const lon = p1[1] + (p2[1] - p1[1]) * t;
    const { fields } = sampleAtLatLon(lat, lon);
    profile.push({ d: +(total * t).toFixed(1), ground: elevationMeters(fields.elev) });
  }

  const startElev = profile[0].ground + obsH;
  const endElev = profile[N].ground + tgtH;
  let visible = true;
  let obstruction: { d: number; ground: number } | null = null;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const sight = startElev + (endElev - startElev) * t;
    // Earth curvature drop (metres) — 4/3 radio-ish not needed, use geometric
    const curve = (profile[i].d * (total - profile[i].d)) / (2 * 6371000);
    if (profile[i].ground > sight + curve) {
      visible = false;
      obstruction = profile[i];
      break;
    }
  }

  return NextResponse.json({
    p1,
    p2,
    distance_m: Math.round(total),
    observer_height_m: obsH,
    target_height_m: tgtH,
    visible,
    obstruction,
    samples: profile.filter((_, i) => i % 2 === 0), // 65 points for charting
  });
}
