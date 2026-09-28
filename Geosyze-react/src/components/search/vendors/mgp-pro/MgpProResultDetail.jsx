import styles from './MgpProResultDetail.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MgpProResultDetail({ result, onClose }) {
  const entries = Object.entries(result.rawProperties || {});
  // Only render <img> for browser-displayable formats; GeoTIFF browse
  // images are shown on the map via the Preview button instead.
  const showImgPreview = result.previewUrl && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(result.previewUrl);

  function formatValue(val) {
    if (val == null) return '—';
    if (typeof val === 'object') {
      // Special-case eo:bands to show a readable band list
      if (Array.isArray(val) && val.length > 0 && val[0]?.name) {
        return val.map(b => b.name + (b.center_wavelength ? ` (${b.center_wavelength}nm)` : '')).join(', ');
      }
      return JSON.stringify(val, null, 1);
    }
    return String(val);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{result.title}</h3>
          <button className={styles.close} onClick={onClose}>&times;</button>
        </div>
        {showImgPreview && (
          <div className={styles.preview}>
            <img src={result.previewUrl} alt={result.title} className={styles.previewImg} />
          </div>
        )}
        <div className={styles.grid}>
          <div className={styles.cell}><span className={styles.cellLabel}>ID</span><span>{result.id}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Date</span><span>{formatDate(result.acquisitionDate)}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Sensor</span><span>{result.sensor || '—'}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Cloud Cover</span><span>{result.cloudCover != null ? `${result.cloudCover}%` : '—'}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Off-nadir</span><span>{result.offNadirAngle != null ? `${result.offNadirAngle}°` : '—'}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Resolution</span><span>{result.resolution != null ? `${result.resolution}m` : '—'}</span></div>
        </div>
        <div className={styles.raw}>
          <h4>All Properties</h4>
          <table className={styles.table}>
            <tbody>
              {entries.map(([key, val]) => (
                <tr key={key}>
                  <td className={styles.tableKey}>{key}</td>
                  <td className={styles.tableVal}>{formatValue(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
