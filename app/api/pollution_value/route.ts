import { NextResponse } from "next/server";
import { parseLatLon, pollutionAt, placeName } from "@/lib/geo";

export const runtime = "nodejs";

// GET /api/pollution_value?lat_lon=LAT,LON  (or ?lat=&lon=)
export async function GET(req: Request) {
  const url = new URL(req.url);
  let coord = parseLatLon(url.searchParams.get("lat_lon"));
  if (!coord) {
    const lat = parseFloat(url.searchParams.get("lat") || "");
    const lon = parseFloat(url.searchParams.get("lon") || "");
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) coord = [lat, lon];
  }
  if (!coord) {
    return NextResponse.json(
      { detail: "Provide lat_lon=LAT,LON or lat & lon query params" },
      { status: 422 }
    );
  }
  const [lat, lon] = coord;
  return NextResponse.json({
    lat,
    lon,
    place: placeName(lat, lon),
    ...pollutionAt(lat, lon),
    units: { pm25: "µg/m³", pm10: "µg/m³", no2: "ppb", o3: "ppb" },
    source: "ETD mock air-quality model",
  });
}
