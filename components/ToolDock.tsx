"use client";

import { useState } from "react";

export type Tool = "inspect" | "dates" | "los" | "aoi" | "mineral";

export interface InspectData {
  dem?: any;
  pollution?: any;
  geocode?: any;
}

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  activeView: string;
  center: { lat: number; lon: number; zoom: number };
  date: string;
  setDate: (v: string) => void;
  daysBack: number;
  setDaysBack: (v: number) => void;
  maxClouds: number;
  setMaxClouds: (v: number) => void;
  inspectPoint: { lat: number; lon: number } | null;
  inspectData: InspectData | null;
  inspectLoading: boolean;
  losPts: [number, number][];
  clearLos: () => void;
  aoiBbox: [number, number, number, number] | null;
  clearAoi: () => void;
}

const TABS: { id: Tool; label: string; icon: string }[] = [
  { id: "inspect", label: "Inspect", icon: "◎" },
  { id: "dates", label: "Dates", icon: "▤" },
  { id: "los", label: "Sightline", icon: "⟋" },
  { id: "aoi", label: "AOI", icon: "▢" },
  { id: "mineral", label: "Mineral", icon: "◆" },
];

function fmt(n: number, d = 4) {
  return Number(n).toFixed(d);
}

export default function ToolDock(p: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => p.setTool(t.id)}
            className={`flex-1 px-1 py-2.5 text-[11px] font-medium transition-colors ${
              p.tool === t.id
                ? "text-accent border-b-2 border-accent bg-accent-subtle"
                : "text-txt-muted hover:text-txt-secondary border-b-2 border-transparent"
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {p.tool === "inspect" && <InspectPanel {...p} />}
        {p.tool === "dates" && <DatesPanel {...p} />}
        {p.tool === "los" && <LosPanel {...p} />}
        {p.tool === "aoi" && <AoiPanel {...p} />}
        {p.tool === "mineral" && <MineralPanel />}
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line2 bg-elevated/50 px-3 py-2.5 text-[12px] leading-relaxed text-txt-muted">
      {children}
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-line/60 last:border-0">
      <span className="text-[12px] text-txt-muted">{k}</span>
      <span className={`mono text-[12px] ${accent ? "text-accent" : "text-txt-primary"}`}>{v}</span>
    </div>
  );
}

function aqiColor(aqi: number) {
  if (aqi > 300) return "#c8283c";
  if (aqi > 200) return "#b446c8";
  if (aqi > 150) return "#f08c32";
  if (aqi > 100) return "#f0dc46";
  if (aqi > 50) return "#a8d84a";
  return "#50c878";
}

function InspectPanel(p: Props) {
  if (!p.inspectPoint) {
    return <Hint>Click anywhere on the map to read <b className="text-txt-secondary">elevation</b>, <b className="text-txt-secondary">air quality</b> and the <b className="text-txt-secondary">place name</b> at that point.</Hint>;
  }
  const { dem, pollution, geocode } = p.inspectData || {};
  return (
    <div className="space-y-4 animate-fadein">
      <div>
        <div className="eyebrow text-txt-muted mb-1">Location</div>
        <div className="text-[15px] font-semibold">{geocode?.place || "…"}</div>
        <div className="mono text-[11px] text-txt-muted">
          {fmt(p.inspectPoint.lat)}, {fmt(p.inspectPoint.lon)}
          {geocode?.region ? ` · ${geocode.region}` : ""}
        </div>
      </div>
      {p.inspectLoading && <div className="text-[12px] text-txt-muted">Sampling…</div>}
      {dem && (
        <div>
          <div className="eyebrow text-txt-muted mb-1">Elevation (DEM)</div>
          <Row k="Elevation" v={`${dem.elevation_m} m`} accent />
          <Row k="Surface" v={dem.surface} />
          <Row k="Vert. accuracy" v={`±${dem.vertical_accuracy_m} m`} />
        </div>
      )}
      {pollution && (
        <div>
          <div className="eyebrow text-txt-muted mb-1">Air quality</div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="flex h-14 w-14 flex-col items-center justify-center rounded-xl font-bold text-root"
              style={{ background: aqiColor(pollution.aqi) }}
            >
              <span className="text-[18px] leading-none">{pollution.aqi}</span>
              <span className="text-[8px] font-medium">AQI</span>
            </div>
            <div>
              <div className="text-[13px] font-semibold">{pollution.category}</div>
              <div className="mono text-[10px] text-txt-muted">air quality index</div>
            </div>
          </div>
          <Row k="PM2.5" v={`${pollution.pm25} µg/m³`} />
          <Row k="PM10" v={`${pollution.pm10} µg/m³`} />
          <Row k="NO₂" v={`${pollution.no2} ppb`} />
          <Row k="O₃" v={`${pollution.o3} ppb`} />
        </div>
      )}
    </div>
  );
}

function DatesPanel(p: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const latLon = `${p.center.lat.toFixed(4)},${p.center.lon.toFixed(4)}`;
      const url = `/api/dates/${latLon}/${p.activeView}/${p.date}/${p.daysBack}/${p.maxClouds}`;
      const r = await fetch(url);
      setData(await r.json());
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Hint>Available acquisition dates for the current map center and active layer, filtered by cloud cover.</Hint>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input
            type="date"
            value={p.date}
            onChange={(e) => p.setDate(e.target.value)}
            className="input"
          />
        </Field>
        <Field label={`Days back: ${p.daysBack}`}>
          <input type="range" min={5} max={365} step={5} value={p.daysBack} onChange={(e) => p.setDaysBack(+e.target.value)} className="w-full accent-accent" />
        </Field>
      </div>
      <Field label={`Max clouds: ${p.maxClouds}%`}>
        <input type="range" min={0} max={100} step={5} value={p.maxClouds} onChange={(e) => p.setMaxClouds(+e.target.value)} className="w-full accent-accent" />
      </Field>
      <button onClick={run} className="btn-accent w-full">
        {loading ? "Searching…" : "Find available dates"}
      </button>
      {err && <div className="text-[12px] text-bad">{err}</div>}
      {data && (
        <div className="space-y-1 animate-fadein">
          <div className="mono text-[10px] text-txt-muted">
            {data.dates.filter((d: any) => d.available).length} / {data.count} pass cloud filter
          </div>
          {data.dates.map((d: any) => (
            <div
              key={d.date}
              className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] ${
                d.available ? "bg-accent-subtle" : "bg-elevated/40 opacity-60"
              }`}
            >
              <span className="mono text-txt-secondary">{d.date}</span>
              <span
                className="mono text-[11px]"
                style={{ color: d.clouds < 20 ? "#34d399" : d.clouds < 50 ? "#fbbf24" : "#f87171" }}
              >
                ☁ {d.clouds}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LosPanel(p: Props) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  async function run() {
    if (p.losPts.length < 2) return;
    setLoading(true);
    const [a, b] = p.losPts;
    const url = `/api/los?p1=${a[0]},${a[1]}&p2=${b[0]},${b[1]}&obs_h=2&tgt_h=2`;
    const r = await fetch(url);
    setRes(await r.json());
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <Hint>Pick <b className="text-txt-secondary">two points</b> on the map to trace a terrain sightline and test inter-visibility.</Hint>
      <div className="space-y-1">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-md bg-elevated px-2.5 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warn" />
            <span className="mono text-[11px] text-txt-secondary flex-1">
              {p.losPts[i] ? `${fmt(p.losPts[i][0])}, ${fmt(p.losPts[i][1])}` : `pick point ${i + 1}…`}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={run} disabled={p.losPts.length < 2} className="btn-accent flex-1 disabled:opacity-40">
          {loading ? "Tracing…" : "Trace sightline"}
        </button>
        <button onClick={() => { p.clearLos(); setRes(null); }} className="btn-ghost">Clear</button>
      </div>
      {res && (
        <div className="space-y-2 animate-fadein">
          <div
            className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${
              res.visible ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"
            }`}
          >
            {res.visible ? "✓ Target is visible" : "✕ Line of sight blocked"}
          </div>
          <Row k="Distance" v={`${(res.distance_m / 1000).toFixed(2)} km`} />
          {res.obstruction && <Row k="Obstruction at" v={`${(res.obstruction.d / 1000).toFixed(2)} km`} />}
          <ElevChart samples={res.samples} />
        </div>
      )}
    </div>
  );
}

function ElevChart({ samples }: { samples: { d: number; ground: number }[] }) {
  if (!samples?.length) return null;
  const W = 240, H = 90, pad = 4;
  const maxD = samples[samples.length - 1].d || 1;
  const gs = samples.map((s) => s.ground);
  const min = Math.min(...gs, 0);
  const max = Math.max(...gs, 1);
  const span = max - min || 1;
  const x = (d: number) => pad + (d / maxD) * (W - 2 * pad);
  const y = (g: number) => H - pad - ((g - min) / span) * (H - 2 * pad);
  const area =
    `M ${x(0)} ${H - pad} ` +
    samples.map((s) => `L ${x(s.d).toFixed(1)} ${y(s.ground).toFixed(1)}`).join(" ") +
    ` L ${x(maxD)} ${H - pad} Z`;
  const line = "M " + samples.map((s) => `${x(s.d).toFixed(1)} ${y(s.ground).toFixed(1)}`).join(" L ");
  const sightY1 = y(samples[0].ground + 2);
  const sightY2 = y(samples[samples.length - 1].ground + 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-elevated border border-line">
      <path d={area} fill="#31d0aa" opacity={0.14} />
      <path d={line} fill="none" stroke="#31d0aa" strokeWidth={1.5} />
      <line x1={x(0)} y1={sightY1} x2={x(maxD)} y2={sightY2} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" />
    </svg>
  );
}

function AoiPanel(p: Props) {
  const [busy, setBusy] = useState(false);

  function download() {
    if (!p.aoiBbox) return;
    const [minLat, minLon, maxLat, maxLon] = p.aoiBbox;
    const bbox = `${minLat},${minLon},${maxLat},${maxLon}`;
    const url = `/api/v2/download_aoi/${bbox}/${p.date}/${p.daysBack}/${p.maxClouds}/${p.activeView}`;
    window.open(url, "_blank");
  }

  async function shapefile() {
    if (!p.aoiBbox) return;
    setBusy(true);
    const [minLat, minLon, maxLat, maxLon] = p.aoiBbox;
    const ring = [
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ];
    const r = await fetch(
      `/api/download_shapefile/${p.date}/${p.daysBack}/${p.maxClouds}/${p.activeView}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [ring] }),
      }
    );
    const blob = await r.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `etd_${p.activeView}_${p.date}.geojson`;
    a.click();
    URL.revokeObjectURL(u);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Hint>Click <b className="text-txt-secondary">two corners</b> on the map to define an area of interest, then export imagery or a shapefile.</Hint>
      {p.aoiBbox ? (
        <div className="rounded-lg bg-elevated border border-line px-3 py-2 space-y-1 animate-fadein">
          <Row k="SW" v={`${fmt(p.aoiBbox[0], 3)}, ${fmt(p.aoiBbox[1], 3)}`} />
          <Row k="NE" v={`${fmt(p.aoiBbox[2], 3)}, ${fmt(p.aoiBbox[3], 3)}`} />
          <Row k="Layer" v={p.activeView} accent />
        </div>
      ) : (
        <div className="text-[12px] text-txt-muted">No AOI defined yet.</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={download} disabled={!p.aoiBbox} className="btn-accent disabled:opacity-40">
          ↓ Imagery PNG
        </button>
        <button onClick={shapefile} disabled={!p.aoiBbox || busy} className="btn-ghost disabled:opacity-40">
          {busy ? "…" : "↓ Shapefile"}
        </button>
      </div>
      {p.aoiBbox && (
        <button onClick={p.clearAoi} className="btn-ghost w-full">Clear AOI</button>
      )}
    </div>
  );
}

function MineralPanel() {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  async function check(withKey: boolean) {
    setLoading(true);
    const r = await fetch(`/api/mineralmap${withKey ? "?api_key=demo-mineral-access" : ""}`);
    const j = await r.json();
    setState({ status: r.status, ...j });
    setUnlocked(r.status === 200);
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      <Hint>The mineral map / classification products are <b className="text-warn">permission-gated</b>. This mock simulates the access gate.</Hint>
      <div className="flex gap-2">
        <button onClick={() => check(false)} className="btn-ghost flex-1">Request (no key)</button>
        <button onClick={() => check(true)} className="btn-accent flex-1">
          {loading ? "…" : "Unlock demo"}
        </button>
      </div>
      {state && (
        <div className="animate-fadein">
          <div
            className={`rounded-lg px-3 py-2 text-[12px] font-medium ${
              unlocked ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
            }`}
          >
            {unlocked ? "✓ Access granted (demo key)" : `🔒 ${state.detail}`}
          </div>
          {unlocked && state.classes && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {state.classes.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                  <span className="text-[11px] text-txt-secondary">{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-txt-muted">{label}</span>
      {children}
    </label>
  );
}
