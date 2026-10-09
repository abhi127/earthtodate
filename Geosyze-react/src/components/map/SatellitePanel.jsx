import { useState, useCallback, useEffect, useRef } from 'react';
import DateCalendar from './DateCalendar';
import { SATELLITE_PANEL_START } from './satelliteDefaults';
import { resolveDatesLocation } from './datesLocation';
import { pickBestDate } from './satelliteDate';
import { RAIL_CATEGORIES } from './satelliteCategories';
import styles from './SatellitePanel.module.css';

const DATES_API_URL = '/api/tiles/dates';

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

export default function SatellitePanel({ open, onViewtypeChange, right, narrow, category, onCategoryChange, getViewCenter, compareActive, onToggleCompare, onAddMap, canAddMore, twoMaps, layoutMode, onLayoutChange, onCloseAll, relocateTick = 0 }) {
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Location the calendar queries availability for: snapshot of this panel's
  // map view center taken when the calendar opens (falls back to the panel
  // start location when the map isn't ready yet).
  const [calendarCenter, setCalendarCenter] = useState(SATELLITE_PANEL_START);
  const openCalendar = useCallback(() => {
    setCalendarCenter(resolveDatesLocation(getViewCenter?.(), SATELLITE_PANEL_START));
    setCalendarOpen(true);
  }, [getViewCenter]);
  const dateRequestCacheRef = useRef(new Map());
  const activeViewtypeRef = useRef('');

  // Fetch the best date for a location/viewtype (cached per day/viewtype/
  // location). Applies it only if the panel hasn't moved on to another
  // viewtype meanwhile.
  const resolveDefaultDate = useCallback((center, requestedViewtype) => {
    const today = new Date().toISOString().slice(0, 10);
    const effectiveView = requestedViewtype === 'r5m_tci' ? 's2r5m_tci' : requestedViewtype;
    const cacheKey = `${today}:${effectiveView}:${center.lat.toFixed(4)},${center.lon.toFixed(4)}`;
    let request = dateRequestCacheRef.current.get(cacheKey);

    if (!request) {
      const url = `${DATES_API_URL}/${center.lat.toFixed(4)},${center.lon.toFixed(4)}/${effectiveView}/${today}/365/100`;
      request = fetch(url)
        .then(r => (r.ok ? r.json() : []))
        .then(dates => pickBestDate(dates || []))
        .catch(() => null);
      dateRequestCacheRef.current.set(cacheKey, request);
    }

    return request.then(best => {
      if (best && activeViewtypeRef.current === requestedViewtype) setDate(best);
    });
  }, []);

  // Shared rail category changed → reset this panel's product if it no longer fits
  useEffect(() => {
    const list = (RAIL_CATEGORIES[category] ?? RAIL_CATEGORIES.visual).products;
    if (!list.includes(product)) setProduct(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const viewtype = computeViewtype({
    product, sensor, spectral, soilSalinity, pollution, pollutionMode,
    nightlight, s1Subview,
  });
  activeViewtypeRef.current = viewtype;

  // Resolve the default date once per product/day for the panel's fixed opening
  // location. Live map coordinates are intentionally not dependencies, so later
  // panning can neither repeat the lookup nor replace the selected date.
  // (Search jumps re-resolve via the relocateTick effect below.)
  useEffect(() => {
    if (!open || !viewtype) return;
    resolveDefaultDate(SATELLITE_PANEL_START, viewtype);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewtype]);

  // Search jump while open: after the fly-to animation settles, re-resolve the
  // default date for the map's new center so imagery matches the location.
  useEffect(() => {
    if (!open || !viewtype || !relocateTick) return undefined;
    const requestedViewtype = viewtype;
    const timer = setTimeout(() => {
      resolveDefaultDate(
        resolveDatesLocation(getViewCenter?.(), SATELLITE_PANEL_START),
        requestedViewtype
      );
    }, 700); // flyTo animates ~600ms; read the center after it lands
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relocateTick]);

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

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateSelect = (newDate) => {
    setDate(newDate);
    setCalendarOpen(false);
  };

  if (!open) return null;

  // Build visible control list
  const categoryProducts = (RAIL_CATEGORIES[category] ?? RAIL_CATEGORIES.visual).products;
  const controls = [
    { key: 'product', el: (
      <select key="product" className={styles.select} value={product} onChange={handleProductChange}>
        {categoryProducts.map(k => (
          <option key={k} value={k}>{PRODUCT_OPTIONS[k]}</option>
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
      <button
        key="date"
        type="button"
        className={styles.dateTrigger}
        onClick={openCalendar}
        title="Select date from calendar"
      >
        <span className={styles.dateTriggerText}>{formatDisplayDate(date)}</span>
        <svg className={styles.dateTriggerIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
    )}] : []),
    ...(onToggleCompare ? [{ key: 'compare', el: (
      <button
        key="compare"
        type="button"
        className={`${styles.modeBtn} ${compareActive ? styles.modeActive : ''}`}
        onClick={() => onToggleCompare?.()}
        title={compareActive ? 'Exit compare' : 'Compare maps'}
        aria-pressed={!!compareActive}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="18" rx="1" />
        </svg>
      </button>
    )}] : []),
  ];

  const row1 = controls.slice(0, 3);
  const row2 = controls.slice(3);

  // Compare controls merged up from the removed MapCompare bottom bar:
  // second row, visible only while compare is active.
  const showCompareRow = compareActive && (!!onAddMap || !!onLayoutChange || !!onCloseAll);

  return (
    <>
      <div className={`${styles.bar} ${right ? styles.barRight : ''} ${narrow ? styles.barNarrow : ''}`}>
        <div className={styles.row}>
          {row1.map(c => c.el)}
        </div>
        {row2.length > 0 && (
          <div className={styles.row}>
            {row2.map(c => c.el)}
          </div>
        )}
        {showCompareRow && (
          <div className={`${styles.row} ${styles.compareRow}`}>
            {onAddMap && canAddMore ? (
              <button
                type="button"
                className={styles.modeBtn}
                onClick={() => onAddMap?.()}
                title="Add map"
                aria-label="Add map"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
            ) : null}
            {onLayoutChange && twoMaps ? (
              <>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${layoutMode !== 'swipe' ? styles.modeActive : ''}`}
                  onClick={() => onLayoutChange('compare')}
                  title="Side by side"
                  aria-label="Side by side"
                  aria-pressed={layoutMode !== 'swipe'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${layoutMode === 'swipe' ? styles.modeActive : ''}`}
                  onClick={() => onLayoutChange('swipe')}
                  title="Swipe"
                  aria-label="Swipe"
                  aria-pressed={layoutMode === 'swipe'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
                </button>
              </>
            ) : null}
            {onCloseAll ? (
              <button
                type="button"
                className={styles.modeBtn}
                onClick={() => onCloseAll?.()}
                title="Close all extra maps"
                aria-label="Close all extra maps"
              >
                &times;
              </button>
            ) : null}
          </div>
        )}
      </div>
      <DateCalendar
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onDateSelect={handleDateSelect}
        lat={calendarCenter.lat}
        lon={calendarCenter.lon}
        viewtype={viewtype}
        selectedDate={date}
      />
    </>
  );
}
