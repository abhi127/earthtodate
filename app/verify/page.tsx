"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function VerifyPage() {
  const { verify, resend, pendingEmail, devCode, ready } = useAuth();
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [count, setCount] = useState(42);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // No pending signup (deep link / expired session) → back to signup.
  useEffect(() => {
    if (ready && !pendingEmail) router.replace("/signup");
  }, [ready, pendingEmail, router]);

  useEffect(() => {
    if (count <= 0) return;
    const t = setInterval(() => setCount((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [count]);

  const filled = digits.every((d) => d !== "");

  function setDigit(i: number, v: string) {
    const c = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = c;
      return next;
    });
    if (c && i < 5) refs.current[i + 1]?.focus();
  }

  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (txt) {
      e.preventDefault();
      setDigits(txt.padEnd(6, "").split("").slice(0, 6).map((c) => c || ""));
      refs.current[Math.min(txt.length, 5)]?.focus();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verify(digits.join(""));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
      setBusy(false);
    }
  }

  async function doResend() {
    try {
      await resend();
      setCount(42);
      setError(null);
      setDigits(Array(6).fill(""));
      refs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    }
  }

  return (
    <AuthShell
      icon={<MailCheck className="h-6 w-6 text-accent" />}
      title="Verify your email"
      subtitle={
        pendingEmail
          ? `Enter the 6-digit code we sent to ${pendingEmail}.`
          : "Enter the 6-digit code we sent to your inbox."
      }
      footer={
        <Link href="/signup" className="font-semibold text-accent hover:underline">
          Use a different email
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="flex justify-center gap-2" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className="h-14 w-12 rounded-xl border border-line bg-input text-center text-[22px] font-semibold text-txt-primary focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent-subtle"
            />
          ))}
        </div>

        {devCode && (
          <p className="text-center text-[11.5px] text-txt-muted">
            No email service in this demo — your code is{" "}
            <span className="mono font-semibold text-accent">{devCode}</span>
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-[12.5px] text-bad">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={!filled || busy}>
          {busy ? "Verifying…" : filled ? "Verify & Continue" : "Enter code"}
        </Button>
        <div className="text-center text-[12.5px] text-txt-muted">
          {count > 0 ? (
            <>Resend code · 0:{String(count).padStart(2, "0")}</>
          ) : (
            <button type="button" onClick={doResend} className="text-accent hover:underline">
              Resend code
            </button>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
