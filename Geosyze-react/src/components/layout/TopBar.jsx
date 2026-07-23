import { useAuth } from '../../context/AuthContext';
import MenuBar from './MenuBar';
import ThemeToggle from './ThemeToggle';
import styles from './TopBar.module.css';

export default function TopBar({ onToggleSidebar, onMenuAction, compareMode, setCompareMode }) {
  const { logout } = useAuth();

  function handleCompareToggle() {
    if (compareMode) {
      setCompareMode(null);
    } else {
      setCompareMode('compare');
    }
  }

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.hamburger} onClick={onToggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <svg className={styles.logoIcon} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className={styles.brand}>GEOSYZE</span>
        <MenuBar onMenuAction={onMenuAction} />
        <button className={`${styles.compareBtn} ${compareMode ? styles.compareActive : ''}`} onClick={handleCompareToggle} title={compareMode ? 'Exit compare mode' : 'Compare basemaps'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
        </button>
      </div>
      <div className={styles.right}>
        <ThemeToggle />
        <div className={styles.avatar} title="admin user">A</div>
        <button className={styles.logoutBtn} onClick={logout}>Logout</button>
      </div>
    </header>
  );
}
