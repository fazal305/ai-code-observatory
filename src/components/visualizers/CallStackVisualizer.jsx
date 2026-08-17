import { useExecution } from '../../context/ExecutionContext.jsx'
import EmptyState from '../common/EmptyState.jsx'
import { formatValue } from '../../utils/formatValue.js'
import styles from './CallStackVisualizer.module.css'

function formatArgs(args) {
  if (!args || typeof args !== 'object') return ''
  const entries = Object.entries(args)
  if (entries.length === 0) return ''
  return entries.map(([key, value]) => `${key}: ${formatValue(value)}`).join(', ')
}

function CallStackVisualizer() {
  const { state } = useExecution()
  const { callStack, status } = state

  if (status === 'idle') {
    return (
      <EmptyState
        icon="▤"
        title="Call stack"
        description="Run your code to watch frames push and pop in real time."
      />
    )
  }

  // Real function calls come from callStack; the base frame below them
  // represents the top-level script itself, which never gets a
  // FUNCTION_CALL event (only actual function invocations do).
  const frames = [...callStack].reverse()

  return (
    <div className={styles.wrapper}>
      <div className={styles.depth}>Depth: {callStack.length}</div>
      <div className={styles.stack} role="list" aria-label="Call stack, most recent call on top">
        {frames.map((frame) => (
          <div key={frame.frameId} className={styles.frame} role="listitem">
            <span className={styles.name}>{frame.name ?? '(anonymous)'}</span>
            <span className={styles.args}>({formatArgs(frame.args)})</span>
          </div>
        ))}
        <div className={[styles.frame, styles.global].join(' ')} role="listitem">
          <span className={styles.name}>(global)</span>
          <span className={styles.args}>top-level script</span>
        </div>
      </div>
    </div>
  )
}

export default CallStackVisualizer
