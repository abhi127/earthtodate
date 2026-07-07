"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, ShieldCheck } from "lucide-react";
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
      icon={<UserPlus className="h-6 w-6 text-accent" />}
      title="Create your account"
      subtitle="Start exploring the planet in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
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
        <Field label="Password">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Choose a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        {/* strength meter */}
        <div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i < score ? COLORS[score] : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
          <div className="mt-1.5 text-[11px]" style={{ color: password ? COLORS[score] : "#5f6d7a" }}>
            {password ? STRENGTH[score] : "Use 12+ characters for a strong password"}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create Account"}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-txt-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          By continuing you agree to the Terms & Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}
