import { useState, useEffect, useRef } from 'react';

export default function useElevation(lat, lon, debounceMs = 300) {
  const [elevation, setElevation] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const lastReq = useRef({ lat: null, lon: null });

  useEffect(() => {
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
      setElevation(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (lastReq.current.lat === lat && lastReq.current.lon === lon) return;
      lastReq.current = { lat, lon };

      setLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`
        );
        if (!res.ok) throw new Error('Elevation fetch failed');
        const data = await res.json();
        if (data.elevation && data.elevation.length > 0) {
          setElevation(data.elevation[0]);
        }
      } catch {
        setElevation(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lat, lon, debounceMs]);

  return { elevation, loading };
}
