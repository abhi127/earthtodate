import styles from './Legend.module.css';

// ── Legend data ──────────────────────────────────────────────────

const SCL_CLASSES = [
  { color: 'rgb(0, 0, 0)', label: 'No Data' },
  { color: 'rgb(255, 0, 255)', label: 'Saturated' },
  { color: 'rgb(50, 50, 50)', label: 'Shadows' },
  { color: 'rgb(100, 100, 100)', label: 'Cloud shadows' },
  { color: 'rgb(34, 139, 34)', label: 'Vegetation' },
  { color: 'rgb(210, 180, 140)', label: 'Not-vegetated' },
  { color: 'rgb(0, 100, 200)', label: 'Water' },
  { color: 'rgb(128, 128, 128)', label: 'Unclassified' },
  { color: 'rgb(200, 200, 200)', label: 'Cloud medium' },
  { color: 'rgb(220, 220, 220)', label: 'Cloud high' },
  { color: 'rgb(240, 240, 255)', label: 'Thin cirrus' },
  { color: 'rgb(255, 255, 255)', label: 'Snow or ice' },
];

const MINERAL_CLASSES = [
  { color: 'rgb(0, 0, 0)', label: 'Background' },
  { color: 'rgb(255, 100, 0)', label: 'Ferric Type A (Hem/Jar)' },
  { color: 'rgb(165, 42, 42)', label: 'Ferric Type B (Goethite)' },
  { color: 'rgb(255, 0, 255)', label: 'Hydroxyl-bearing' },
  { color: 'rgb(0, 255, 0)', label: 'Ferrous/Propylitic' },
  { color: 'rgb(255, 255, 0)', label: 'Mixed Fe+OH' },
  { color: 'rgb(255, 255, 255)', label: 'Complex Alteration' },
];

const SALINITY_CLASSES = [
  { color: 'rgb(0, 100, 0)', label: 'Non-saline (0-20)' },
  { color: 'rgb(144, 238, 144)', label: 'Slight (20-40)' },
  { color: 'rgb(255, 255, 0)', label: 'Moderate (40-60)' },
  { color: 'rgb(255, 165, 0)', label: 'Severe (60-80)' },
  { color: 'rgb(255, 0, 0)', label: 'Extreme (80-100)' },
];

const LULC_PALETTE = {
  'water':        [30, 90, 200],
  'wetland':      [60, 150, 150],
  'snow':         [240, 245, 255],
  'ice':          [180, 220, 240],
  'cloud':        [210, 215, 230],
  'veg-dense':    [15, 85, 25],
  'veg-mid':      [75, 165, 60],
  'veg-low':      [175, 210, 90],
  'veg-sparse':   [215, 230, 175],
  'bare':         [145, 105, 70],
  'rock':         [95, 75, 55],
  'sand':         [235, 210, 150],
  'built-dark':   [130, 25, 25],
  'built-bright': [255, 90, 90],
  'construction': [220, 45, 45],
  'industrial':   [175, 50, 200],
  'paved-road':   [0, 200, 255],
  'dirt-road':    [255, 200, 0],
  'mixed':        [130, 130, 130],
  'noise':        [60, 60, 60],
  'shadow':       [45, 45, 70],
  'saturated':    [255, 100, 255],
};

const WC_LEGEND = [
  [[0, 100, 0], 'Tree cover'],
  [[255, 187, 34], 'Shrubland'],
  [[255, 255, 76], 'Grassland'],
  [[240, 150, 255], 'Cropland'],
  [[250, 0, 0], 'Built-up'],
  [[180, 180, 180], 'Bare / sparse veg'],
  [[240, 240, 240], 'Snow / ice'],
  [[0, 100, 200], 'Permanent water'],
  [[0, 150, 160], 'Herbaceous wetland'],
  [[0, 207, 117], 'Mangroves'],
  [[250, 230, 160], 'Moss / lichen'],
];

const POLLUTION_GASES = [
  { key: 'no2', label: 'NO₂', color: '213,94,0' },
  { key: 'so2', label: 'SO₂', color: '240,228,66' },
  { key: 'co', label: 'CO', color: '86,180,233' },
  { key: 'ch4', label: 'CH₄', color: '204,121,167' },
  { key: 'hcho', label: 'HCHO', color: '0,158,115' },
  { key: 'aer_ai', label: 'Aerosol', color: '230,159,0' },
];

// ── Sub-components ───────────────────────────────────────────────

function ColorItem({ color, label }) {
  return (
    <div className={styles.item}>
      <div className={styles.swatch} style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function GradientBar({ colors, labels }) {
  return (
    <div>
      <div className={styles.gradient} style={{ background: `linear-gradient(to right, ${colors.join(', ')})` }} />
      <div className={styles.gradientLabels}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

// ── Legend body per viewtype ─────────────────────────────────────

function LegendBody({ viewtype }) {
  // SCL
  if (viewtype === 's2_scl' || viewtype.endsWith('_scl')) {
    return (
      <>
        <div className={styles.title}>Scene Classification</div>
        {SCL_CLASSES.map(c => <ColorItem key={c.label} color={c.color} label={c.label} />)}
      </>
    );
  }

  // Mineral
  if (viewtype.includes('mineral')) {
    return (
      <>
        <div className={styles.title}>Mineral Classification</div>
        {MINERAL_CLASSES.map(c => <ColorItem key={c.label} color={c.color} label={c.label} />)}
      </>
    );
  }

  // LULC
  if (viewtype.endsWith('_lulc')) {
    return (
      <>
        <div className={styles.title}>Land Cover</div>
        {Object.entries(LULC_PALETTE).map(([name, rgb]) => (
          <ColorItem key={name} color={`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`} label={name} />
        ))}
      </>
    );
  }

  // WorldCover
  if (viewtype === 'worldcover') {
    return (
      <>
        <div className={styles.title}>WorldCover (ESA 2021)</div>
        {WC_LEGEND.map(([rgb, label]) => (
          <ColorItem key={label} color={`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`} label={label} />
        ))}
      </>
    );
  }

  // Soil Moisture
  if (viewtype.endsWith('_soilmoisture') || viewtype === 's2r2m_soilmoisture') {
    return (
      <>
        <div className={styles.title}>Soil Moisture</div>
        <GradientBar
          colors={['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']}
          labels={['Dry', 'Moist']}
        />
      </>
    );
  }

  // Soil Salinity Score
  if (viewtype.endsWith('_soilsalinity') && !viewtype.endsWith('class') && !viewtype.endsWith('confidence')) {
    return (
      <>
        <div className={styles.title}>Salinity Score</div>
        <GradientBar
          colors={['#313695','#4575b4','#74add1','#abd9e9','#e0f3f8','#ffffbf','#fee090','#fdae61','#f46d43','#d73027','#a50026']}
          labels={['0', '50', '100']}
        />
      </>
    );
  }

  // Soil Salinity Categories
  if (viewtype.includes('soilsalinityclass')) {
    return (
      <>
        <div className={styles.title}>Soil Salinity</div>
        {SALINITY_CLASSES.map(c => <ColorItem key={c.label} color={c.color} label={c.label} />)}
      </>
    );
  }

  // Pollution — combined
  if (viewtype.startsWith('pollution') && viewtype.endsWith('_overlay')) {
    const isDelta = viewtype.endsWith('_delta_overlay');
    const core = viewtype.slice(0, isDelta ? -'_delta_overlay'.length : -'_overlay'.length);
    const isCombined = core === 'pollution';
    const gas = (!isCombined) ? core.slice('pollution_'.length) : null;

    if (gas && isDelta) {
      return (
        <>
          <div className={styles.title}>{gas.toUpperCase()} — vs baseline (Δ)</div>
          <GradientBar
            colors={['#1e5aeb','#3a90e0','#cccccc','#e0703a','#eb2020']}
            labels={['Below', 'Baseline', 'Above']}
          />
        </>
      );
    }
    if (gas) {
      const m = POLLUTION_GASES.find(g => g.key === gas);
      if (m) {
        const c = m.color.split(',').map(Number);
        const light = c.map(x => Math.round(x * 0.15 + 255 * 0.85)).join(',');
        const dark = c.map(x => Math.round(x * 0.55)).join(',');
        return (
          <>
            <div className={styles.title}>{m.label} — level (Σ)</div>
            <GradientBar
              colors={[`rgb(${light})`, `rgb(${m.color})`, `rgb(${dark})`]}
              labels={['Low', 'High']}
            />
          </>
        );
      }
    }
    return (
      <>
        <div className={styles.title}>Pollution<br />{isDelta ? 'Above baseline (Δ)' : 'Leading pollutant (Σ)'}</div>
        {POLLUTION_GASES.map(g => (
          <ColorItem key={g.key} color={`rgb(${g.color})`} label={g.label} />
        ))}
      </>
    );
  }

  return null;
}

// ── Main component ───────────────────────────────────────────────

export default function SatelliteLegend({ viewtype, right, docked }) {
  if (!viewtype) return null;

  const showFor = [
    's2_scl', '_scl',
    'mineral', '_mineralmap', '_mineralclass',
    '_lulc',
    'worldcover',
    '_soilmoisture',
    '_soilsalinity', '_soilsalinityclass', '_soilsalinityconfidence',
    'pollution',
  ];
  const visible = showFor.some(key => viewtype.includes(key));
  if (!visible) return null;

  return (
    <div className={`${styles.legend} ${right ? styles.right : ''} ${docked ? styles.docked : ''}`}>
      <LegendBody viewtype={viewtype} />
    </div>
  );
}
