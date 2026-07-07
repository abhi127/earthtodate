import { renderTile } from "@/lib/tilegen";
import { familyForView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/{view}/{zoom}/{tile_x}/{tile_y}
// Mirrors the Earth to Date "Get Tile V2" endpoint. Returns a PNG raster tile.
export async function GET(
  _req: Request,
  { params }: { params: { view: string; zoom: string; tile_x: string; tile_y: string } }
) {
  const view = params.view;
  const z = parseInt(params.zoom, 10);
  const x = parseInt(params.tile_x, 10);
  const y = parseInt(params.tile_y.replace(/\.png$/, ""), 10);

  if ([z, x, y].some((n) => Number.isNaN(n))) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }

  const png = renderTile(view, familyForView(view), z, x, y);
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      "X-ETD-View": view,
    },
  });
}
