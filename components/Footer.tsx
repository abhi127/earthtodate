import Link from "next/link";
import { Logo } from "./ui";

const COLS = [
  {
    title: "Product",
    links: [
      ["Layers", "/#layers"],
      ["Workspace", "/workspace"],
      ["Pricing", "/#pricing"],
      ["Dashboard", "/dashboard"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/#how"],
      ["Status", "/#faq"],
      ["Admin", "/admin"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Sign in", "/login"],
      ["Sign up", "/signup"],
      ["Settings", "/settings"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-[14px] font-bold">Earth to Date</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-txt-muted">
            Satellite imagery for everyone — Sentinel, Landsat, PlanetScope, SAR and night
            lights, with spectral indices and analytics.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="eyebrow mb-3 text-txt-muted">{c.title}</div>
            <ul className="space-y-2">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-txt-secondary hover:text-txt-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-[12px] text-txt-muted md:flex-row">
          <span>© 2026 Earth to Date · v3.1.0 · synthetic mock imagery</span>
          <span className="mono">Built for standalone demo — no live credentials</span>
        </div>
      </div>
    </footer>
  );
}
