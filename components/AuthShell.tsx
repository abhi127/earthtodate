import { Wordmark, StatusPing } from "./ui";

// "Ground station" split layout shared by login / signup / forgot / verify.
// Left: card-free form column with staggered reveal. Right: a live imagery
// panel rendered from the app's own tile API, dressed as an observation
// instrument — graticule, targeting reticle, scan sweep, telemetry readouts.

export interface AuthScene {
  view: string;
  label: string;
  meta: string;
  lat: number;
  lon: number;
  zoom?: number;
}

const DEFAULT_SCENE: AuthScene = {
  view: "s2_tci",
  label: "Île-de-France, France",
  meta: "Sentinel-2 · true color · 10 m",
  lat: 48.8566,
  lon: 2.3522,
  zoom: 6,
};

function tileXY(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  scene,
}: {
  eyebrow: string;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scene?: AuthScene;
}) {
  const s = scene ?? DEFAULT_SCENE;
  const z = s.zoom ?? 6;
  const { x, y } = tileXY(s.lat, s.lon, z);
  const cols = [-2, -1, 0, 1];
  const rows = [-2, -1, 0, 1, 2];

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(460px,42%)_1fr]">
      {/* ---- form column ---- */}
      <section className="relative flex min-h-screen flex-col px-6 pb-6 pt-7 sm:px-12 lg:px-14">
        <div className="reveal">
          <Wordmark />
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="w-full max-w-[352px]">
            <div className="reveal reveal-1 eyebrow text-accent">{eyebrow}</div>
            <h1 className="reveal reveal-1 mt-3.5 font-display text-[34px] font-semibold leading-[1.04] tracking-tight">
              {title}
            </h1>
            <p className="reveal reveal-2 mt-3 text-[14px] leading-relaxed text-txt-secondary">
              {subtitle}
            </p>

            <div className="reveal reveal-3 mt-9">{children}</div>

            {footer && (
              <div className="reveal reveal-4 mt-9 border-t border-line pt-5 text-[13px] text-txt-secondary">
                {footer}
              </div>
            )}
          </div>
        </div>

        <div className="reveal reveal-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-txt-muted">
          <span className="mono whitespace-nowrap text-[10.5px]">© 2026 Earth to Date</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusPing />
            <span className="mono whitespace-nowrap text-[10.5px]">systems nominal</span>
          </span>
        </div>
      </section>

      {/* ---- live imagery instrument panel ---- */}
      <aside className="relative hidden overflow-hidden border-l border-line lg:block" aria-hidden="true">
        {/* tile mosaic from the real API, slowly drifting */}
        <div className="drift absolute -inset-10 grid grid-cols-4 grid-rows-5">
          {rows.map((dy) =>
            cols.map((dx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${dx},${dy}`}
                src={`/api/v2/${s.view}/${z}/${x + dx}/${y + dy}`}
                alt=""
                className="h-full w-full object-cover"
              />
            ))
          )}
        </div>

        {/* graticule */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
            backgroundSize: "76px 76px",
          }}
        />

        {/* seam into the form column + vignette */}
        <div className="absolute inset-0 bg-gradient-to-r from-root via-root/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-root/85 via-transparent to-root/50" />

        {/* scan sweep */}
        <div className="scanline absolute inset-x-0 h-px bg-accent/40 shadow-[0_0_28px_3px_rgba(49,208,170,0.3)]" />

        {/* targeting reticle */}
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute left-0 top-0 h-5 w-5 border-l border-t border-accent/50" />
          <span className="absolute right-0 top-0 h-5 w-5 border-r border-t border-accent/50" />
          <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-accent/50" />
          <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-accent/50" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/80 shadow-[0_0_12px_2px_rgba(49,208,170,0.5)]" />
          <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-accent/30" />
          <span className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-accent/30" />
        </div>

        {/* telemetry — top */}
        <div className="absolute right-6 top-6 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md border border-accent/25 bg-root/60 px-2.5 py-1.5 backdrop-blur-sm">
            <StatusPing />
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-accent">
              live downlink
            </span>
          </span>
          <span className="mono rounded-md border border-line bg-root/60 px-2.5 py-1.5 text-[10px] text-txt-secondary backdrop-blur-sm">
            {s.view}
          </span>
        </div>

        {/* telemetry — bottom */}
        <div className="absolute inset-x-6 bottom-6 flex items-end justify-between">
          <div>
            <div className="font-display text-[19px] font-medium tracking-tight text-txt-primary">
              {s.label}
            </div>
            <div className="mono mt-1 text-[11px] text-txt-secondary">
              {s.lat.toFixed(4)}°{s.lat >= 0 ? "N" : "S"} · {Math.abs(s.lon).toFixed(4)}°
              {s.lon >= 0 ? "E" : "W"} · z{z}
            </div>
          </div>
          <div className="mono text-right text-[10.5px] leading-relaxed text-txt-muted">
            {s.meta}
            <br />
            captured 2026-07-07 · clouds 3%
          </div>
        </div>
      </aside>
    </main>
  );
}
