"use client";

import { useState } from "react";
import { User as UserIcon, CreditCard, KeyRound, SlidersHorizontal, Copy, Plus, Check } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button, Card, Eyebrow, Field, Input, Pill } from "@/components/ui";
import { useRequireAuth } from "@/lib/auth";

type Tab = "account" | "billing" | "apikeys" | "prefs";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "billing", label: "Plan & Credits", icon: CreditCard },
  { id: "apikeys", label: "API Keys", icon: KeyRound },
  { id: "prefs", label: "Preferences", icon: SlidersHorizontal },
];

export default function SettingsPage() {
  const { user, ready } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("account");
  if (!ready || !user) return null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10">
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Account settings</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-[200px_1fr]">
          {/* tab rail */}
          <nav className="flex gap-1 overflow-x-auto md:flex-col">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  tab === t.id
                    ? "bg-accent-muted text-accent"
                    : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </nav>

          {/* panel */}
          <div>
            {tab === "account" && <AccountTab name={user.name} email={user.email} org={user.org} admin={user.role === "admin"} />}
            {tab === "billing" && <BillingTab plan={user.plan} credits={user.credits} />}
            {tab === "apikeys" && <ApiKeysTab />}
            {tab === "prefs" && <PrefsTab />}
          </div>
        </div>
      </main>
    </>
  );
}

function SaveButton() {
  const [saved, setSaved] = useState(false);
  return (
    <Button
      onClick={() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }}
    >
      {saved ? (
        <>
          <Check className="h-4 w-4" /> Saved
        </>
      ) : (
        "Save changes"
      )}
    </Button>
  );
}

function AccountTab({ name, email, org, admin }: { name: string; email: string; org: string; admin: boolean }) {
  const [n, setN] = useState(name);
  const [e, setE] = useState(email);
  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-muted text-[22px] font-bold text-accent">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="text-[16px] font-semibold">{n}</div>
          <div className="text-[13px] text-txt-muted">{e}</div>
        </div>
      </div>
      <div className="space-y-4">
        <Field label="Full name">
          <Input value={n} onChange={(ev) => setN(ev.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={e} onChange={(ev) => setE(ev.target.value)} />
        </Field>
        <Field label="Organization">
          <div className="flex items-center gap-2">
            <Input value={org} readOnly className="flex-1" />
            {admin && <Pill tone="indigo">Org Admin</Pill>}
          </div>
        </Field>
        <SaveButton />
      </div>
    </Card>
  );
}

function BillingTab({ plan, credits }: { plan: string; credits: number }) {
  const cap = plan === "Enterprise" ? 500 : plan === "Pro" ? 250 : 10;
  const pct = Math.min(100, Math.round((credits / cap) * 100));
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[16px] font-semibold">{plan} plan</div>
            <div className="mt-0.5 text-[13px] text-txt-muted">
              {plan === "Enterprise" ? "$149/mo" : plan === "Pro" ? "$49/mo" : "$0/mo"} · renews Aug 7, 2026
            </div>
          </div>
          <Button variant="ghost" href="/#pricing">
            Manage plan
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">Credits used</span>
          <span className="mono text-txt-secondary">
            {credits} / {cap}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-txt-muted">
          Credits cover AOI exports, shapefile downloads and analytics products.
        </p>
      </Card>
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys] = useState([
    { masked: "etd_live_••••8f2a", created: "May 12, 2026" },
    { masked: "etd_live_••••c791", created: "Jun 28, 2026" },
  ]);
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15px] font-semibold">API keys</div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setKeys((k) => [
              ...k,
              {
                masked: `etd_live_••••${Math.random().toString(16).slice(2, 6)}`,
                created: "Jul 7, 2026",
              },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Create new key
        </Button>
      </div>
      <div className="divide-y divide-line rounded-xl border border-line">
        {keys.map((k, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="mono text-[13px]">{k.masked}</div>
              <div className="text-[11.5px] text-txt-muted">Created {k.created}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(k.masked).catch(() => {});
                setCopied(i);
                setTimeout(() => setCopied(null), 1500);
              }}
              className="grid h-8 w-8 place-items-center rounded-lg border border-line text-txt-secondary hover:bg-cardhover hover:text-txt-primary"
              title="Copy key"
            >
              {copied === i ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-txt-muted">
        Use keys with the imagery API, e.g.{" "}
        <span className="mono">/api/mineralmap?api_key=demo-mineral-access</span>
      </p>
    </Card>
  );
}

function PrefsTab() {
  const rows = [
    { label: "Default view", options: ["s2_tci — Sentinel-2 true color", "sr_tci — Super-res 50cm", "dem — Elevation"] },
    { label: "Units", options: ["Metric (m, km)", "Imperial (ft, mi)"] },
    { label: "Auto-fly on search", options: ["Enabled", "Disabled"] },
    { label: "Default basemap style", options: ["Deep Field dark", "Plain dark"] },
  ];
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {rows.map((r) => (
          <Field key={r.label} label={r.label}>
            <select className="input !py-2.5 !text-[13.5px]">
              {r.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Field>
        ))}
        <SaveButton />
      </div>
    </Card>
  );
}
