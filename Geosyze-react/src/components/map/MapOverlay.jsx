import useElevation from '../../hooks/useElevation';
import styles from './MapOverlay.module.css';

export default function MapOverlay({ coords, zoom, resolution, docked }) {
  let lat = null, lon = null;
  if (coords) {
    const parts = coords.match(/Lon:\s*([\d.-]+).*Lat:\s*([\d.-]+)/);
    if (parts) {
      lon = parseFloat(parts[1]);
      lat = parseFloat(parts[2]);
    }
  }

  const { elevation } = useElevation(lat, lon);

  const displayLon = lon != null ? `${lon.toFixed(4)}\u00b0` : '\u2014';
  const displayLat = lat != null ? `${lat.toFixed(4)}\u00b0` : '\u2014';

  return (
    <div className={`${styles.overlay} ${docked ? styles.docked : ''}`}>
      <span className={styles.coords}>
        Lon: {displayLon}
        <span className={styles.gap} />
        Lat: {displayLat}
      </span>
      <span className={styles.divider}>|</span>
      <span className={styles.text}>{zoom || 'Zoom: \u2014'}</span>
      <span className={styles.divider}>|</span>
      <span className={styles.text}>{resolution || 'Res: \u2014'}</span>
      <span className={styles.divider}>|</span>
      <span className={styles.text}>
        Elev: {elevation != null ? `${elevation.toFixed(1)}m` : '\u2014'}
      </span>
    </div>
  );
}
