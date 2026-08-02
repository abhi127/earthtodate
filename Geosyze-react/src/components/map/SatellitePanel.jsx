import { useState, useCallback, useEffect } from 'react';
import styles from './SatellitePanel.module.css';

// ── Constants (mirrored from ui.js) ─────────────────────────────────────

const PRODUCT_OPTIONS = {
  visual: 'Visual',
  // isometric: 'Isometric',
  spectral: 'Spectral',
  s1: 'SAR',
  nightlight: 'Night Light',
  changes_tci: 'Change Detection',
  _scl: 'Scene Classification',
  map: 'Open Street Map',
  aerial: 'Aerial',
  esriworldimagery: 'ESRI World Imagery',
  basemap: 'Basemap',
  dem: 'Elevation Map',
  worldcover: 'WorldCover (ESA 2021)',
  _soilmoisture: 'Soil Moisture',
  _bgwaterleak: 'Water Leak Warnings',
  flood: 'Flood Simulation',
  _biomassgrassland: 'Grassland Biomass',
  _lulc: 'Land Cover Classification',
  newconstruction: 'New Construction',
  soilsalinity: 'Soil Salinity',
  pollution: 'Pollution (Air Quality)',
  _mineralmap: 'Mineral Map',
};

const SENSOR_OPTIONS = {
  s2rr: '1m Refined Reality',
  sr: '50cm super-res x2',
  r5m: '5m Combined',
  s2r5m: '5m Sentinel-2',
  s2: '10m Sentinel-2',
  s2dr: '2m Derived Resolution',
  ls15: '15m Landsat',
  ls5: '5m Landsat',
  ps: '3m PlanetScope',
  psrr: '1.9m PlanetScope Refined Reality',
  pssrx2: '1.5m PlanetScope x2 Super-Res',
  pssrx4: '0.75m PlanetScope x4 Super-Res',
  cbers4a: '2m CBERS-4A',
  cbers4arr: '1m CBERS-4A Refined Reality',
};

const SPECTRAL_OPTIONS = {
  _veganalysis: 'NIR-Red-Green (Vegetation)',
  _natural: 'Red-Green-Blue (True Color)',
  _cropsoil: 'NIR-SWIR-Red (Crop/Soil)',
  _vegstress: 'SWIR-NIR-Red (Veg Stress)',
  _geology: 'SWIR-NIR-Blue (Geological)',
  _urban: 'NIR-SWIR-Blue (Urban)',
  _water: 'NIR-Red-Blue (Water)',
  _watercontent: 'SWIR-Red-Green (Water Content)',
  _atmosphere: 'NIR-Green-Blue (Atmospheric)',
  _burnscar: 'SWIR2-NIR-Red (Burn)',
  _snow: 'SWIR-Red-Green (Snow/Ice)',
  _bathymetric: 'Red-Green-Blue (Bathymetric)',
  _vegmoisture: 'SWIR-NIR-Green (Veg+Moisture)',
  _drought: 'SWIR2-SWIR1-Red (Drought)',
  _ndvi: 'NDVI',
  _ndwi: 'NDWI',
  _savi: 'SAVI',
  _msavi: 'MSAVI',
  _msavi2: 'MSAVI2',
  _evi: 'EVI',
  _evi2: 'EVI2',
  _nbr: 'NBR',
  _nbr2: 'NBR2',
  _ndre: 'NDRE',
  _ndre2: 'NDRE2',
  _ndre3: 'NDRE3',
  _cire: 'CIRE',
  _cire2: 'CIRE2',
  _cire3: 'CIRE3',
  _cig: 'CIG',
  _gndvi: 'GNDVI',
  _rvi: 'RVI',
  _dvi: 'DVI',
  _rdvi: 'RDVI',
  _osavi: 'OSAVI',
  _tsavi: 'TSAVI',
  _sr: 'SR',
  _sr2: 'SR2',
  _sipi: 'SIPI',
  _ari: 'ARI',
  _cri1: 'CRI1',
  _cri2: 'CRI2',
  _mcari: 'MCARI',
  _tcari: 'TCARI',
  _mre: 'MRE',
  _tre: 'TRE',
  _rendvi: 'RENDVI',
  _mtvi: 'MTVI',
  _mtvi2: 'MTVI2',
  _ndsi: 'NDSI',
  _bsi: 'BSI',
  _ndmi: 'NDMI',
  _lai: 'LAI',
  _cwc: 'CWC',
  _mineralclass: 'Mineral Class',
};

const POLLUTION_OPTIONS = {
  _combined: 'Combined',
  _no2: 'NO₂',
  _so2: 'SO₂',
  _co: 'CO',
  _ch4: 'CH₄',
  _hcho: 'HCHO',
  _aer_ai: 'Aerosol',
};

const SOIL_SALINITY_OPTIONS = {
  _soilsalinity: 'Score',
  _soilsalinityclass: 'Categories',
  _soilsalinityconfidence: 'Confidence',
};

const NIGHTLIGHT_OPTIONS = {
  nightlight25m_darkened: '25m Dark',
  nightlight25m_lighted: '25m Light',
  nightlight25m_tci: '25m Gray',
  nightlight500m_darkened: '500m Dark',
  nightlight500m_lighted: '500m Light',
  nightlight500m_tci: '500m Gray',
};

const S1_SUBVIEWS = {
  vvsr: 'VV 2m SR',
  vhsr: 'VH 2m SR',
  vv: 'VV 10m',
  vh: 'VH 10m',
  nisar_hh: 'NISAR HH',
  nisar_hv: 'NISAR HV',
  shipdetection: 'Ship Det',
};

const NEW_CONSTRUCTION_MONTHS = [1, 2, 3, 6, 12, 24, 36, 48, 60];

const NO_DATE_PRODUCTS = new Set([
  'map', 'aerial', 'esriworldimagery', 'basemap', 'dem', 'worldcover', 'pollution',
]);

const S2R2M_PRODUCTS = new Set([
  '_soilmoisture', '_fieldanomaly', '_bgwaterleak',
  '_biomassgrassland', '_lulc', '_mineralmap',
]);

// ── ViewType computation ────────────────────────────────────────────────

function computeViewtype({ product, sensor, spectral, soilSalinity, pollution, pollutionMode, nightlight, s1Subview }) {
  switch (product) {
    case 'visual':
      return (sensor || 's2') + '_tci';
    case 'spectral':
      if (spectral === '_mineralclass') return 's2r2m_mineralclass';
      return (sensor || 's2') + (spectral || '_ndvi');
    case 's1':
      if (s1Subview === 'shipdetection') return 'shipdetection_tci';
      if (s1Subview?.startsWith('nisar_')) return s1Subview + '_tci';
      return 's1' + (s1Subview || 'vvsr') + '_tci';
    case 'nightlight':
      return nightlight || 'nightlight25m_darkened';
    case 'soilsalinity':
      return 's2r2m' + (soilSalinity || '_soilsalinity');
    case 'pollution': {
      const g = pollution || '_combined';
      const mode = pollutionMode === 'delta' ? '_delta_overlay' : '_overlay';
      return g === '_combined' ? ('pollution' + mode) : ('pollution' + g + mode);
    }
    case 'newconstruction':
      return 'newconstruction_tci';
    case 'flood':
      return 'flood';
    case '_scl':
      return 's2_scl';
    default:
      if (S2R2M_PRODUCTS.has(product)) return 's2r2m' + product;
      return product || 'map';
  }
}

// ── Component ───────────────────────────────────────────────────────────

const SENSOR_SPECTRAL_ONLY = new Set(['s2dr', 's2']);

export default function SatellitePanel({ open, onViewtypeChange, right }) {
  const [product, setProduct] = useState('visual');
  const [sensor, setSensor] = useState(right ? 's2rr' : 's2');
  const [spectral, setSpectral] = useState('_ndvi');
  const [soilSalinity, setSoilSalinity] = useState('_soilsalinity');
  const [pollution, setPollution] = useState('_combined');
  const [pollutionMode, setPollutionMode] = useState('abs');
  const [nightlight, setNightlight] = useState('nightlight25m_darkened');
  const [s1Subview, setS1Subview] = useState('vvsr');
  const [newConstMonths, setNewConstMonths] = useState('12');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const viewtype = computeViewtype({
    product, sensor, spectral, soilSalinity, pollution, pollutionMode,
    nightlight, s1Subview,
  });

  const showSensor = product === 'visual' || product === 'spectral';
  const showSpectral = product === 'spectral';
  const showS1Subview = product === 's1';
  const showNightlight = product === 'nightlight';
  const showSoilSalinity = product === 'soilsalinity';
  const showPollution = product === 'pollution';
  const showNewConstruction = product === 'newconstruction';
  const showDate = !NO_DATE_PRODUCTS.has(product);

  // Notify parent
  useEffect(() => {
    if (onViewtypeChange) {
      onViewtypeChange({
        viewtype,
        date,
        months: product === 'newconstruction' ? parseInt(newConstMonths, 10) : undefined,
      });
    }
  }, [viewtype, date, newConstMonths, product, onViewtypeChange]);

  const handleProductChange = useCallback((e) => {
    const val = e.target.value;
    setProduct(val);
    if (val === 'spectral' && !SENSOR_SPECTRAL_ONLY.has(sensor)) setSensor('s2');
  }, [sensor]);

  if (!open) return null;

  // Build visible control list
  const controls = [
    { key: 'product', el: (
      <select key="product" className={styles.select} value={product} onChange={handleProductChange}>
        {Object.entries(PRODUCT_OPTIONS).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
    )},
    ...(showSensor ? [{ key: 'sensor', el: (
      <select key="sensor" className={styles.select} value={sensor} onChange={e => setSensor(e.target.value)}>
        {Object.entries(SENSOR_OPTIONS)
          .filter(([k]) => product === 'spectral' ? SENSOR_SPECTRAL_ONLY.has(k) : true)
          .map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    )}] : []),
    ...(showSpectral ? [{ key: 'spectral', el: (
      <select key="spectral" className={styles.select} value={spectral} onChange={e => setSpectral(e.target.value)}>
        {Object.entries(SPECTRAL_OPTIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    )}] : []),
    ...(showS1Subview ? [{ key: 's1', el: (
      <select key="s1" className={styles.select} value={s1Subview} onChange={e => setS1Subview(e.target.value)}>
        {Object.entries(S1_SUBVIEWS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    )}] : []),
    ...(showNightlight ? [{ key: 'nightlight', el: (
      <select key="nightlight" className={styles.select} value={nightlight} onChange={e => setNightlight(e.target.value)}>
        {Object.entries(NIGHTLIGHT_OPTIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    )}] : []),
    ...(showSoilSalinity ? [{ key: 'soilsal', el: (
      <select key="soilsal" className={styles.select} value={soilSalinity} onChange={e => setSoilSalinity(e.target.value)}>
        {Object.entries(SOIL_SALINITY_OPTIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    )}] : []),
    ...(showPollution ? [
      { key: 'pollution', el: (
        <select key="pollution" className={styles.select} value={pollution} onChange={e => setPollution(e.target.value)}>
          {Object.entries(POLLUTION_OPTIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      )},
      { key: 'pollSigma', el: (
        <button key="pollSigma" className={`${styles.modeBtn} ${pollutionMode === 'abs' ? styles.modeActive : ''}`}
          onClick={() => setPollutionMode('abs')}>Σ</button>
      )},
      { key: 'pollDelta', el: (
        <button key="pollDelta" className={`${styles.modeBtn} ${pollutionMode === 'delta' ? styles.modeActive : ''}`}
          onClick={() => setPollutionMode('delta')}>Δ</button>
      )},
    ] : []),
    ...(showNewConstruction ? [{ key: 'newconst', el: (
      <select key="newconst" className={styles.select} value={newConstMonths} onChange={e => setNewConstMonths(e.target.value)}>
        {NEW_CONSTRUCTION_MONTHS.map(m => <option key={m} value={String(m)}>{m}mo</option>)}
      </select>
    )}] : []),
    ...(showDate ? [{ key: 'date', el: (
      <input key="date" type="date" className={styles.dateInput} value={date} onChange={e => setDate(e.target.value)} />
    )}] : []),
  ];

  const row1 = controls.slice(0, 3);
  const row2 = controls.slice(3);

  return (
    <div className={`${styles.bar} ${right ? styles.barRight : ''}`}>
      <div className={styles.row}>
        {row1.map(c => c.el)}
      </div>
      {row2.length > 0 && (
        <div className={styles.row}>
          {row2.map(c => c.el)}
        </div>
      )}
    </div>
  );
}
