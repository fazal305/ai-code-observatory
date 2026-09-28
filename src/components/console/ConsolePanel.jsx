import { useEffect, useRef } from "react";
import { useExecution } from "../../context/ExecutionContext.jsx";
import ConsoleEntry from "./ConsoleEntry.jsx";
import EmptyState from "../common/EmptyState.jsx";
import styles from "./ConsolePanel.module.css";

// A pathological loop can log thousands of lines; rendering that many
// ConsoleEntry DOM nodes at once is the kind of "thousands of unnecessary
// components" the perf pass calls out. Full virtualization is more
// machinery than this warrants — capping to the most recent N is a much
// simpler fix for the same problem, and the log entries themselves (and
// their timestamps) are untouched, only the render is capped.
const MAX_RENDERED_ENTRIES = 500;

function ConsolePanel() {
  const { state, playback } = useExecution();
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.consoleEntries.length]);

  if (state.consoleEntries.length === 0) {
    let description = "Run your code to see console output here.";
    if (state.status === "running")
      description = "Running — waiting for output…";
    else if (!playback.isLive)
      description = "Scrubbed to before any output — step forward to see it.";

    return <EmptyState icon="▤" title="Console" description={description} />;
  }

  const total = state.consoleEntries.length;
  const visible =
    total > MAX_RENDERED_ENTRIES
      ? state.consoleEntries.slice(total - MAX_RENDERED_ENTRIES)
      : state.consoleEntries;

  return (
    <div ref={scrollRef} className={styles.list} role="log" aria-live="polite">
      {total > MAX_RENDERED_ENTRIES ? (
        <div className={styles.truncated}>
          Showing the most recent {MAX_RENDERED_ENTRIES} of {total} entries.
        </div>
      ) : null}
      {visible.map((entry) => (
        <ConsoleEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default ConsolePanel;
