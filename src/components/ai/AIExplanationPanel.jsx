import { useState } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { useSourceAnalysis } from '../../hooks/useSourceAnalysis.js'
import { isAiConfigured, explainExecution } from '../../services/ai/aiService.js'
import Button from '../common/Button.jsx'
import Loader from '../common/Loader.jsx'
import EmptyState from '../common/EmptyState.jsx'
import styles from './AIExplanationPanel.module.css'

function AIExplanationPanel() {
  const { state } = useExecution()
  const analysis = useSourceAnalysis(state.sourceCode)
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [explanation, setExplanation] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const configured = isAiConfigured()

  const handleExplain = async () => {
    setStatus('loading')
    setErrorMessage(null)
    const result = await explainExecution({ sourceCode: state.sourceCode, analysis, state })
    if (result.ok) {
      setExplanation(result.explanation)
      setStatus('done')
    } else {
      setErrorMessage(result.error ?? 'Request failed.')
      setStatus('error')
    }
  }

  if (!configured) {
    return (
      <div className={styles.wrapper}>
        <EmptyState
          icon="◇"
          title="AI explanation is not configured"
          description="This is an educational project — no AI provider is bundled or hard-coded. The rest of the app works fully without it."
        />
        <div className={styles.configureNote}>
          <p>To enable it, deploy your own small server-side proxy that:</p>
          <ol>
            <li>Accepts a POST with <code>{'{ kind, summary }'}</code> (already trimmed, structured execution data — never your API key, never sent from this app)</li>
            <li>Calls your AI provider of choice using a key read from a <em>server</em> environment variable</li>
            <li>Returns <code>{'{ explanation: string }'}</code></li>
          </ol>
          <p>
            Then set <code>VITE_AI_PROXY_URL</code> to that proxy's URL when building this app. No API key is ever
            read, stored, or referenced in this codebase.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.actionRow}>
        <Button variant="primary" size="sm" onClick={handleExplain} disabled={status === 'loading' || state.status === 'idle'}>
          Explain this execution
        </Button>
        {status === 'loading' ? <Loader label="Asking the AI…" size="sm" /> : null}
      </div>

      {state.status === 'idle' ? (
        <EmptyState icon="◇" title="Nothing to explain yet" description="Run your code first." />
      ) : null}

      {status === 'error' ? <p className={styles.error}>Couldn't get an explanation: {errorMessage}</p> : null}

      {status === 'done' && explanation ? <div className={styles.explanation}>{explanation}</div> : null}
    </div>
  )
}

export default AIExplanationPanel
