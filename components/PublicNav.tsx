"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark, Button } from "./ui";
import { useAuth } from "@/lib/auth";

const LINKS = [
  { label: "Layers", href: "/#layers" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

export default function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? "glass border-b border-line" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Wordmark />
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13.5px] text-txt-secondary transition-colors hover:text-txt-primary"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          {user ? (
            <Button href="/dashboard" size="sm">
              Open app →
            </Button>
          ) : (
            <>
              <Button href="/login" variant="subtle" size="sm">
                Sign In
              </Button>
              <Button href="/signup" size="sm">
                Get Started
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
