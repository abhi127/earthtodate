import styles from './MgpProResultDetail.module.css';

export default function MgpProResultDetail({ result, onClose }) {
  const entries = Object.entries(result.rawProperties || {});

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{result.title}</h3>
          <button className={styles.close} onClick={onClose}>&times;</button>
        </div>
        {result.previewUrl && (
          <div className={styles.preview}>
            <img src={result.previewUrl} alt={result.title} className={styles.previewImg} />
          </div>
        )}
        <div className={styles.grid}>
          <div className={styles.cell}><span className={styles.cellLabel}>ID</span><span>{result.id}</span></div>
          <div className={styles.cell}><span className={styles.cellLabel}>Date</span><span>{result.acquisitionDate || '—'}</span></div>
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
                  <td className={styles.tableVal}>{val == null ? '—' : String(val)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
