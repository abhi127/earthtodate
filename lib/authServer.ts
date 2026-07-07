// Server-side auth: HMAC-signed session cookie + in-memory pending-signup store.
// Standalone/demo — swap the store for a real DB and set AUTH_SECRET in production.
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "etd_session";
const SECRET = process.env.AUTH_SECRET || "etd-demo-secret-do-not-use-in-prod";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  name: string;
  email: string;
  role: "admin" | "member";
  plan: "Free" | "Pro" | "Enterprise";
  credits: number;
  org: string;
}

export function makeUser(name: string, email: string): SessionUser {
  const admin = /admin/i.test(email);
  return {
    name: name || email.split("@")[0],
    email,
    role: admin ? "admin" : "member",
    plan: admin ? "Enterprise" : "Pro",
    credits: admin ? 500 : 240,
    org: admin ? "Earth to Date" : "Field Ops",
  };
}

// ---- signed token -----------------------------------------------------------

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

function hmac(data: string) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signSession(user: SessionUser): string {
  const payload = b64url(JSON.stringify({ ...user, iat: Date.now() }));
  return `${payload}.${hmac(payload)}`;
}

export function verifySession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.email || Date.now() - data.iat > MAX_AGE * 1000) return null;
    const { iat: _iat, ...user } = data;
    return user as SessionUser;
  } catch {
    return null;
  }
}

export function getSessionUser(): SessionUser | null {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

// ---- pending signups (verify codes) -----------------------------------------

interface Pending {
  name: string;
  code: string;
  ts: number;
}

const g = globalThis as unknown as { __etdPending?: Map<string, Pending> };
const pending = (g.__etdPending ||= new Map<string, Pending>());

export function createPending(name: string, email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  pending.set(email.toLowerCase(), { name, code, ts: Date.now() });
  return code;
}

export function takePending(email: string, code: string): { name: string } | "mismatch" | null {
  const p = pending.get(email.toLowerCase());
  if (!p || Date.now() - p.ts > 15 * 60 * 1000) return null;
  if (p.code !== code) return "mismatch";
  pending.delete(email.toLowerCase());
  return { name: p.name };
}

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
