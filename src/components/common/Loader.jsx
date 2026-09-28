import styles from "./Loader.module.css";

// Shown for operations expected to exceed ~200ms (execution runs, AI calls)
// so the UI never appears frozen while a worker or network call is in flight.
function Loader({ label = "Loading…", size = "md" }) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span
        className={[styles.spinner, size === "sm" ? styles.sm : styles.md].join(
          " ",
        )}
        aria-hidden="true"
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export default Loader;
