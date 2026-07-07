"use client";

import { useCallback, useMemo, useState } from "react";
import MapCanvas, { type MapMarker } from "@/components/MapCanvas";
import LayerCatalog from "@/components/LayerCatalog";
import ToolDock, { type Tool, type InspectData } from "@/components/ToolDock";
import Legend from "@/components/Legend";
import { familyForView } from "@/lib/views";

export default function Page() {
  const [activeView, setActiveView] = useState("s2_tci");
  const [opacity, setOpacity] = useState(1);
  const [pollutionOn, setPollutionOn] = useState(false);

  const [date, setDate] = useState("2026-07-07");
  const [daysBack, setDaysBack] = useState(90);
  const [maxClouds, setMaxClouds] = useState(30);

  const [tool, setTool] = useState<Tool>("inspect");
  const [center, setCenter] = useState({ lat: 30, lon: 8, zoom: 3.2 });

  const [inspectPoint, setInspectPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const [losPts, setLosPts] = useState<[number, number][]>([]);
  const [aoiPts, setAoiPts] = useState<[number, number][]>([]);

  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number; zoom: number; nonce: number } | null>(null);
  const [search, setSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const family = useMemo(() => familyForView(activeView), [activeView]);

  const aoiBbox = useMemo<[number, number, number, number] | null>(() => {
    if (aoiPts.length < 2) return null;
    const [a, b] = aoiPts;
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
  }, [aoiPts]);

  const losLine = useMemo<[number, number][] | null>(
    () => (losPts.length === 2 ? losPts : null),
    [losPts]
  );

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    if (inspectPoint) m.push({ id: "insp", lat: inspectPoint.lat, lon: inspectPoint.lon, kind: "inspect" });
    losPts.forEach((p, i) => m.push({ id: `los${i}`, lat: p[0], lon: p[1], kind: "los", label: `P${i + 1}` }));
    aoiPts.forEach((p, i) => m.push({ id: `aoi${i}`, lat: p[0], lon: p[1], kind: "aoi" }));
    return m;
  }, [inspectPoint, losPts, aoiPts]);

  const runInspect = useCallback(async (lat: number, lon: number) => {
    setInspectPoint({ lat, lon });
    setInspectLoading(true);
    try {
      const ll = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      const [dem, pollution, geocode] = await Promise.all([
        fetch(`/api/dem_at_lat_lon?lat_lon=${ll}`).then((r) => r.json()),
        fetch(`/api/pollution_value?lat_lon=${ll}`).then((r) => r.json()),
        fetch(`/api/pollution_geocode?lat_lon=${ll}`).then((r) => r.json()),
      ]);
      setInspectData({ dem, pollution, geocode });
    } finally {
      setInspectLoading(false);
    }
  }, []);

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      if (tool === "los") {
        setLosPts((p) => (p.length >= 2 ? [[lat, lon]] : [...p, [lat, lon]]));
      } else if (tool === "aoi") {
        setAoiPts((p) => (p.length >= 2 ? [[lat, lon]] : [...p, [lat, lon]]));
      } else {
        setTool("inspect");
        runInspect(lat, lon);
      }
    },
    [tool, runInspect]
  );

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!search.trim()) return;
    const r = await fetch(`/api/pollution_geocode?q=${encodeURIComponent(search)}`);
    const j = await r.json();
    if (typeof j.lat === "number") {
      setFlyTo({ lat: j.lat, lon: j.lon, zoom: 8, nonce: Date.now() });
      setTool("inspect");
      runInspect(j.lat, j.lon);
    }
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapCanvas
        view={activeView}
        opacity={opacity}
        pollutionOn={pollutionOn}
        markers={markers}
        aoi={aoiBbox}
        losLine={losLine}
        flyTo={flyTo}
        onClick={onMapClick}
        onMove={(lat, lon, zoom) => setCenter({ lat, lon, zoom })}
      />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-3">
        <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 shadow-panel">
          <Logo />
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-tight">Earth to Date</div>
            <div className="mono text-[9px] text-txt-muted">v3.1.0 · satellite imagery</div>
          </div>
        </div>

        <form onSubmit={doSearch} className="glass pointer-events-auto flex items-center gap-2 rounded-xl border border-line px-3 py-2 shadow-panel">
          <span className="text-txt-muted text-[13px]">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a place…"
            className="w-44 bg-transparent text-[13px] text-txt-primary placeholder:text-txt-muted focus:outline-none"
          />
        </form>

        <div className="flex-1" />

        <div className="glass pointer-events-auto hidden items-center gap-4 rounded-xl border border-line px-3.5 py-2.5 shadow-panel md:flex">
          <Stat label="lat" value={center.lat.toFixed(3)} />
          <Stat label="lon" value={center.lon.toFixed(3)} />
          <Stat label="zoom" value={center.zoom.toFixed(1)} />
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 animate-ping2" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            <span className="mono text-[10px] text-txt-muted">mock live</span>
          </span>
        </div>
      </header>

      {/* Left: layer catalog */}
      <aside
        className={`glass absolute left-3 top-[72px] bottom-3 z-10 w-[320px] rounded-2xl border border-line shadow-panel transition-transform duration-300 ${
          leftOpen ? "translate-x-0" : "-translate-x-[336px]"
        }`}
      >
        <LayerCatalog
          active={activeView}
          onSelect={setActiveView}
          opacity={opacity}
          onOpacity={setOpacity}
          pollutionOn={pollutionOn}
          onPollution={setPollutionOn}
        />
      </aside>
      <PanelToggle open={leftOpen} onClick={() => setLeftOpen((v) => !v)} side="left" />

      {/* Right: tools */}
      <aside
        className={`glass absolute right-3 top-[72px] bottom-3 z-10 w-[320px] rounded-2xl border border-line shadow-panel transition-transform duration-300 ${
          rightOpen ? "translate-x-0" : "translate-x-[336px]"
        }`}
      >
        <ToolDock
          tool={tool}
          setTool={setTool}
          activeView={activeView}
          center={center}
          date={date}
          setDate={setDate}
          daysBack={daysBack}
          setDaysBack={setDaysBack}
          maxClouds={maxClouds}
          setMaxClouds={setMaxClouds}
          inspectPoint={inspectPoint}
          inspectData={inspectData}
          inspectLoading={inspectLoading}
          losPts={losPts}
          clearLos={() => setLosPts([])}
          aoiBbox={aoiBbox}
          clearAoi={() => setAoiPts([])}
        />
      </aside>
      <PanelToggle open={rightOpen} onClick={() => setRightOpen((v) => !v)} side="right" />

      {/* Bottom-left legend + mode hint */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        {tool === "los" && (
          <ModeHint>Sightline mode · click two points on the map</ModeHint>
        )}
        {tool === "aoi" && (
          <ModeHint>AOI mode · click two corners on the map</ModeHint>
        )}
      </div>
      <div className={`absolute bottom-4 z-10 ${rightOpen ? "right-[344px]" : "right-4"} transition-all`}>
        <Legend family={family} view={activeView} />
      </div>
    </main>
  );
}

function Logo() {
  return (
    <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-muted">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#31d0aa" strokeWidth="1.6" />
        <path d="M3 12a9 9 0 0 1 18 0" stroke="#31d0aa" strokeWidth="1.6" opacity="0.5" />
        <ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="#31d0aa" strokeWidth="1.4" />
        <circle cx="12" cy="12" r="2" fill="#31d0aa" />
      </svg>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="mono text-[8px] uppercase tracking-widest text-txt-subtle">{label}</div>
      <div className="mono text-[12px] text-txt-secondary">{value}</div>
    </div>
  );
}

function ModeHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass animate-fadein rounded-full border border-accent/30 px-4 py-2 text-[12px] text-accent shadow-panel">
      {children}
    </div>
  );
}

function PanelToggle({
  open,
  onClick,
  side,
}: {
  open: boolean;
  onClick: () => void;
  side: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={`glass absolute top-1/2 z-20 grid h-10 w-6 -translate-y-1/2 place-items-center rounded-md border border-line text-txt-muted shadow-panel transition-all hover:text-txt-primary ${
        side === "left"
          ? open
            ? "left-[332px]"
            : "left-3"
          : open
          ? "right-[332px]"
          : "right-3"
      }`}
      aria-label={`toggle ${side} panel`}
    >
      {side === "left" ? (open ? "‹" : "›") : open ? "›" : "‹"}
    </button>
  );
}
