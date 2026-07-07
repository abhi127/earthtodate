"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Secure access"
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      scene={{
        view: "s2_tci",
        label: "Île-de-France, France",
        meta: "Sentinel-2 · true color · 10 m",
        lat: 48.8566,
        lon: 2.3522,
        zoom: 6,
      }}
      footer={
        <>
          New to Earth to Date?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="text-[12.5px] font-medium text-txt-secondary">
              Password
            </label>
            <Link href="/forgot" className="text-[12px] text-txt-muted transition-colors hover:text-accent">
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted transition-colors hover:text-txt-primary"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Establishing session…" : "Sign In"}
        </Button>

        <div className="flex items-center gap-2 rounded-lg border border-line bg-elevated/50 px-3 py-2">
          <span className="mono text-[9.5px] uppercase tracking-[0.18em] text-txt-muted">demo</span>
          <span className="text-[11.5px] text-txt-secondary">
            any email works · <span className="mono">admin@…</span> unlocks the admin console
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
