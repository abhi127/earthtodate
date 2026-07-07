"use client";

// API-backed auth context. Session lives in an httpOnly cookie set by
// /api/auth/*; this context mirrors it client-side via /api/auth/me.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface User {
  name: string;
  email: string;
  role: "admin" | "member";
  plan: "Free" | "Pro" | "Enterprise";
  credits: number;
  org: string;
}

interface AuthCtx {
  user: User | null;
  ready: boolean;
  pendingEmail: string | null;
  devCode: string | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  verify: (code: string) => Promise<User>;
  resend: () => Promise<void>;
  forgot: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PENDING = "etd-pending";

const Ctx = createContext<AuthCtx | null>(null);

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
  return json as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string>("");
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING);
      if (raw) {
        const p = JSON.parse(raw);
        setPendingEmail(p.email ?? null);
        setPendingName(p.name ?? "");
        setDevCode(p.devCode ?? null);
      }
    } catch {}
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user && setUser(j.user))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setPending = (email: string | null, name: string, code: string | null) => {
    setPendingEmail(email);
    setPendingName(name);
    setDevCode(code);
    try {
      if (email) sessionStorage.setItem(PENDING, JSON.stringify({ email, name, devCode: code }));
      else sessionStorage.removeItem(PENDING);
    } catch {}
  };

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await api<{ user: User }>("/api/auth/login", { email, password });
    setUser(u);
    return u;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const { devCode: code } = await api<{ ok: true; devCode: string }>("/api/auth/signup", {
      name,
      email,
      password,
    });
    setPending(email, name, code);
  }, []);

  const verify = useCallback(
    async (code: string) => {
      const { user: u } = await api<{ user: User }>("/api/auth/verify", {
        email: pendingEmail,
        code,
      });
      setUser(u);
      setPending(null, "", null);
      return u;
    },
    [pendingEmail]
  );

  const resend = useCallback(async () => {
    if (!pendingEmail) return;
    const { devCode: code } = await api<{ ok: true; devCode: string }>("/api/auth/resend", {
      name: pendingName,
      email: pendingEmail,
    });
    setPending(pendingEmail, pendingName, code);
  }, [pendingEmail, pendingName]);

  const forgot = useCallback(async (email: string) => {
    await api("/api/auth/forgot", { email });
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await api("/api/auth/logout", {});
  }, []);

  return (
    <Ctx.Provider
      value={{ user, ready, pendingEmail, devCode, login, signup, verify, resend, forgot, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

// Client-side route guard (middleware.ts is the server-side gate).
export function useRequireAuth(opts: { admin?: boolean } = {}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (opts.admin && user.role !== "admin") router.replace("/dashboard");
  }, [ready, user, opts.admin, router]);
  return { user, ready };
}
