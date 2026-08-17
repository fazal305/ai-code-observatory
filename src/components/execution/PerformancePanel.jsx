import { useMemo } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { derivePerformanceStats } from '../../utils/derivePerformanceStats.js'
import EmptyState from '../common/EmptyState.jsx'
import styles from './PerformancePanel.module.css'

function formatMs(ms) {
  if (ms === null) return '—'
  return ms < 10 ? `${ms.toFixed(2)}ms` : `${Math.round(ms)}ms`
}

function Tile({ label, value, hint }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileValue}>{value}</div>
      <div className={styles.tileLabel}>{label}</div>
      {hint ? <div className={styles.tileHint}>{hint}</div> : null}
    </div>
  )
}

function PerformancePanel() {
  const { state, playback } = useExecution()

  const stats = useMemo(
    () => derivePerformanceStats(state, playback.allEvents),
    [state, playback.allEvents]
  )

  if (state.status === 'idle') {
    return (
      <EmptyState icon="▤" title="Performance" description="Run your code to see real timing and event counts." />
    )
  }

  if (state.status === 'running') {
    return <EmptyState icon="▤" title="Performance" description="Measuring — figures finalize once execution completes." />
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.measuredTag}>
        <span className={styles.dot} aria-hidden="true" />
        Measured — real <code>performance.now()</code> timestamps and literal event counts, not estimates
      </div>

      <div className={styles.grid}>
        <Tile label="Total run time" value={formatMs(stats.totalRunMs)} hint="Run click → completion, incl. worker spin-up" />
        <Tile label="Worker execution time" value={formatMs(stats.workerExecutionMs)} hint="Analysis + instrumentation + eval, in-worker clock" />
        <Tile label="Events captured" value={stats.totalEvents} />
        <Tile label="Function calls" value={stats.functionCalls} />
        <Tile label="Max call stack depth" value={stats.maxDepth} />
        <Tile label="Promise operations" value={stats.promiseOps} hint="created + resolved + rejected" />
        <Tile label="Microtasks queued" value={stats.microtasksQueued} />
        <Tile label="Timers scheduled" value={stats.timersScheduled} />
        <Tile label="Console messages" value={stats.consoleMessages} />
      </div>

      <p className={styles.footnote}>
        Browsers intentionally reduce timer precision as a timing-attack mitigation, so treat these as real but
        coarse measurements — not a laboratory-grade benchmark.
      </p>
    </div>
  )
}

export default PerformancePanel
