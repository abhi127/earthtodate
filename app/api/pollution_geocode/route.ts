import { NextResponse } from "next/server";
import { parseLatLon, placeName, region, pollutionAt } from "@/lib/geo";

export const runtime = "nodejs";

// GET /api/pollution_geocode
//   ?q=NAME              -> forward geocode to a deterministic lat/lon
//   ?lat_lon=LAT,LON     -> reverse geocode to a place name (+ pollution)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const coord = parseLatLon(url.searchParams.get("lat_lon"));

  if (coord) {
    const [lat, lon] = coord;
    return NextResponse.json({
      lat,
      lon,
      place: placeName(lat, lon),
      region: region(lat, lon),
      ...pollutionAt(lat, lon),
    });
  }

  if (q) {
    // deterministic hash -> lat/lon
    let h = 2166136261;
    for (let i = 0; i < q.length; i++) {
      h ^= q.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const lat = +(((h % 12000) / 12000) * 120 - 60).toFixed(4);
    const lon = +((((h >>> 8) % 24000) / 24000) * 340 - 170).toFixed(4);
    return NextResponse.json({
      query: q,
      lat,
      lon,
      place: placeName(lat, lon),
      region: region(lat, lon),
      ...pollutionAt(lat, lon),
    });
  }

  return NextResponse.json(
    { detail: "Provide q=NAME or lat_lon=LAT,LON" },
    { status: 422 }
  );
}
