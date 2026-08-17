import { useExecution } from '../../context/ExecutionContext.jsx'
import EmptyState from '../common/EmptyState.jsx'
import styles from './WebApiVisualizer.module.css'

const TASK_STATE_LABEL = { scheduled: 'pending', executed: 'ran', cleared: 'cleared' }
const MICROTASK_STATE_LABEL = { queued: 'queued', executed: 'ran' }

function Section({ title, subtitle, children, empty }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionSubtitle}>{subtitle}</span>
      </div>
      {empty ? <div className={styles.sectionEmpty}>{empty}</div> : <div className={styles.rows}>{children}</div>}
    </div>
  )
}

function WebApiVisualizer() {
  const { state } = useExecution()
  const { tasks, microtasks, status } = state

  if (status === 'idle') {
    return (
      <EmptyState
        icon="◇"
        title="Web APIs & queues"
        description="Run code with timers or promises to watch work move through the browser's queues."
      />
    )
  }

  const pendingTimers = tasks.filter((t) => t.state === 'scheduled')

  return (
    <div className={styles.wrapper}>
      <Section
        title="Web APIs"
        subtitle="timers currently held by the browser, off the call stack"
        empty={pendingTimers.length === 0 ? 'Nothing pending.' : null}
      >
        {pendingTimers.map((task) => (
          <div key={task.id} className={styles.row}>
            <span className={styles.pulse} aria-hidden="true" />
            <span className={styles.rowLabel}>{task.kind}</span>
            <span className={styles.rowMeta}>{task.delay}ms delay</span>
          </div>
        ))}
      </Section>

      <Section
        title="Task Queue"
        subtitle="macrotasks — one runs per event-loop turn, after the stack clears"
        empty={tasks.length === 0 ? 'No timers scheduled this run.' : null}
      >
        {tasks.map((task) => (
          <div key={task.id} className={styles.row}>
            <span className={[styles.badge, styles[`task-${task.state}`]].join(' ')}>
              {TASK_STATE_LABEL[task.state]}
            </span>
            <span className={styles.rowLabel}>{task.kind}</span>
            <span className={styles.rowMeta}>{task.delay}ms</span>
          </div>
        ))}
      </Section>

      <Section
        title="Microtask Queue"
        subtitle="promise reactions — the queue always fully drains before the next macrotask"
        empty={microtasks.length === 0 ? 'No microtasks queued this run.' : null}
      >
        {microtasks.map((microtask) => (
          <div key={microtask.id} className={styles.row}>
            <span className={[styles.badge, styles[`microtask-${microtask.state}`]].join(' ')}>
              {MICROTASK_STATE_LABEL[microtask.state]}
            </span>
            <span className={styles.rowLabel}>.{microtask.kind}()</span>
            {microtask.parentId ? <span className={styles.rowMeta}>{microtask.parentId}</span> : null}
          </div>
        ))}
      </Section>

      <p className={styles.note}>
        The exact moment a timer's delay elapses isn't independently observable from JavaScript — only when it's
        <em> scheduled</em> and when its callback actually <em>runs</em>. "Web APIs" and "Task Queue" above share
        that same underlying data for that reason.
      </p>
    </div>
  )
}

export default WebApiVisualizer
