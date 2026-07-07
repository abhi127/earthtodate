import { renderTile } from "@/lib/tilegen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/pollution/{view}/{zoom}/{tile_x}/{tile_y}
// "Get Pollution Overlay" — always rendered with the semi-transparent
// pollution colormap regardless of the view alias passed.
export async function GET(
  _req: Request,
  { params }: { params: { view: string; zoom: string; tile_x: string; tile_y: string } }
) {
  const z = parseInt(params.zoom, 10);
  const x = parseInt(params.tile_x, 10);
  const y = parseInt(params.tile_y.replace(/\.png$/, ""), 10);
  if ([z, x, y].some((n) => Number.isNaN(n))) {
    return new Response("Invalid tile coordinates", { status: 400 });
  }
  const png = renderTile(`pollution_${params.view}`, "pollution", z, x, y);
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
