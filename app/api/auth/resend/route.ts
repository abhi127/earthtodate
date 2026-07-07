import { NextResponse } from "next/server";
import { createPending, isValidEmail } from "@/lib/authServer";

// Re-issues a verification code for a pending signup.
export async function POST(req: Request) {
  let body: { name?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { name, email } = body;
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const devCode = createPending(typeof name === "string" ? name : "", email);
  return NextResponse.json({ ok: true, devCode });
}
