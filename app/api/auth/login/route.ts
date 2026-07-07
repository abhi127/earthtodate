import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  isValidEmail,
  makeUser,
  sessionCookieOptions,
  signSession,
} from "@/lib/authServer";

// Mock credential check: any email + non-empty password signs in.
// Emails containing "admin" get the admin role.
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { email, password } = body;
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 1) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const user = makeUser("", email);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, signSession(user), sessionCookieOptions());
  return res;
}
