"use client";

import Link from "next/link";
import { forwardRef } from "react";

// ---- Logo / wordmark -------------------------------------------------------

export function Logo({ size = 36 }: { size?: number }) {
  const s = size * 0.56;
  return (
    <div
      className="grid place-items-center rounded-lg bg-accent-muted"
      style={{ width: size, height: size }}
    >
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#31d0aa" strokeWidth="1.6" />
        <path d="M3 12a9 9 0 0 1 18 0" stroke="#31d0aa" strokeWidth="1.6" opacity="0.5" />
        <ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="#31d0aa" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="2" fill="#31d0aa" />
      </svg>
    </div>
  );
}

export function Wordmark({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Logo size={size} />
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight">Earth to Date</div>
        <div className="mono text-[9px] text-txt-muted">satellite imagery</div>
      </div>
    </Link>
  );
}

// ---- Button ----------------------------------------------------------------

type BtnProps = {
  variant?: "accent" | "ghost" | "subtle";
  size?: "sm" | "md" | "lg";
  as?: "button" | "a";
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
const btnVariants: Record<string, string> = {
  accent: "bg-accent text-root hover:bg-accent-hover shadow-glow",
  ghost: "border border-line bg-elevated text-txt-secondary hover:bg-cardhover hover:text-txt-primary",
  subtle: "text-txt-secondary hover:text-txt-primary hover:bg-white/5",
};
const btnSizes: Record<string, string> = {
  sm: "px-3 py-1.5 text-[12.5px]",
  md: "px-4 py-2.5 text-[13.5px]",
  lg: "px-5 py-3 text-[15px]",
};

export function Button({
  variant = "accent",
  size = "md",
  href,
  className = "",
  children,
  ...rest
}: BtnProps) {
  const cls = `${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

// ---- Card -------------------------------------------------------------------

export function Card({
  className = "",
  children,
  hover,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-card ${
        hover ? "transition-all hover:border-line2 hover:bg-cardhover hover:-translate-y-0.5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ---- Input / Field ----------------------------------------------------------

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg bg-input border border-line px-3.5 py-2.5 text-[14px] text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent-subtle ${className}`}
        {...rest}
      />
    );
  }
);

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-txt-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-txt-muted">{hint}</span>}
    </label>
  );
}

// ---- Pill / eyebrow / status ------------------------------------------------

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "ok" | "warn" | "bad" | "indigo";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-txt-secondary border-line",
    accent: "bg-accent-muted text-accent border-accent/30",
    ok: "bg-ok/12 text-ok border-ok/25",
    warn: "bg-warn/12 text-warn border-warn/25",
    bad: "bg-bad/12 text-bad border-bad/25",
    indigo: "bg-[#818cf8]/15 text-[#a5b0ff] border-[#818cf8]/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow text-accent">{children}</div>;
}

export function StatusPing({ color = "#34d399" }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping2"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
