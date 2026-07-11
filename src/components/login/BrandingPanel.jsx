import styles from './BrandingPanel.module.css';
import { useTheme } from '../../context/ThemeContext';

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
    ),
    title: 'Spatial Analytics',
    desc: 'Process and visualize geospatial data at scale with real-time insights.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
      </svg>
    ),
    title: 'Multi-Layer Mapping',
    desc: 'Combine satellite, terrain, and vector layers in unified views.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    title: 'Pipeline Automation',
    desc: 'Automate ETL workflows for continuous geodata ingestion and processing.',
  },
];

export default function BrandingPanel() {
  const brand = useTheme();
  return (
    <div className={styles.panel}>
      <svg className={styles.logoIcon} viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
        <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        <circle cx="20" cy="20" r="4" fill="currentColor" opacity="0.8"/>
        <path d="M6 20h28M20 6v28" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
      </svg>
      <h1 className={styles.title}>{brand?.name || 'GEOSYZE'}</h1>
      <p className={styles.tagline}>{brand?.tagline || 'GIS Intelligence Platform'}</p>

      <div className={styles.divider} />

      <div className={styles.features}>
        {features.map((f, i) => (
          <div key={i} className={styles.feature} style={{ animationDelay: `${0.4 + i * 0.12}s` }}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <div>
              <p className={styles.featureTitle}>{f.title}</p>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statVal}>10K+</span>
          <span className={styles.statLabel}>Users</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>1M+</span>
          <span className={styles.statLabel}>Data Points</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statVal}>99.9%</span>
          <span className={styles.statLabel}>Uptime</span>
        </div>
      </div>
    </div>
  );
}
