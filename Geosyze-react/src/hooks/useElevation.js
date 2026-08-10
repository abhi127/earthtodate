import { useState, useEffect, useRef } from 'react';

const API_URL = '/api';

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
          `${API_URL}/tiles/dem?lat=${lat}&lon=${lon}`
        );
        if (!res.ok) throw new Error('Elevation fetch failed');
        const data = await res.json();
        if (typeof data.fusion === 'number') {
          setElevation(data.fusion);
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
