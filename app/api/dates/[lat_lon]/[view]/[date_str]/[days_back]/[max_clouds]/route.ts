import { NextResponse } from "next/server";
import { parseLatLon } from "@/lib/geo";
import { availableDates } from "@/lib/dates";

export const runtime = "nodejs";

// GET /api/dates/{lat_lon}/{view}/{date_str}/{days_back}/{max_clouds}
export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: {
      lat_lon: string;
      view: string;
      date_str: string;
      days_back: string;
      max_clouds: string;
    };
  }
) {
  const coord = parseLatLon(decodeURIComponent(params.lat_lon));
  if (!coord) {
    return NextResponse.json({ detail: "lat_lon must be LAT,LON" }, { status: 422 });
  }
  const daysBack = parseInt(params.days_back, 10) || 60;
  const maxClouds = parseInt(params.max_clouds, 10);
  const dates = availableDates(
    coord,
    params.view,
    params.date_str,
    daysBack,
    Number.isNaN(maxClouds) ? 100 : maxClouds
  );
  return NextResponse.json({
    lat_lon: coord,
    view: params.view,
    date_str: params.date_str,
    days_back: daysBack,
    max_clouds: maxClouds,
    count: dates.length,
    dates,
  });
}
