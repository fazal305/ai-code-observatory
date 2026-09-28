import { memo } from "react";
import styles from "./ConsoleEntry.module.css";

function formatTime(ms) {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const msPart = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${msPart}`;
}

function formatArg(arg) {
  if (typeof arg === "string") return arg;
  if (arg && typeof arg === "object" && arg.__error) {
    return `${arg.name}: ${arg.message}`;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function ConsoleEntry({ entry }) {
  return (
    <div
      className={[styles.entry, styles[entry.level] ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={styles.time}>{formatTime(entry.receivedAt)}</span>
      <span className={styles.level}>{entry.level}</span>
      <span className={styles.message}>
        {entry.args.map(formatArg).join(" ")}
      </span>
    </div>
  );
}

export default memo(ConsoleEntry);
