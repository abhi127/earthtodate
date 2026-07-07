"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Coins, Shield, Settings, LogOut, Map as MapIcon, LayoutDashboard } from "lucide-react";
import { Wordmark, Pill } from "./ui";
import { useAuth } from "@/lib/auth";

export default function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();

  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/workspace", label: "Map", icon: MapIcon },
  ];

  return (
    <header className="sticky top-0 z-40 glass border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <div className="flex items-center gap-6">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-accent-muted text-accent"
                      : "text-txt-secondary hover:bg-white/5 hover:text-txt-primary"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden sm:block">
              <Pill tone="accent">
                <Coins className="h-3 w-3" /> {user.credits} credits
              </Pill>
            </div>
          )}
          {user?.role === "admin" && (
            <Link
              href="/admin"
              title="Admin console"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-txt-secondary transition-colors hover:bg-cardhover hover:text-txt-primary"
            >
              <Shield className="h-4 w-4" />
            </Link>
          )}
          <Link
            href="/settings"
            title="Settings"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-txt-secondary transition-colors hover:bg-cardhover hover:text-txt-primary"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            onClick={async () => {
              await logout();
              router.push("/");
            }}
            title="Log out"
            className="grid h-9 w-9 place-items-center rounded-lg border border-line text-txt-secondary transition-colors hover:bg-cardhover hover:text-bad"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
