import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/authServer";

// Always responds ok (never leaks whether an account exists).
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
