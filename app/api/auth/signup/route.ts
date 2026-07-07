import { NextResponse } from "next/server";
import { createPending, isValidEmail } from "@/lib/authServer";

// Registers a pending account and issues a 6-digit verification code.
// No email service in this standalone build, so the code is returned as
// `devCode` and surfaced in the UI.
export async function POST(req: Request) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { name, email, password } = body;
  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const devCode = createPending(name.trim(), email);
  return NextResponse.json({ ok: true, email, devCode });
}
