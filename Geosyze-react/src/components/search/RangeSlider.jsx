import styles from './RangeSlider.module.css';

export default function RangeSlider({ label, min = 0, max = 100, step = 1, value, onChange, unit = '%' }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={styles.slider}
      />
      <div className={styles.ticks}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
