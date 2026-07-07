import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  isValidEmail,
  makeUser,
  sessionCookieOptions,
  signSession,
  takePending,
} from "@/lib/authServer";

// Validates the 6-digit code for a pending signup and starts a session.
export async function POST(req: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { email, code } = body;
  if (!isValidEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const result = takePending(email, code);
  if (result === null) {
    return NextResponse.json(
      { error: "No pending signup for this email — the code may have expired." },
      { status: 400 }
    );
  }
  if (result === "mismatch") {
    return NextResponse.json({ error: "That code doesn't match. Try again." }, { status: 401 });
  }

  const user = makeUser(result.name, email);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, signSession(user), sessionCookieOptions());
  return res;
}
