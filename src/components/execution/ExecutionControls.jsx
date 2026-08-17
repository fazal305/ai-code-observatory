import Button from '../common/Button.jsx'
import { useExecution } from '../../context/ExecutionContext.jsx'
import styles from './ExecutionControls.module.css'

function ExecutionControls({ code }) {
  const { state, run, stop, reset } = useExecution()
  const isRunning = state.status === 'running'
  const canReset = state.status !== 'idle'

  return (
    <div className={styles.controls}>
      <Button variant="primary" size="sm" onClick={() => run(code)} disabled={isRunning || !code?.trim()} aria-label="Run">
        <span aria-hidden="true">▶</span>
        <span className={styles.label}>Run</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={stop}
        disabled={!isRunning}
        aria-label="Stop"
        title="Terminates the worker immediately"
      >
        <span aria-hidden="true">■</span>
        <span className={styles.label}>Stop</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={reset} disabled={!canReset} aria-label="Reset">
        <span aria-hidden="true">↺</span>
        <span className={styles.label}>Reset</span>
      </Button>
    </div>
  )
}

export default ExecutionControls
