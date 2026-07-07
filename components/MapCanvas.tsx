"use client";

import { useEffect, useRef } from "react";
import type { Map as MLMap, Marker } from "maplibre-gl";

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  kind: "inspect" | "los" | "aoi";
  label?: string;
}

interface Props {
  view: string;
  opacity: number;
  pollutionOn: boolean;
  markers: MapMarker[];
  aoi: [number, number, number, number] | null; // minLat,minLon,maxLat,maxLon
  losLine: [number, number][] | null; // [[lat,lon],...]
  flyTo: { lat: number; lon: number; zoom: number; nonce: number } | null;
  onClick: (lat: number, lon: number) => void;
  onMove: (lat: number, lon: number, zoom: number) => void;
}

const ETD_SRC = "etd-src";
const ETD_LYR = "etd-lyr";
const POL_SRC = "pol-src";
const POL_LYR = "pol-lyr";
const VEC_SRC = "vec-src";

export default function MapCanvas(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const mlRef = useRef<any>(null);
  const readyRef = useRef(false);
  const markerObjs = useRef<Marker[]>([]);
  const clickRef = useRef(props.onClick);
  const moveRef = useRef(props.onMove);
  clickRef.current = props.onClick;
  moveRef.current = props.onMove;

  // init map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      mlRef.current = maplibregl;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "bg",
              type: "background",
              paint: { "background-color": "#05070a" },
            },
          ],
        },
        center: [8, 30],
        zoom: 3.2,
        attributionControl: false,
        maxZoom: 17,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "Earth to Date · synthetic mock imagery",
        }),
        "bottom-right"
      );

      map.on("load", () => {
        readyRef.current = true;
        syncLayers();
        map.addSource(VEC_SRC, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "vec-fill",
          type: "fill",
          source: VEC_SRC,
          filter: ["==", "$type", "Polygon"],
          paint: { "fill-color": "#31d0aa", "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: "vec-line",
          type: "line",
          source: VEC_SRC,
          paint: { "line-color": "#31d0aa", "line-width": 2, "line-dasharray": [2, 1] },
        });
        syncVectors();
        syncMarkers();
      });

      map.on("click", (e) => clickRef.current(e.lngLat.lat, e.lngLat.lng));
      const emitMove = () => {
        const c = map.getCenter();
        moveRef.current(c.lat, c.lng, map.getZoom());
      };
      map.on("moveend", emitMove);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncLayers() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const l of [POL_LYR, ETD_LYR]) if (map.getLayer(l)) map.removeLayer(l);
    for (const s of [POL_SRC, ETD_SRC]) if (map.getSource(s)) map.removeSource(s);

    map.addSource(ETD_SRC, {
      type: "raster",
      tiles: [`/api/v2/${props.view}/{z}/{x}/{y}`],
      tileSize: 256,
    });
    map.addLayer({
      id: ETD_LYR,
      type: "raster",
      source: ETD_SRC,
      paint: { "raster-opacity": props.opacity, "raster-fade-duration": 120 },
    });

    if (props.pollutionOn) {
      map.addSource(POL_SRC, {
        type: "raster",
        tiles: [`/api/pollution/aq/{z}/{x}/{y}`],
        tileSize: 256,
      });
      map.addLayer({
        id: POL_LYR,
        type: "raster",
        source: POL_SRC,
        paint: { "raster-opacity": 0.7 },
      });
    }
    // keep vector overlays on top
    for (const l of ["vec-fill", "vec-line"]) if (map.getLayer(l)) map.moveLayer(l);
  }

  function syncVectors() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(VEC_SRC) as any;
    if (!src) return;
    const features: any[] = [];
    if (props.aoi) {
      const [minLat, minLon, maxLat, maxLon] = props.aoi;
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLon, minLat],
              [maxLon, minLat],
              [maxLon, maxLat],
              [minLon, maxLat],
              [minLon, minLat],
            ],
          ],
        },
      });
    }
    if (props.losLine && props.losLine.length === 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: props.losLine.map(([lat, lon]) => [lon, lat]),
        },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }

  function syncMarkers() {
    const map = mapRef.current;
    const maplibregl = mlRef.current;
    if (!map || !maplibregl || !readyRef.current) return;
    markerObjs.current.forEach((m) => m.remove());
    markerObjs.current = [];
    for (const mk of props.markers) {
      const el = document.createElement("div");
      const color =
        mk.kind === "inspect" ? "#5ab0ff" : mk.kind === "los" ? "#fbbf24" : "#31d0aa";
      el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #05070a;box-shadow:0 0 0 2px ${color}66, 0 2px 6px rgba(0,0,0,.6);cursor:pointer;`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([mk.lon, mk.lat])
        .addTo(map);
      if (mk.label) {
        marker.setPopup(new maplibregl.Popup({ offset: 16, closeButton: false }).setText(mk.label));
      }
      markerObjs.current.push(marker);
    }
  }

  // react to prop changes
  useEffect(() => {
    syncLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view, props.opacity, props.pollutionOn]);

  useEffect(() => {
    syncVectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.aoi, props.losLine]);

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.markers]);

  useEffect(() => {
    if (props.flyTo && mapRef.current) {
      mapRef.current.flyTo({
        center: [props.flyTo.lon, props.flyTo.lat],
        zoom: props.flyTo.zoom,
        duration: 1200,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.flyTo?.nonce]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
