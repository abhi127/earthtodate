import Link from "next/link";
import { Logo } from "./ui";

// Centered card layout shared by login / signup / forgot / verify.
export default function AuthShell({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5 py-12">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link href="/" className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-muted">
            {icon || <Logo size={40} />}
          </Link>
          <h1 className="text-[25px] font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 max-w-[320px] text-[14px] leading-relaxed text-txt-secondary">
            {subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-card p-6 shadow-panel">{children}</div>

        {footer && <div className="mt-5 text-center text-[13px] text-txt-secondary">{footer}</div>}
      </div>
    </main>
  );
}
