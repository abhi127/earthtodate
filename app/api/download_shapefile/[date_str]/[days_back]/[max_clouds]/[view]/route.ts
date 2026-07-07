import { NextResponse } from "next/server";
import { familyForView } from "@/lib/views";
import { sampleAtLatLon, elevationMeters } from "@/lib/tilegen";

export const runtime = "nodejs";

// POST /api/download_shapefile/{date_str}/{days_back}/{max_clouds}/{view}
// Body: a GeoJSON geometry (Polygon) or { coordinates: [[lon,lat],...] }.
// Mock returns a GeoJSON FeatureCollection (a shapefile-equivalent) as a
// downloadable file with a per-vertex sampled value for the chosen view.
export async function POST(
  req: Request,
  {
    params,
  }: {
    params: { date_str: string; days_back: string; max_clouds: string; view: string };
  }
) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Body must be GeoJSON" }, { status: 422 });
  }

  // Accept a few shapes: Feature, geometry, or a raw ring of [lon,lat]
  const ring: number[][] =
    body?.geometry?.coordinates?.[0] ??
    body?.coordinates?.[0] ??
    body?.coordinates ??
    body?.ring ??
    [];

  if (!Array.isArray(ring) || ring.length < 3) {
    return NextResponse.json(
      { detail: "Provide a polygon ring: coordinates:[[lon,lat],...]" },
      { status: 422 }
    );
  }

  const view = params.view;
  const family = familyForView(view);
  const features = ring.map((pt: number[], i: number) => {
    const [lon, lat] = pt;
    const { fields } = sampleAtLatLon(lat, lon);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        vertex: i,
        view,
        family,
        elevation_m: elevationMeters(fields.elev),
        veg_index: +fields.veg.toFixed(3),
        moisture: +fields.moist.toFixed(3),
      },
    };
  });

  const fc = {
    type: "FeatureCollection",
    metadata: {
      view,
      date_str: params.date_str,
      days_back: Number(params.days_back),
      max_clouds: Number(params.max_clouds),
      generated_by: "ETD mock shapefile export",
    },
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: { view, date: params.date_str, kind: "aoi" },
      },
      ...features,
    ],
  };

  return new NextResponse(JSON.stringify(fc, null, 2), {
    headers: {
      "Content-Type": "application/geo+json",
      "Content-Disposition": `attachment; filename="etd_${view}_${params.date_str}.geojson"`,
    },
  });
}
