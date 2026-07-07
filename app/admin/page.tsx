"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Coins,
  CreditCard,
  Activity,
  ArrowLeft,
  Search,
  UserPlus,
} from "lucide-react";
import { Button, Card, Input, Logo, Pill, StatusPing } from "@/components/ui";
import { useRequireAuth } from "@/lib/auth";

type View = "overview" | "users" | "credits" | "payments" | "activity";

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "credits", label: "Credits", icon: Coins },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "activity", label: "Activity Logs", icon: Activity },
];

export default function AdminPage() {
  const { user, ready } = useRequireAuth({ admin: true });
  const [view, setView] = useState<View>("overview");
  if (!ready || !user || user.role !== "admin") return null;

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo size={32} />
          <div className="leading-tight">
            <div className="text-[13.5px] font-bold">Earth to Date</div>
            <div className="eyebrow mt-0.5 text-[9px] text-[#a5b0ff]">Admin console</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                view === n.id
                  ? "bg-accent-muted text-accent"
                  : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
              }`}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </button>
          ))}
        </nav>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-t border-line px-5 py-4 text-[13px] text-txt-secondary hover:text-txt-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </aside>

      {/* main */}
      <div className="min-w-0 flex-1">
        <header className="glass sticky top-0 z-10 flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-bold tracking-tight">
              {NAV.find((n) => n.id === view)?.label}
            </h1>
            <span className="hidden items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 sm:flex">
              <StatusPing />
              <span className="mono text-[10px] text-ok">all systems ok</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[12.5px] text-txt-muted sm:block">{user.email}</span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-muted text-[12px] font-bold text-accent">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        {/* mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] ${
                view === n.id ? "bg-accent-muted text-accent" : "text-txt-secondary"
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>

        <main className="p-6">
          {view === "overview" && <Overview />}
          {view === "users" && <UsersView />}
          {view === "credits" && <CreditsView />}
          {view === "payments" && <PaymentsView />}
          {view === "activity" && <ActivityView />}
        </main>
      </div>
    </div>
  );
}

// ---- overview ---------------------------------------------------------------

const BARS = [34, 48, 41, 62, 55, 70, 66, 82, 74, 90, 85, 97];

function Overview() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value="2,481" delta="+128 this month" />
        <StatCard label="Active orgs" value="64" delta="+5 this month" />
        <StatCard label="Tiles served" value="48.2k" delta="+3.1k today" />
        <StatCard label="MRR" value="$18,640" delta="+12% MoM" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[14px] font-semibold">Tile requests / day</span>
            <Pill>last 12 days</Pill>
          </div>
          <div className="flex h-40 items-end gap-2">
            {BARS.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-md ${i === BARS.length - 1 ? "bg-accent" : "bg-white/10"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 text-[14px] font-semibold">Recent activity</div>
          <div className="space-y-3">
            {[
              ["ok", "New user signed up", "sofia@terra.io · 2m ago"],
              ["ok", "Payment received", "$49 Pro · atlas-geo · 18m ago"],
              ["ok", "AOI export", "12.4 MP png · field-ops · 41m ago"],
              ["warn", "Mineral map 403", "missing api key · 1h ago"],
              ["ok", "Org created", "Helios Survey · 3h ago"],
            ].map(([tone, title, sub], i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    tone === "warn" ? "bg-warn" : "bg-ok"
                  }`}
                />
                <div>
                  <div className="text-[13px]">{title}</div>
                  <div className="text-[11.5px] text-txt-muted">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <Card className="p-5">
      <div className="mono text-[10.5px] uppercase tracking-widest text-txt-muted">{label}</div>
      <div className="mt-2 text-[24px] font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[12px] text-ok">{delta}</div>
    </Card>
  );
}

// ---- users ------------------------------------------------------------------

const USERS = [
  ["Sofia Marin", "sofia@terra.io", "Org Admin", "Pro", "active", "2m ago"],
  ["Dev Patel", "dev@atlas-geo.com", "Member", "Pro", "active", "1h ago"],
  ["Lena Fischer", "lena@helios.dev", "Org Admin", "Enterprise", "active", "3h ago"],
  ["Marco Rossi", "marco@fieldops.io", "Member", "Free", "pending", "1d ago"],
  ["Aya Tanaka", "aya@survey.jp", "Member", "Pro", "active", "2d ago"],
  ["Tom Becker", "tom@geo-nord.de", "Member", "Free", "suspended", "6d ago"],
] as const;

function UsersView() {
  const [q, setQ] = useState("");
  const rows = USERS.filter(
    (u) => u[0].toLowerCase().includes(q.toLowerCase()) || u[1].toLowerCase().includes(q.toLowerCase())
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-txt-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users…"
            className="!w-64 !pl-9 !py-2 !text-[13px]"
          />
        </div>
        <Button size="sm">
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wider text-txt-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => (
              <tr key={u[1]} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{u[0]}</td>
                <td className="px-4 py-3 text-txt-secondary">{u[1]}</td>
                <td className="px-4 py-3">
                  <Pill tone={u[2] === "Org Admin" ? "indigo" : "neutral"}>{u[2]}</Pill>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={u[3] === "Enterprise" ? "accent" : "neutral"}>{u[3]}</Pill>
                </td>
                <td className="px-4 py-3">
                  <Pill tone={u[4] === "active" ? "ok" : u[4] === "pending" ? "warn" : "bad"}>{u[4]}</Pill>
                </td>
                <td className="px-4 py-3 text-txt-muted">{u[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---- credits ----------------------------------------------------------------

function CreditsView() {
  const [ledger, setLedger] = useState([
    ["atlas-geo", +200, "Enterprise top-up", "Jul 5, 2026"],
    ["sofia@terra.io", +50, "Pro renewal", "Jul 3, 2026"],
    ["field-ops", -24, "AOI exports", "Jul 2, 2026"],
    ["helios.dev", +200, "Enterprise renewal", "Jun 30, 2026"],
    ["marco@fieldops.io", -3, "Shapefile export", "Jun 29, 2026"],
  ] as [string, number, string, string][]);
  const [acct, setAcct] = useState("");
  const [amt, setAmt] = useState("");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 text-[14px] font-semibold">Grant credits</div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseInt(amt, 10);
            if (!acct || !n) return;
            setLedger((l) => [[acct, n, "Manual grant", "Jul 7, 2026"], ...l]);
            setAcct("");
            setAmt("");
          }}
        >
          <Input
            value={acct}
            onChange={(e) => setAcct(e.target.value)}
            placeholder="User or org"
            className="!w-56 !py-2 !text-[13px]"
          />
          <Input
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^\d-]/g, ""))}
            placeholder="Amount"
            className="!w-28 !py-2 !text-[13px]"
          />
          <Button size="sm" type="submit">
            Grant
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-[14px] font-semibold">Ledger</div>
        <div className="divide-y divide-line">
          {ledger.map(([who, change, reason, date], i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <div className="flex items-center gap-3">
                <span className={`mono w-14 text-right font-semibold ${change > 0 ? "text-ok" : "text-bad"}`}>
                  {change > 0 ? `+${change}` : change}
                </span>
                <span className="font-medium">{who}</span>
              </div>
              <div className="flex items-center gap-4 text-txt-muted">
                <span>{reason}</span>
                <span className="mono text-[11px]">{date}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---- payments ---------------------------------------------------------------

const ORDERS = [
  ["#10482", "atlas-geo", "$149", "Enterprise", "paid", "Jul 5, 2026"],
  ["#10481", "sofia@terra.io", "$49", "Pro", "paid", "Jul 3, 2026"],
  ["#10480", "geo-nord.de", "$49", "Pro", "failed", "Jul 2, 2026"],
  ["#10479", "helios.dev", "$149", "Enterprise", "paid", "Jun 30, 2026"],
  ["#10478", "survey.jp", "$49", "Pro", "pending", "Jun 29, 2026"],
] as const;

function PaymentsView() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR" value="$18,640" delta="+12% MoM" />
        <StatCard label="Txns this month" value="212" delta="+9% MoM" />
        <StatCard label="Failed" value="3" delta="1.4% failure rate" />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wider text-txt-muted">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ORDERS.map((o) => (
                <tr key={o[0]} className="hover:bg-white/[0.02]">
                  <td className="mono px-4 py-3">{o[0]}</td>
                  <td className="px-4 py-3">{o[1]}</td>
                  <td className="px-4 py-3 font-semibold">{o[2]}</td>
                  <td className="px-4 py-3 text-txt-secondary">{o[3]}</td>
                  <td className="px-4 py-3">
                    <Pill tone={o[4] === "paid" ? "ok" : o[4] === "pending" ? "warn" : "bad"}>{o[4]}</Pill>
                  </td>
                  <td className="px-4 py-3 text-txt-muted">{o[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---- activity ---------------------------------------------------------------

const LOGS = [
  ["ok", "auth.login", "sofia@terra.io signed in", "2m ago"],
  ["ok", "tiles.render", "s2_ndvi z8 · 214ms", "9m ago"],
  ["ok", "export.aoi", "field-ops · 12.4 MP png", "41m ago"],
  ["warn", "mineral.denied", "403 missing api key", "1h ago"],
  ["ok", "geocode.search", "\"nile delta\" → 30.8, 31.0", "2h ago"],
  ["ok", "auth.signup", "marco@fieldops.io pending verify", "1d ago"],
  ["bad", "payment.failed", "geo-nord.de card declined", "5d ago"],
] as const;

function ActivityView() {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-line">
        {LOGS.map(([tone, key, desc, when], i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 text-[13px]">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad"
              }`}
            />
            <span className="mono w-36 shrink-0 text-[12px] text-accent">{key}</span>
            <span className="flex-1 text-txt-secondary">{desc}</span>
            <span className="mono shrink-0 text-[11px] text-txt-muted">{when}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
