import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  return NextResponse.json({ user });
}
