"use client";

import type { Family } from "@/lib/views";

const GRAD: Record<string, { label: string; css: string; ticks: [string, string] }> = {
  index: {
    label: "Index (low → high)",
    css: "linear-gradient(90deg,#785e46,#b4a05a,#c8d25a,#5aaf3c,#0c5c20)",
    ticks: ["bare", "dense"],
  },
  dem: {
    label: "Elevation",
    css: "linear-gradient(90deg,#0a1e3c,#286e6e,#285a3c,#c8be78,#966e5a,#fafaff)",
    ticks: ["−800 m", "3600 m"],
  },
  pollution: {
    label: "Air quality (AQI)",
    css: "linear-gradient(90deg,#50c878,#f0dc46,#f08c32,#c8283c)",
    ticks: ["good", "hazardous"],
  },
  analytics: {
    label: "Score (low → high)",
    css: "linear-gradient(90deg,#28825a,#e6d25a,#c8322d)",
    ticks: ["0", "100"],
  },
  sar: {
    label: "Backscatter",
    css: "linear-gradient(90deg,#0a0e14,#5a5f66,#eaf0f5)",
    ticks: ["low", "high"],
  },
  nightlight: {
    label: "Light intensity",
    css: "linear-gradient(90deg,#05070a,#4a4030,#ffd078)",
    ticks: ["dark", "bright"],
  },
};

const SWATCHES: Record<string, { label: string; items: [string, string][] }> = {
  scl: {
    label: "Scene classes",
    items: [
      ["#4890df", "Water"],
      ["#46963c", "Vegetation"],
      ["#96825a", "Bare soil"],
      ["#e8ecf0", "Cloud"],
      ["#788088", "Shadow"],
    ],
  },
  mineral: {
    label: "Mineral classes",
    items: [
      ["#b44646", "Iron oxide"],
      ["#4690dc", "Clay"],
      ["#dcaa3c", "Carbonate"],
      ["#5ad2a0", "Silica"],
      ["#b446c8", "Sulfate"],
    ],
  },
  changes: {
    label: "Change detection",
    items: [
      ["#3cdc78", "Gain"],
      ["#dc3c96", "Loss"],
    ],
  },
  flood: {
    label: "Flood simulation",
    items: [
      ["#2878c8", "Flooded"],
      ["#3a683a", "Dry land"],
    ],
  },
};

export default function Legend({ family, view }: { family: Family; view: string }) {
  const grad = GRAD[family];
  const sw = SWATCHES[family];
  if (!grad && !sw) return null;
  return (
    <div className="glass rounded-xl border border-line px-3.5 py-3 shadow-panel w-56 animate-fadein">
      <div className="eyebrow text-txt-muted mb-2">{grad?.label || sw?.label}</div>
      {grad && (
        <>
          <div className="h-2.5 rounded-full" style={{ background: grad.css }} />
          <div className="mt-1.5 flex justify-between mono text-[10px] text-txt-muted">
            <span>{grad.ticks[0]}</span>
            <span>{grad.ticks[1]}</span>
          </div>
        </>
      )}
      {sw && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {sw.items.map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
              <span className="text-[11px] text-txt-secondary">{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
