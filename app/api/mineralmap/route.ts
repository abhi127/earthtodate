import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/mineralmap — permission-gated in the real API.
// The mock returns 403 to demonstrate the gate, plus the metadata a caller
// with access would receive.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("api_key") || req.headers.get("x-api-key");

  if (key !== "demo-mineral-access") {
    return NextResponse.json(
      {
        detail: "Mineral map is permission-gated.",
        hint: "Pass ?api_key=demo-mineral-access to preview in this mock.",
        gated: true,
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    view: "s2r2m_mineralmap",
    gated: true,
    granted: true,
    classes: [
      { id: 1, name: "Iron oxide", color: "#b44646" },
      { id: 2, name: "Clay / phyllosilicate", color: "#4690dc" },
      { id: 3, name: "Carbonate", color: "#dcaa3c" },
      { id: 4, name: "Silica / quartz", color: "#5ad2a0" },
      { id: 5, name: "Sulfate", color: "#b446c8" },
      { id: 6, name: "Unclassified", color: "#a0a0aa" },
    ],
    tile_template: "/api/v2/s2r2m_mineralmap/{z}/{x}/{y}",
  });
}
