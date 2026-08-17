import { createContext, useContext } from 'react'
import { useCodeExecution } from '../hooks/useCodeExecution.js'
import { usePlayback } from '../hooks/usePlayback.js'

const ExecutionContext = createContext(null)

export function ExecutionProvider({ children }) {
  const execution = useCodeExecution()
  const playback = usePlayback(execution.state)

  // `state` exposed here is the EFFECTIVE state — live, unless the timeline
  // is scrubbed to an earlier point, in which case it's that point's
  // replayed snapshot. Every visualizer reads state through this one hook,
  // so scrubbing keeps all of them in sync with zero per-visualizer code —
  // exactly the "all panels represent the same execution point" requirement.
  const value = {
    ...execution,
    state: playback.effectiveState,
    playback,
  }

  return <ExecutionContext.Provider value={value}>{children}</ExecutionContext.Provider>
}

export function useExecution() {
  const context = useContext(ExecutionContext)
  if (!context) {
    throw new Error('useExecution must be used within an ExecutionProvider')
  }
  return context
}
