"use client";

import Link from "next/link";
import {
  ArrowRight,
  Coins,
  Layers,
  Map as MapIcon,
  Satellite,
  Settings,
  Shield,
  Building2,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button, Card, Eyebrow, Pill } from "@/components/ui";
import { useRequireAuth } from "@/lib/auth";
import { VIEWS } from "@/lib/views";

const PLACES = [
  { name: "Paris", ll: "48.8566,2.3522", view: "s2_tci" },
  { name: "Nile Delta", ll: "30.8,31.0", view: "s2_ndvi" },
  { name: "Tokyo Bay", ll: "35.55,139.9", view: "nightlight25m_lighted" },
  { name: "Alps", ll: "45.9,7.6", view: "dem" },
];

export default function DashboardPage() {
  const { user, ready } = useRequireAuth();
  if (!ready || !user) return null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10">
        {/* greeting */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Dashboard</Eyebrow>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1.5 text-[14px] text-txt-secondary">
              Your workspace is ready — {VIEWS.length} imagery views across 5 sensor families.
            </p>
          </div>
          <Button href="/workspace" size="lg">
            Open the map <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Coins} label="Credits" value={String(user.credits)} sub={`${user.plan} plan`} />
          <StatCard icon={Layers} label="Imagery views" value={String(VIEWS.length)} sub="5 sensor families" />
          <StatCard icon={Building2} label="Organization" value={user.org} sub={user.role === "admin" ? "Org admin" : "Member"} />
          <StatCard icon={Satellite} label="API status" value="Operational" sub="mock live · all endpoints" ok />
        </div>

        {/* quick actions */}
        <div className="mt-10">
          <Eyebrow>Quick actions</Eyebrow>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ActionCard
              href="/workspace"
              icon={MapIcon}
              title="Explore the map"
              body="Browse layers, inspect points, trace sightlines and export AOIs."
            />
            <ActionCard
              href="/settings"
              icon={Settings}
              title="Account settings"
              body="Profile, plan & credits, API keys and viewer preferences."
            />
            {user.role === "admin" ? (
              <ActionCard
                href="/admin"
                icon={Shield}
                title="Admin console"
                body="Users, credit grants, payments and platform activity."
              />
            ) : (
              <ActionCard
                href="/#pricing"
                icon={Coins}
                title="Upgrade plan"
                body="More credits, super-resolution imagery and analytics products."
              />
            )}
          </div>
        </div>

        {/* snapshots from the live tile API */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <Eyebrow>Snapshots</Eyebrow>
            <Pill tone="accent">live from /api/history_snapshot</Pill>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLACES.map((p) => (
              <Link key={p.name} href="/workspace" className="group">
                <Card hover className="overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/history_snapshot?lat_lon=${p.ll}&view=${p.view}&zoom=7`}
                    alt={`${p.name} snapshot`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13.5px] font-semibold">{p.name}</span>
                    <span className="mono text-[10.5px] text-txt-muted">{p.view}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-txt-muted">
        <Icon className="h-4 w-4" />
        <span className="mono text-[10.5px] uppercase tracking-widest">{label}</span>
      </div>
      <div className={`mt-2 text-[22px] font-bold tracking-tight ${ok ? "text-ok" : ""}`}>{value}</div>
      <div className="mt-0.5 text-[12px] text-txt-muted">{sub}</div>
    </Card>
  );
}

function ActionCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link href={href}>
      <Card hover className="h-full p-5">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-muted">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <div className="text-[15px] font-semibold">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-txt-secondary">{body}</p>
      </Card>
    </Link>
  );
}
