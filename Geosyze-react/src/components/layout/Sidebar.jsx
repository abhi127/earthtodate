import SearchPanel from '../search/SearchPanel';
import styles from './Sidebar.module.css';

export default function Sidebar({ isOpen }) {
  return (
    <div className={styles.sidebar}>
      <SearchPanel isOpen={isOpen} />
    </div>
  );
}
