import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import MapOverlay from './MapOverlay';
import MeasureTool from './MeasureTool';
import MapControls from './MapControls';
import styles from './MapView.module.css';

const BASEMAP_DEFS = [
  // ponytail: static tile URLs for thumbnails — same tile coords across all sources gives visual comparison
  { id: 'osm',       name: 'OSM',     thumbnail: 'https://a.tile.openstreetmap.org/3/4/2.png' },
  { id: 'satellite', name: 'Esri',    thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/4/2' },
  { id: 'terrain',   name: 'Terrain', thumbnail: 'https://tile.opentopomap.org/3/4/2.png' },
  { id: 'light',     name: 'CARTO',   thumbnail: 'https://a.basemaps.cartocdn.com/light_all/3/4/2.png' },
  { id: 'streets',   name: 'Streets', thumbnail: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/3/4/2' },
  { id: 'dark',      name: 'Dark',    thumbnail: 'https://a.basemaps.cartocdn.com/dark_all/3/4/2.png' },
];

const MapView = forwardRef(function MapView({ onDrawComplete }, ref) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const vectorSource = useRef(null);
  const basemapRefs = useRef({});
  const drawInteractionRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [coords, setCoords] = useState('Lon: \u2014  Lat: \u2014');
  const [zoom, setZoom] = useState('Zoom: \u2014');
  const [activeBasemap, setActiveBasemap] = useState('osm');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef(null);

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return;
    function handleClick(e) {
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [switcherOpen]);

  useEffect(() => {
    const ol = window.ol;
    if (!ol || !mapRef.current) return;

    vectorSource.current = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({ source: vectorSource.current });

    const layers = {
      osm: new ol.layer.Tile({ source: new ol.source.OSM(), visible: true }),
      satellite: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: '&copy; Esri',
        }),
        visible: false,
      }),
      terrain: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
          maxZoom: 17,
          attributions: '&copy; OpenTopoMap',
        }),
        visible: false,
      }),
      light: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
          maxZoom: 19,
          attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
        }),
        visible: false,
      }),
      streets: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          attributions: '&copy; Esri',
        }),
        visible: false,
      }),
      dark: new ol.layer.Tile({
        source: new ol.source.XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          maxZoom: 19,
          attributions: '&copy; <a href="https://carto.com/">CARTO</a>',
        }),
        visible: false,
      }),
    };
    basemapRefs.current = layers;

    const map = new ol.Map({
      target: mapRef.current,
      layers: [layers.osm, layers.satellite, layers.terrain, layers.light, layers.streets, layers.dark, vectorLayer],
      view: new ol.View({
        center: ol.proj.fromLonLat([78.9629, 20.5937]),
        zoom: 5,
      }),
      controls: new ol.Collection([
        new ol.control.Attribution({ collapsible: true, collapsed: true }),
        new ol.control.ScaleLine(),
      ]),
    });

    mapInstance.current = map;
    setMapReady(true);

    map.on('pointermove', (e) => {
      if (e.coordinate) {
        const ll = ol.proj.toLonLat(e.coordinate);
        setCoords(`Lon: ${ll[0].toFixed(4)}\u00b0  Lat: ${ll[1].toFixed(4)}\u00b0`);
      }
    });

    map.getView().on('change:resolution', () => {
      setZoom(`Zoom: ${map.getView().getZoom().toFixed(1)}`);
    });

    return () => {
      map.setTarget(null);
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchBasemap = useCallback((val) => {
    const layers = Object.values(basemapRefs.current).filter(Boolean);
    if (!layers.length) return;
    layers.forEach((l) => l.setVisible(false));
    if (basemapRefs.current[val]) basemapRefs.current[val].setVisible(true);
    setActiveBasemap(val);
    setSwitcherOpen(false);
  }, []);

  useImperativeHandle(ref, () => ({
    setBasemap: switchBasemap,

    activateDraw(type) {
      this.deactivateDraw();
      const ol = window.ol;
      if (!ol || !mapInstance.current || !vectorSource.current) return;
      const geomMap = { point: 'Point', line: 'LineString', polygon: 'Polygon' };
      const draw = new ol.interaction.Draw({
        source: vectorSource.current,
        type: geomMap[type],
      });
      draw.on('drawend', () => {
        if (onDrawComplete) onDrawComplete();
      });
      drawInteractionRef.current = draw;
      mapInstance.current.addInteraction(draw);
    },

    deactivateDraw() {
      if (drawInteractionRef.current && mapInstance.current) {
        mapInstance.current.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current = null;
      }
    },

    clearAll() {
      if (vectorSource.current) vectorSource.current.clear();
      this.deactivateDraw();
    },
  }));

  return (
    <div className={styles.container}>
      <div ref={mapRef} className={styles.map}></div>
      <MapOverlay coords={coords} zoom={zoom} />
      {mapReady && <MeasureTool map={mapInstance.current} />}
      {mapReady && <MapControls map={mapInstance.current} />}
      {mapReady && (() => {
        const currentBm = BASEMAP_DEFS.find(b => b.id === activeBasemap);
        return (
          <div className={styles.switcherWrapper} ref={switcherRef}>
            {switcherOpen ? (
              <div className={styles.gallery}>
                {BASEMAP_DEFS.map(bm => (
                  <button
                    key={bm.id}
                    className={`${styles.thumb} ${activeBasemap === bm.id ? styles.thumbActive : ''}`}
                    onClick={() => switchBasemap(bm.id)}
                    title={bm.name}
                    style={{ backgroundImage: `url(${bm.thumbnail})` }}
                  >
                    <span className={styles.thumbLabel}>{bm.name}</span>
                    {activeBasemap === bm.id && <span className={styles.thumbCheck}>✓</span>}
                  </button>
                ))}
              </div>
            ) : (
              <button className={styles.compactBtn} onClick={() => setSwitcherOpen(true)} title="Switch basemap">
                <span className={styles.compactThumb} style={{ backgroundImage: `url(${currentBm?.thumbnail})` }} />
                <span className={styles.compactLabel}>{currentBm?.name}</span>
                <svg className={styles.compactIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
});

export default MapView;
