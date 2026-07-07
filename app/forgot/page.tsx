"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const SCENE = {
  view: "dem",
  label: "Balearic Rise",
  meta: "ETD elevation · 1 m DEM",
  lat: 38.5,
  lon: 4.0,
  zoom: 5,
};

export default function ForgotPage() {
  const { forgot } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    try {
      await forgot(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? `We sent a reset link to ${email}. It expires in 30 minutes.`
          : "Enter your email and we'll send you a reset link."
      }
      scene={SCENE}
      footer={
        <Link href="/login" className="font-semibold text-accent hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-xl border border-ok/25 bg-ok/10 px-4 py-3.5">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
          <div className="text-[13px] leading-relaxed text-ok">
            Reset link sent. Follow the email to choose a new password.
          </div>
        </div>
      ) : (
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
          {error && (
            <div role="alert" className="rounded-lg border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad">
              {error}
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send Reset Link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
