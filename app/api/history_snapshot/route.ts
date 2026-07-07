import { renderTile } from "@/lib/tilegen";
import { familyForView } from "@/lib/views";
import { parseLatLon } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 256;

// GET /api/history_snapshot?lat_lon=LAT,LON&view=VIEW&zoom=Z
// Returns a PNG thumbnail of the tile containing the point — a historical
// "snapshot" for a location/view/date.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const coord = parseLatLon(url.searchParams.get("lat_lon")) || [20, 0];
  const view = url.searchParams.get("view") || "s2_tci";
  const z = parseInt(url.searchParams.get("zoom") || "11", 10);

  const world = SIZE * Math.pow(2, z);
  const [lat, lon] = coord;
  const wx = ((lon + 180) / 360) * world;
  const latRad = (lat * Math.PI) / 180;
  const wy =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * world;
  const tx = Math.floor(wx / SIZE);
  const ty = Math.floor(wy / SIZE);

  const png = renderTile(view, familyForView(view), z, tx, ty);
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "X-ETD-View": view,
    },
  });
}
