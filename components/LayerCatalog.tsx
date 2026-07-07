"use client";

import { useMemo, useState } from "react";
import { VIEW_GROUPS, getView, type ViewDef } from "@/lib/views";

const FAMILY_TAG: Record<string, string> = {
  tci: "TCI",
  bandviz: "RGB",
  index: "INDEX",
  sar: "SAR",
  nightlight: "NIGHT",
  pollution: "AIR",
  dem: "DEM",
  analytics: "ANALYTIC",
  scl: "SCL",
  flood: "FLOOD",
  changes: "CHANGE",
  mineral: "MINERAL",
};

export default function LayerCatalog({
  active,
  onSelect,
  opacity,
  onOpacity,
  pollutionOn,
  onPollution,
}: {
  active: string;
  onSelect: (id: string) => void;
  opacity: number;
  onOpacity: (v: number) => void;
  pollutionOn: boolean;
  onPollution: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return VIEW_GROUPS;
    return VIEW_GROUPS.map((g) => ({
      group: g.group,
      views: g.views.filter(
        (v) =>
          v.id.toLowerCase().includes(query) ||
          v.label.toLowerCase().includes(query) ||
          (v.notes || "").toLowerCase().includes(query)
      ),
    })).filter((g) => g.views.length > 0);
  }, [q]);

  const activeDef = getView(active);
  const total = VIEW_GROUPS.reduce((n, g) => n + g.views.length, 0);

  const isOpen = (g: string) => (q ? true : open[g] ?? g.startsWith("Sentinel-2 · s2 "));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-line">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Imagery layers</h2>
          <span className="mono text-[10px] text-txt-muted">{total} views</span>
        </div>
        {activeDef && (
          <div className="mt-2 rounded-lg bg-accent-subtle border border-accent-muted px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="mono text-[10px] rounded bg-accent-muted text-accent px-1.5 py-0.5">
                {FAMILY_TAG[activeDef.family]}
              </span>
              <span className="mono text-[11px] text-accent truncate">{activeDef.id}</span>
              {activeDef.gated && <span className="mono text-[9px] text-warn">🔒 GATED</span>}
            </div>
            {activeDef.notes && (
              <p className="mt-1 text-[11px] leading-snug text-txt-secondary">{activeDef.notes}</p>
            )}
            {activeDef.resolution && (
              <p className="mt-0.5 mono text-[10px] text-txt-muted">res {activeDef.resolution}</p>
            )}
          </div>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search e.g. ndvi, sar, s2r2m…"
          className="mt-3 w-full rounded-lg bg-elevated border border-line px-3 py-2 text-[13px] text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent-subtle"
        />
        <label className="mt-3 flex items-center justify-between text-[12px] text-txt-secondary">
          <span>Layer opacity</span>
          <span className="mono text-[10px] text-txt-muted">{Math.round(opacity * 100)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacity(parseFloat(e.target.value))}
          className="mt-1 w-full accent-accent"
        />
        <button
          onClick={() => onPollution(!pollutionOn)}
          className={`mt-3 w-full rounded-lg border px-3 py-2 text-[12px] transition-colors ${
            pollutionOn
              ? "bg-accent-muted border-accent/40 text-accent"
              : "bg-elevated border-line text-txt-secondary hover:bg-cardhover"
          }`}
        >
          {pollutionOn ? "◉ Pollution overlay on" : "○ Pollution overlay"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map(({ group, views }) => (
          <div key={group} className="mb-1">
            <button
              onClick={() => setOpen((o) => ({ ...o, [group]: !isOpen(group) }))}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-elevated"
            >
              <span className="eyebrow text-txt-muted">{group}</span>
              <span className="mono text-[10px] text-txt-subtle">
                {isOpen(group) ? "−" : `${views.length}`}
              </span>
            </button>
            {isOpen(group) && (
              <div className="mt-0.5">
                {views.map((v) => (
                  <LayerRow key={v.id} v={v} active={v.id === active} onSelect={onSelect} />
                ))}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] text-txt-muted">No layers match “{q}”.</p>
        )}
      </div>
    </div>
  );
}

function LayerRow({
  v,
  active,
  onSelect,
}: {
  v: ViewDef;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(v.id)}
      className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
        active ? "bg-accent-muted" : "hover:bg-elevated"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          active ? "bg-accent" : "bg-txt-subtle group-hover:bg-txt-muted"
        }`}
      />
      <span className={`flex-1 truncate text-[12.5px] ${active ? "text-accent" : "text-txt-secondary"}`}>
        {v.label}
      </span>
      {v.gated && <span className="text-[10px]">🔒</span>}
      {v.resolution && (
        <span className="mono text-[9px] text-txt-subtle shrink-0">{v.resolution}</span>
      )}
    </button>
  );
}
