import { useMemo } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import EmptyState from '../common/EmptyState.jsx'
import { formatValue } from '../../utils/formatValue.js'
import styles from './EventLoopVisualizer.module.css'

const LOG_TYPES = new Set([
  'CONSOLE_OUTPUT',
  'TIMER_SCHEDULED',
  'TIMER_EXECUTED',
  'MICROTASK_QUEUED',
  'MICROTASK_EXECUTED',
  'PROMISE_CREATED',
  'PROMISE_RESOLVED',
  'PROMISE_REJECTED',
])

const LOG_LABEL = {
  CONSOLE_OUTPUT: (p) => `console.${p.level}(${p.args.map(formatValue).join(', ')})`,
  TIMER_SCHEDULED: (p) => `${p.kind} scheduled (${p.delay}ms) → Web APIs`,
  TIMER_EXECUTED: (p) => `${p.kind} callback → call stack`,
  MICROTASK_QUEUED: (p) => `.${p.kind}() queued → microtask queue`,
  MICROTASK_EXECUTED: (p) => `.${p.kind}() callback → call stack`,
  PROMISE_CREATED: (p) => `${p.id} created${p.derivedFrom ? ` (from ${p.derivedFrom})` : ''}`,
  PROMISE_RESOLVED: (p) => `${p.id} fulfilled`,
  PROMISE_REJECTED: (p) => `${p.id} rejected`,
}

const LOG_LANE = {
  CONSOLE_OUTPUT: 'sync',
  TIMER_SCHEDULED: 'macrotask',
  TIMER_EXECUTED: 'macrotask',
  MICROTASK_QUEUED: 'microtask',
  MICROTASK_EXECUTED: 'microtask',
  PROMISE_CREATED: 'microtask',
  PROMISE_RESOLVED: 'microtask',
  PROMISE_REJECTED: 'microtask',
}

function deriveLoopPhase(state) {
  if (state.status === 'idle') return null
  if (state.callStack.length > 0) return 'Running JavaScript (call stack busy)'
  if (state.microtasks.some((m) => m.state === 'queued')) return 'Draining microtask queue'
  if (state.tasks.some((t) => t.state === 'scheduled')) return 'Waiting on Web APIs / task queue'
  if (state.status === 'running') return 'Synchronous execution'
  return 'Call stack empty — idle'
}

function EventLoopVisualizer() {
  const { state } = useExecution()

  const pendingTimers = state.tasks.filter((t) => t.state === 'scheduled').length
  const queuedMicrotasks = state.microtasks.filter((m) => m.state === 'queued').length
  const phase = deriveLoopPhase(state)

  const log = useMemo(() => state.events.filter((e) => LOG_TYPES.has(e.type)), [state.events])

  if (state.status === 'idle') {
    return (
      <EmptyState
        icon="◇"
        title="Event loop"
        description="Run code with timers or promises to see work move between queues."
      />
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.pipeline}>
        <div className={styles.column}>
          <div className={styles.columnLabel}>Call Stack</div>
          <div className={[styles.count, styles.stack].join(' ')}>{state.callStack.length}</div>
        </div>
        <div className={styles.arrow}>⇄</div>
        <div className={styles.column}>
          <div className={styles.columnLabel}>Web APIs / Task Queue</div>
          <div className={[styles.count, styles.macrotask].join(' ')}>{pendingTimers}</div>
        </div>
        <div className={styles.arrow}>⇄</div>
        <div className={styles.column}>
          <div className={styles.columnLabel}>Microtask Queue</div>
          <div className={[styles.count, styles.microtask].join(' ')}>{queuedMicrotasks}</div>
        </div>
      </div>

      {phase ? (
        <div className={styles.phase}>
          <span className={styles.phaseDot} aria-hidden="true" />
          {phase}
        </div>
      ) : null}

      <div className={styles.noteBlock}>
        Microtasks always fully drain before the next macrotask runs — that's why a{' '}
        <code>Promise.then()</code> logs before a <code>setTimeout(…, 0)</code>, even though the timer was
        scheduled first.
      </div>

      <div className={styles.logHeader}>Execution order</div>
      <div className={styles.log}>
        {log.length === 0 ? (
          <div className={styles.logEmpty}>Nothing queue-relevant has happened yet.</div>
        ) : (
          log.map((event) => (
            <div key={event.id} className={[styles.logRow, styles[LOG_LANE[event.type]]].join(' ')}>
              <span className={styles.logLane}>{LOG_LANE[event.type]}</span>
              <span className={styles.logText}>{LOG_LABEL[event.type](event.payload)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default EventLoopVisualizer
