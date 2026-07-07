import { NextResponse } from "next/server";
import { parseLatLon, sampleAtLatLon, elevationMeters, placeName } from "@/lib/geo";

export const runtime = "nodejs";

// GET /api/dem_at_lat_lon?lat_lon=LAT,LON  (or ?lat=&lon=)
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
      { detail: "Provide lat_lon=LAT,LON or lat & lon" },
      { status: 422 }
    );
  }
  const [lat, lon] = coord;
  const { fields } = sampleAtLatLon(lat, lon);
  const elevation = elevationMeters(fields.elev);
  return NextResponse.json({
    lat,
    lon,
    place: placeName(lat, lon),
    elevation_m: elevation,
    vertical_accuracy_m: 0.75,
    dataset: "ETD DEM (1m spatial, 0.5–1m vertical)",
    surface: elevation < 0 ? "water" : "terrain",
  });
}
