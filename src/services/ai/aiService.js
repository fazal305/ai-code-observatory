// The only AI entry point the UI should import — components never talk to
// a provider or a transport directly. Every function here returns the same
// shape: { ok, reason, explanation }, so callers don't need provider-
// specific error handling, and swapping provider.js's transport (or
// adding a second provider later) never touches a single component.
import { isAiConfigured, requestExplanation } from './provider.js'
import { buildExecutionSummary, buildScopeSummary, buildClosureSummary, buildEventLoopSummary } from './buildContext.js'

export { isAiConfigured }

async function explain(kind, summary) {
  if (!isAiConfigured()) {
    return { ok: false, reason: 'not-configured', explanation: null }
  }
  try {
    const explanation = await requestExplanation(kind, summary)
    return { ok: true, reason: null, explanation }
  } catch (error) {
    return { ok: false, reason: 'request-failed', explanation: null, error: error.message }
  }
}

// context: { sourceCode, analysis, state } — analysis from useSourceAnalysis,
// state from useExecution(). Answers "what happened, and why".
export function explainExecution(context) {
  return explain('execution', buildExecutionSummary(context))
}

// Answers "why is this variable available here / where does it come from".
export function explainScope(context, scopeId) {
  return explain('scope', buildScopeSummary(context, scopeId))
}

// Answers "why does this function still have access to that variable".
export function explainClosure(context, closureId) {
  return explain('closure', buildClosureSummary(context, closureId))
}

// Answers "why did this callback run before/after that one".
export function explainEventLoop(context) {
  return explain('eventloop', buildEventLoopSummary(context))
}
