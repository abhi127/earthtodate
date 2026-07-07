import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Satellite,
  Gauge,
  Wind,
  Mountain,
  Eye,
  Download,
  Search,
  MapPin,
  Check,
  ChevronDown,
} from "lucide-react";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import { Button, Card, Eyebrow, Pill, StatusPing } from "@/components/ui";

const CAPABILITIES = [
  "Sentinel-2 · 10m",
  "Super-resolution · 50cm",
  "NDVI & 40+ indices",
  "Sentinel-1 SAR",
  "PlanetScope · 3m",
  "VIIRS night lights",
  "Soil salinity",
  "Grassland biomass",
  "Elevation · 1m DEM",
  "Air quality",
  "Flood simulation",
  "Change detection",
];

const FEATURES = [
  {
    icon: Layers,
    tag: "200+ views",
    title: "Every layer, one map",
    body: "Sentinel-2, Landsat, PlanetScope, SAR and night lights — plus true-color, false-color band combos and 40+ spectral indices, all switchable instantly.",
  },
  {
    icon: Gauge,
    tag: "up to 50cm",
    title: "Super-resolved imagery",
    body: "Reconstructed 2m, super-resolved 50cm and refined-reality products bring detail far beyond native sensor resolution.",
  },
  {
    icon: Wind,
    tag: "analytics",
    title: "Beyond pixels",
    body: "Read elevation, air quality, soil moisture and salinity at any point. Trace a sightline, define an AOI, export imagery or a shapefile.",
  },
];

const STEPS = [
  { n: "01", icon: Search, title: "Find a place", body: "Search or pan the globe to your area of interest." },
  { n: "02", icon: Layers, title: "Pick a layer", body: "Choose a sensor and visualization from 200+ views." },
  { n: "03", icon: Eye, title: "Inspect", body: "Click to read elevation, air quality and indices." },
  { n: "04", icon: Download, title: "Export", body: "Download AOI imagery or a shapefile for your GIS." },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    credits: "3 credits",
    desc: "For trying things out.",
    features: ["Sentinel-2 true color", "Basic indices (NDVI, NDWI)", "Point inspect", "Community support"],
    cta: "Start free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    credits: "50 credits",
    desc: "For working analysts.",
    features: ["All Sentinel-2 + Landsat", "40+ spectral indices", "SAR & night lights", "AOI & shapefile export", "Sightline & DEM tools"],
    cta: "Go Pro",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$149",
    credits: "200 credits",
    desc: "For teams & orgs.",
    features: ["Super-resolution 50cm", "Analytics (salinity, biomass)", "Mineral maps (gated)", "Admin console & seats", "Priority support"],
    cta: "Contact sales",
    popular: false,
  },
];

const FAQS = [
  ["Is this using real satellite data?", "This standalone build generates synthetic imagery on the server so it runs with no credentials. Point the API layer at the real Earth to Date base URL to go live."],
  ["Which sensors are supported?", "Sentinel-2 (10m down to 50cm super-res), Landsat, PlanetScope, Sentinel-1 SAR, and VIIRS night lights — plus derived analytics products."],
  ["What can I measure?", "Elevation from the 1m DEM, air quality, 40+ spectral indices, line-of-sight visibility, and areas of interest you can export."],
  ["Do I need GIS software?", "No — everything runs in the browser. Exports (PNG imagery and GeoJSON) drop straight into QGIS, ArcGIS or your own pipeline."],
];

export default function Landing() {
  return (
    <>
      <PublicNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-10%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-elevated/60 px-3 py-1.5">
              <StatusPing />
              <span className="mono text-[11px] text-txt-secondary">Trusted by field teams worldwide</span>
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-[52px]">
              See the planet, <span className="text-gradient-earth">up to date</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-txt-secondary">
              Satellite imagery for everyone. Browse Sentinel, Landsat, PlanetScope, SAR and night
              lights, run spectral indices and analytics, and export what you need — all from one
              fast map.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button href="/workspace" size="lg">
                Open the map <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/signup" variant="ghost" size="lg">
                Create account
              </Button>
            </div>
          </div>

          {/* live tile preview window */}
          <HeroWindow />
        </div>
      </section>

      {/* capabilities marquee */}
      <section id="layers" className="border-y border-line bg-surface/60 py-5">
        <div className="mask-edges overflow-hidden">
          <div className="marquee flex w-max gap-3">
            {[...CAPABILITIES, ...CAPABILITIES].map((c, i) => (
              <span
                key={i}
                className="whitespace-nowrap rounded-full border border-line bg-elevated px-4 py-1.5 mono text-[12px] text-txt-secondary"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="mb-14 text-center">
          <Eyebrow>Capabilities</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[38px]">
            One workspace for the whole spectrum
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} hover className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-muted">
                  <f.icon className="h-5 w-5 text-accent" />
                </div>
                <Pill tone="accent">{f.tag}</Pill>
              </div>
              <h3 className="text-[19px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-txt-secondary">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="mb-14 text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[38px]">
              From orbit to answer in four steps
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.n} className="relative overflow-hidden p-6">
                <span className="absolute right-3 top-1 text-[52px] font-bold text-white/[0.03]">
                  {s.n}
                </span>
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent-muted">
                  <s.icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-[16px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-txt-secondary">{s.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24">
        <div className="mb-14 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[38px]">
            Simple, credit-based plans
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={`relative p-6 ${
                t.popular ? "border-accent/40 shadow-glow" : ""
              }`}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Pill tone="accent">Most popular</Pill>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h3 className="text-[18px] font-semibold">{t.name}</h3>
                <Pill>{t.credits}</Pill>
              </div>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold">{t.price}</span>
                <span className="mb-1 text-[13px] text-txt-muted">/mo</span>
              </div>
              <p className="mt-1 text-[13px] text-txt-secondary">{t.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] text-txt-secondary">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                href="/signup"
                variant={t.popular ? "accent" : "ghost"}
                className="mt-6 w-full"
              >
                {t.cta}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-24">
        <div className="mb-12 text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[38px]">Good to know</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map(([q, a], i) => (
            <details
              key={i}
              open={i === 0}
              className="group rounded-xl border border-line bg-card px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium">
                {q}
                <ChevronDown className="h-4 w-4 text-txt-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-txt-secondary">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* cta band */}
      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent-muted to-transparent p-12 text-center shadow-glow">
          <Satellite className="mx-auto mb-4 h-8 w-8 text-accent" />
          <h2 className="text-3xl font-bold tracking-tight">Start exploring in seconds</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-txt-secondary">
            No setup, no credentials. Jump straight into the map or create an account to save your
            work.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button href="/workspace" size="lg">
              Open the map <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="/signup" variant="ghost" size="lg">
              Create account
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function HeroWindow() {
  // build a small live map preview from real generated tiles
  const z = 4;
  const cols = [6, 7, 8, 9];
  const rows = [5, 6, 7];
  return (
    <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-2xl border border-line bg-card shadow-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="ml-3 flex items-center gap-1.5 rounded-md bg-input px-2.5 py-1">
          <MapPin className="h-3 w-3 text-txt-muted" />
          <span className="mono text-[11px] text-txt-muted">earthtodate.com/workspace</span>
        </div>
      </div>
      <div className="relative">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {rows.map((y) =>
            cols.map((x) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${x}-${y}`}
                src={`/api/v2/s2_tci/${z}/${x}/${y}`}
                alt=""
                className="block aspect-square w-full"
              />
            ))
          )}
        </div>
        {/* floating layer chips */}
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <span className="rounded-lg border border-accent/30 bg-accent-muted px-2.5 py-1 mono text-[11px] text-accent">
            s2_tci · 10m
          </span>
          <span className="rounded-lg border border-line bg-card/80 px-2.5 py-1 mono text-[11px] text-txt-secondary backdrop-blur">
            + s2_ndvi
          </span>
        </div>
        <div className="absolute bottom-4 right-4 rounded-lg border border-line bg-card/85 px-3 py-1.5 mono text-[11px] text-txt-secondary backdrop-blur">
          48.85, 2.35 · z4
        </div>
      </div>
    </div>
  );
}
