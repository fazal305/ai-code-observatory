import { useExecution } from "../../context/ExecutionContext.jsx";
import styles from "./ExecutionStatus.module.css";

const STATUS_COPY = {
  idle: "Idle",
  running: "Running",
  complete: "Complete",
  error: "Error",
  stopped: "Stopped",
};

function ExecutionStatus() {
  const { state } = useExecution();
  const status = state.status;

  return (
    <span className={styles.status} role="status">
      <span
        className={[styles.dot, styles[status]].filter(Boolean).join(" ")}
        aria-hidden="true"
      />
      {STATUS_COPY[status] ?? status}
    </span>
  );
}

export default ExecutionStatus;
