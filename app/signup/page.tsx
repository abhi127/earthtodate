"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];
const COLORS = ["#f87171", "#fbbf24", "#fbbf24", "#34d399", "#34d399"];

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => Math.min(4, Math.floor(password.length / 3)), [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signup(name, email, password);
      router.push("/verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="New account"
      title="Start exploring the planet"
      subtitle="Five sensor families, 40+ spectral indices, one fast map."
      scene={{
        view: "s2_ndvi",
        label: "Western Mediterranean",
        meta: "Sentinel-2 · NDVI · 10 m",
        lat: 36.7,
        lon: 5.6,
        zoom: 5,
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Full name">
          <Input
            placeholder="Ada Lovelace"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
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
          <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-txt-secondary">
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Choose a strong password"
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

          {/* strength meter */}
          <div className="mt-2.5 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{ background: i < score ? COLORS[score] : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
          <div
            className="mono mt-1.5 text-[10.5px] uppercase tracking-[0.14em]"
            style={{ color: password ? COLORS[score] : "#5f6d7a" }}
          >
            {password ? STRENGTH[score] : "12+ characters recommended"}
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create Account"}
        </Button>

        <p className="flex items-center gap-1.5 text-[11px] text-txt-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          By continuing you agree to the Terms &amp; Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
