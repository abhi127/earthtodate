import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './MeasureTool.module.css';

const ST = { IDLE: 'idle', MEASURING: 'measuring', RESULT: 'result' };

export default function MeasureTool({ map, measureCancelRef, onBeforeMeasureStart }) {
  const [state, setState] = useState(ST.IDLE);
  const [tooltipMsg, setTooltipMsg] = useState('');
  const [lastLat, setLastLat] = useState(null);
  const [lastLng, setLastLng] = useState(null);
  const [segDist, setSegDist] = useState(0);
  const [totalDist, setTotalDist] = useState(0);
  const [showArea, setShowArea] = useState(false);
  const [liveArea, setLiveArea] = useState(0);
  const [rDist, setRDist] = useState(null);
  const [rArea, setRArea] = useState(null);
  const [rPerim, setRPerim] = useState(null);
  const [rIsLine, setRIsLine] = useState(false);
  const [selectedFeat, setSelectedFeat] = useState(null);
  const [popupReady, setPopupReady] = useState(false);

  const ol = window.ol;
  const srcRef = useRef(null);
  const lyRef = useRef(null);
  const drawRef = useRef(null);
  const sketchRef = useRef(null);
  const selRef = useRef(null);
  const chgRef = useRef(null);
  const dblRef = useRef(null);
  const overlayRef = useRef(null);
  const popupNodeRef = useRef(null);
  const stateRef = useRef(ST.IDLE);

  stateRef.current = state;

  // ── vector source / layer ──────────────────────────────────────────
  useEffect(() => {
    if (!ol || !map) return;
    const src = new ol.source.Vector();
    const ly = new ol.layer.Vector({
      source: src,
      style: new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(34,197,94,0.15)' }),
        stroke: new ol.style.Stroke({ color: '#22C55E', width: 2 }),
        image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: '#22C55E' }) }),
      }),
    });
    ly.set('name', 'measure-layer');
    map.addLayer(ly);
    srcRef.current = src;
    lyRef.current = ly;
    return () => { map.removeLayer(ly); };
  }, [map, ol]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── stash DoubleClickZoom interaction ──────────────────────────────
  useEffect(() => {
    if (!ol || !map) return;
    const items = map.getInteractions().getArray();
    dblRef.current = items.find(i => i instanceof ol.interaction.DoubleClickZoom) || null;
  }, [map, ol]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── OL overlay for result popup ────────────────────────────────────
  useEffect(() => {
    if (!ol || !map) return;
    // Create element programmatically — React won't own the DOM node
    const el = document.createElement('div');
    el.className = styles.measurePopup;
    popupNodeRef.current = el;
    setPopupReady(true);

    const overlay = new ol.Overlay({
      element: el,
      positioning: 'bottom-center',
      stopEvent: true,
      autoPan: { animation: { duration: 250 } },
    });
    map.addOverlay(overlay);
    overlayRef.current = overlay;
    return () => {
      map.removeOverlay(overlay);
      overlayRef.current = null;
      popupNodeRef.current = null;
    };
  }, [map, ol]);   // eslint-disable-line react-hooks/exhaustive-deps

  function hidePopup() {
    if (overlayRef.current) overlayRef.current.setPosition(undefined);
  }

  function closePopup() {
    hidePopup();
    setSelectedFeat(null);
    setState(ST.IDLE);
    setRDist(null); setRArea(null); setRPerim(null);
  }

  function showPopup(feat) {
    const extent = feat.getGeometry().getExtent();
    const center = ol.extent.getCenter(extent);
    if (overlayRef.current) overlayRef.current.setPosition(center);
  }

  // ── select interaction for click-to-reveal ─────────────────────────
  useEffect(() => {
    if (!ol || !map || !lyRef.current) return;
    const sel = new ol.interaction.Select({
      layers: [lyRef.current],
      style: new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(34,197,94,0.25)' }),
        stroke: new ol.style.Stroke({ color: '#22C55E', width: 3 }),
        image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#22C55E' }) }),
      }),
    });
    sel.on('select', (e) => {
      if (stateRef.current === ST.MEASURING) return;
      if (e.selected.length > 0) {
        const feat = e.selected[0];
        const d = feat.get('measureData');
        if (d) {
          showPopup(feat);
          setSelectedFeat(feat);
          setRDist(d.distance);
          setRArea(d.area);
          setRPerim(d.perimeter);
          setRIsLine(d.isLine);
          setState(ST.RESULT);
        }
      } else {
        hidePopup();
        setSelectedFeat(null);
        if (stateRef.current === ST.RESULT) {
          setState(ST.IDLE);
        }
      }
    });
    selRef.current = sel;
    map.addInteraction(sel);
    return () => { map.removeInteraction(sel); };
  }, [map, ol]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── helper: build a finished feature from an array of points ───────
  function createFeature(pts) {
    const line = pts.length <= 2;
    let feat, dist, perim = 0, area = 0;
    if (line) {
      feat = new ol.Feature({ geometry: new ol.geom.LineString(pts) });
      dist = ol.sphere.getLength(feat.getGeometry());
    } else {
      const ring = [...pts, pts[0]];
      feat = new ol.Feature({ geometry: new ol.geom.Polygon([ring]) });
      dist = ol.sphere.getLength(new ol.geom.LineString(pts));
      perim = dist;
      area = ol.sphere.getArea(feat.getGeometry());
    }
    feat.set('measureData', { distance: dist, area, perimeter: perim, isLine: line });
    return feat;
  }

  // ── set DoubleClickZoom active state ──────────────────────────────
  function setDblActive(on) {
    if (dblRef.current) dblRef.current.setActive(on);
  }

  // ── formatters ────────────────────────────────────────────────────
  const fmtDist = (meters) => {
    const km = meters / 1000;
    const miles = km * 0.621371;
    return `${km.toFixed(2)} km (${miles.toFixed(2)} miles)`;
  };
  const fmtArea = (sqMeters) => {
    const sqKm = sqMeters / 1e6;
    const sqMiles = sqKm * 0.386102;
    return `${sqKm.toFixed(2)} km\u00b2 (${sqMiles.toFixed(2)} sq miles)`;
  };

  // ── start measuring ───────────────────────────────────────────────
  // Expose cancelMeasure to parent (for draw ↔ measure coordination)
  useEffect(() => {
    if (measureCancelRef) measureCancelRef.current = cancelMeasure;
    return () => { if (measureCancelRef) measureCancelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureCancelRef]);

  function startMeasuring() {
    if (onBeforeMeasureStart) onBeforeMeasureStart();
    if (!ol || !map || !srcRef.current) return;

    if (chgRef.current) { ol.unByKey(chgRef.current); chgRef.current = null; }
    hidePopup();
    setDblActive(false);

    const draw = new ol.interaction.Draw({ type: 'LineString' });

    draw.on('drawstart', (evt) => {
      sketchRef.current = evt.feature;
      setTooltipMsg('');
      setLastLat(null);
      setLastLng(null);
      setSegDist(0);
      setTotalDist(0);
      setShowArea(false);
      setLiveArea(0);

      if (chgRef.current) ol.unByKey(chgRef.current);
      const geom = evt.feature.getGeometry();
      chgRef.current = geom.on('change', function () {
        const coords = this.getCoordinates();
        const n = coords.length;
        if (n >= 2) {
          const lastClick = coords[n - 2];
          const ll = ol.proj.toLonLat(lastClick);
          setLastLat(ll[1]);
          setLastLng(ll[0]);

          const cursor = coords[n - 1];
          const seg = new ol.geom.LineString([lastClick, cursor]);
          setSegDist(ol.sphere.getLength(seg));

          const total = new ol.geom.LineString(coords);
          setTotalDist(ol.sphere.getLength(total));
        }
        if (n >= 4) {
          setShowArea(true);
          const ring = coords.slice(0, -1);
          ring.push(ring[0]);
          try {
            const poly = new ol.geom.Polygon([ring]);
            setLiveArea(ol.sphere.getArea(poly));
          } catch { /* ignore */ }
        }
      });
    });

    draw.on('drawend', (evt) => {
      if (chgRef.current) { ol.unByKey(chgRef.current); chgRef.current = null; }
      const coords = evt.feature.getGeometry().getCoordinates();
      // Remove draw interaction — its internal sketch vanishes with it
      if (drawRef.current && map) { map.removeInteraction(drawRef.current); drawRef.current = null; }
      if (coords.length >= 2) {
        srcRef.current.addFeature(createFeature(coords));
      }
      sketchRef.current = null;
      setDblActive(true);
      hidePopup();
      setState(ST.IDLE);
    });

    drawRef.current = draw;
    map.addInteraction(draw);
    setState(ST.MEASURING);
    setTooltipMsg('');
    setLastLat(null);
    setLastLng(null);
    setSegDist(0);
    setTotalDist(0);
    setShowArea(false);
    setLiveArea(0);
  }

  // ── cancel ─────────────────────────────────────────────────────────
  function cancelMeasure() {
    setDblActive(true);
    hidePopup();
    if (chgRef.current) { ol.unByKey(chgRef.current); chgRef.current = null; }
    if (drawRef.current && map) { map.removeInteraction(drawRef.current); drawRef.current = null; }
    sketchRef.current = null;
    setState(ST.IDLE);
  }

  // ── done ───────────────────────────────────────────────────────────
  function doneMeasuring() {
    if (!sketchRef.current || !drawRef.current || !map || !srcRef.current || !ol) return;
    if (chgRef.current) { ol.unByKey(chgRef.current); chgRef.current = null; }
    const coords = sketchRef.current.getGeometry().getCoordinates();
    // Remove draw interaction — sketch vanishes with it
    map.removeInteraction(drawRef.current); drawRef.current = null;
    const pts = coords.slice(0, -1);
    if (pts.length < 2) { hidePopup(); setDblActive(true); sketchRef.current = null; setState(ST.IDLE); return; }
    setDblActive(true);
    hidePopup();
    srcRef.current.addFeature(createFeature(pts));
    sketchRef.current = null;
    setState(ST.IDLE);
  }

  // ── delete the selected feature only ──────────────────────────────
  function deleteSelected() {
    if (!selectedFeat || !srcRef.current) return;
    srcRef.current.removeFeature(selectedFeat);
    hidePopup();
    setSelectedFeat(null);
    setState(ST.IDLE);
    setRDist(null); setRArea(null); setRPerim(null);
  }

  // ── centre on the selected feature ────────────────────────────────
  function centre() {
    if (!map || !selectedFeat) return;
    map.getView().fit(selectedFeat.getGeometry().getExtent(), { padding: [50, 50, 50, 50], maxZoom: 18 });
  }

  const fm = (v) => v >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${v.toFixed(1)} m`;
  const fa = (v) => v >= 1e6 ? `${(v / 1e6).toFixed(2)} km\u00b2` : `${v.toFixed(1)} m\u00b2`;

  const hem = (lat) => lat >= 0 ? 'N' : 'S';
  const hemlng = (lng) => lng >= 0 ? 'E' : 'W';

  return (
    <>
      {/* ruler button — always visible */}
      <div className={styles.ctrlBtn}>
        <button
          className={`${styles.rulerBtn} ${state !== ST.IDLE ? styles.active : ''}`}
          onClick={() => {
            if (state === ST.MEASURING) cancelMeasure();
            else startMeasuring();
          }}
          title={state === ST.MEASURING ? 'Cancel measurement' : 'Measure distance/area'}
          aria-label="Measure tool"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="20" x2="22" y2="20"/><polyline points="8 16 4 20 8 24"/><line x1="4" y1="20" x2="16" y2="8"/><polyline points="20 12 16 8 20 4"/>
          </svg>
        </button>
      </div>

      {/* measuring tooltip */}
      {state === ST.MEASURING && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipBody}>
            {lastLat != null ? (
              <>
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Last Point</p>
                  <p className={styles.sectionValue}>
                    Lat {lastLat.toFixed(4)}{hem(lastLat)} | Lng {lastLng.toFixed(4)}{hemlng(lastLng)}
                  </p>
                </div>
                <div className={styles.section}>
                  <p className={styles.sectionTitle}>Path Distance</p>
                  <p className={styles.sectionValue}>{fmtDist(totalDist)}</p>
                </div>
                {showArea && (
                  <div className={styles.section}>
                    <p className={styles.sectionTitle}>Area</p>
                    <p className={styles.sectionValue}>{fmtArea(liveArea)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className={styles.msg}>Click points to measure.</p>
                <p className={styles.sub}>Double-click to finish.</p>
              </>
            )}
          </div>
          <div className={styles.tooltipActions}>
            <button className={styles.cancelBtn} onClick={cancelMeasure}>Cancel</button>
            <button className={styles.doneBtn} onClick={doneMeasuring}>Done</button>
          </div>
        </div>
      )}

      {/* OL overlay — portal into programmatically created node */}
      {popupReady && popupNodeRef.current && createPortal(
        (state === ST.RESULT && rDist != null) ? (
          <div className={styles.popupContent}>
            <button className={styles.popupClose} onClick={closePopup} title="Close">×</button>
            {rIsLine ? (
              <p className={styles.popupLine}>Distance: {fm(rDist)}</p>
            ) : (
              <>
                <p className={styles.popupLine}>Area: {fa(rArea)}</p>
                <p className={styles.popupLine}>Perimeter: {fm(rPerim)}</p>
              </>
            )}
            <div className={styles.popupActions}>
              <button className={styles.popupActBtn} onClick={deleteSelected} title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <button className={styles.popupActBtn} onClick={centre} title="Center on map">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
          </div>
        ) : null,
        popupNodeRef.current
      )}
    </>
  );
}
