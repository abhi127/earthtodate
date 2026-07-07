import { renderBBox } from "@/lib/tilegen";
import { familyForView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/download_aoi/{bbox_lat_lon}/{date_str}/{days_back}/{max_clouds}/{view}
// bbox_lat_lon = minLat,minLon,maxLat,maxLon
// Returns a rendered PNG of the AOI as an attachment.
export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: {
      bbox_lat_lon: string;
      date_str: string;
      days_back: string;
      max_clouds: string;
      view: string;
    };
  }
) {
  const parts = decodeURIComponent(params.bbox_lat_lon)
    .split(",")
    .map((s) => parseFloat(s));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return new Response("bbox must be minLat,minLon,maxLat,maxLon", { status: 422 });
  }
  const [minLat, minLon, maxLat, maxLon] = parts;
  const view = params.view;
  const png = renderBBox(
    view,
    familyForView(view),
    Math.min(minLat, maxLat),
    Math.min(minLon, maxLon),
    Math.max(minLat, maxLat),
    Math.max(minLon, maxLon)
  );
  const fname = `etd_${view}_${params.date_str}.png`;
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "X-ETD-View": view,
      "X-ETD-Date": params.date_str,
    },
  });
}
