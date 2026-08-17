// Trims the app's full execution state down to small, structured summaries
// before anything is sent to an AI — never the raw application state. This
// keeps prompts bounded (a 6000-event run stays a few KB, not a dump of
// everything) and keeps the AI answering about what ACTUALLY happened,
// never inventing events of its own.
const MAX_TIMELINE_EVENTS = 80
const MAX_CONSOLE_LINES = 30

function countByType(events) {
  const counts = {}
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1
  return counts
}

function summarizeEvent(event) {
  const { type, timestamp, payload } = event
  switch (type) {
    case 'FUNCTION_CALL':
      return { type, name: payload.name, args: payload.args }
    case 'FUNCTION_RETURN':
      return { type, name: payload.name }
    case 'CONSOLE_OUTPUT':
      return { type, level: payload.level }
    case 'TIMER_SCHEDULED':
      return { type, kind: payload.kind, delay: payload.delay }
    case 'TIMER_EXECUTED':
      return { type, kind: payload.kind }
    case 'PROMISE_CREATED':
    case 'PROMISE_RESOLVED':
    case 'PROMISE_REJECTED':
      return { type, id: payload.id }
    case 'MICROTASK_QUEUED':
    case 'MICROTASK_EXECUTED':
      return { type, kind: payload.kind }
    default:
      return { type, atMs: Math.round(timestamp) }
  }
}

export function buildExecutionSummary({ sourceCode, analysis, state }) {
  return {
    code: sourceCode,
    status: state.status,
    error: state.error,
    functions: analysis.success
      ? analysis.functions.map((f) => ({ name: f.name, isAsync: f.isAsync, isCallback: f.isCallback, params: f.params }))
      : [],
    closures: analysis.success
      ? analysis.closures.map((c) => ({ variable: c.variableName, accessCount: c.accessLocations.length }))
      : [],
    eventCounts: countByType(state.events),
    timeline: state.events.slice(0, MAX_TIMELINE_EVENTS).map(summarizeEvent),
    consoleOutput: state.consoleEntries.slice(0, MAX_CONSOLE_LINES).map((e) => `${e.level}: ${e.args.join(' ')}`),
  }
}

export function buildScopeSummary({ analysis }, scopeId) {
  if (!analysis.success) return { error: 'source has a syntax error' }
  const scope = analysis.scopes.find((s) => s.id === scopeId)
  if (!scope) return { error: 'scope not found' }
  return {
    kind: scope.kind,
    name: scope.name,
    parentScope: analysis.scopes.find((s) => s.id === scope.parentId)?.name ?? null,
    variables: analysis.variables.filter((v) => v.scopeId === scopeId).map((v) => ({ name: v.name, kind: v.kind })),
  }
}

export function buildClosureSummary({ analysis }, closureId) {
  if (!analysis.success) return { error: 'source has a syntax error' }
  const closure = analysis.closures.find((c) => c.id === closureId)
  if (!closure) return { error: 'closure not found' }
  const capturingFn = analysis.functions.find((f) => f.id === closure.functionId)
  const definingFn = analysis.functions.find((f) => f.id === closure.definingFunctionId)
  return {
    variable: closure.variableName,
    definedIn: definingFn?.name ?? '(global scope)',
    capturedBy: capturingFn?.name ?? '(anonymous function)',
    accessSitesInSource: closure.accessLocations.length,
  }
}

export function buildEventLoopSummary({ state }) {
  const relevant = new Set([
    'CONSOLE_OUTPUT',
    'TIMER_SCHEDULED',
    'TIMER_EXECUTED',
    'MICROTASK_QUEUED',
    'MICROTASK_EXECUTED',
    'PROMISE_CREATED',
    'PROMISE_RESOLVED',
    'PROMISE_REJECTED',
  ])
  return {
    orderedEvents: state.events.filter((e) => relevant.has(e.type)).slice(0, MAX_TIMELINE_EVENTS).map(summarizeEvent),
    consoleOutput: state.consoleEntries.map((e) => `${e.level}: ${e.args.join(' ')}`),
  }
}
