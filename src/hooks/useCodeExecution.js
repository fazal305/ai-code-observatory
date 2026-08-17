import { useCallback, useEffect, useReducer } from 'react'
import { useWorker } from './useWorker.js'
import { EXECUTION_LIMITS } from '../config/app.js'
import { DEFAULT_EXAMPLE } from '../data/examples.js'

// The canonical execution state. `events` is the full instrumentation log
// (Step 7); everything else here (callStack, scopes, promises, tasks,
// microtasks) is DERIVED from that same event stream as it arrives, one
// event at a time, rather than re-scanned on every update — see applyEvent
// below. Visualizers (Steps 9–14) read these derived slices directly instead
// of re-deriving them, keeping the "instrumentation vs. visualization"
// separation the engine layer promised.
export const initialRunState = {
  status: 'idle', // idle | running | complete | error | stopped
  events: [],
  callStack: [],
  scopes: [],
  promises: [],
  tasks: [],
  microtasks: [],
  consoleEntries: [],
  error: null,
  startedAt: null,
  finishedAt: null,
}

export const initialState = {
  ...initialRunState,
  sourceCode: DEFAULT_EXAMPLE.code,
  activeExampleId: DEFAULT_EXAMPLE.id,
}

let eventId = 0
let frameSeq = 0

function updateById(list, id, updater) {
  return list.map((item) => (item.id === id ? updater(item) : item))
}

// Applies one normalized event to the derived state slices. callStack and
// scopes are true stacks (push/pop) — instrumentation always emits matching
// enter/exit pairs in properly nested order (even across recursion, where
// the SAME static function/scope id legitimately appears multiple times
// simultaneously), so popping the top entry is always correct and simpler
// than matching by id. Promises/tasks/microtasks are keyed by unique
// per-instance ids instead, since they aren't stack-shaped.
export function applyEvent(state, event) {
  const { type, payload, timestamp } = event
  switch (type) {
    case 'CONSOLE_OUTPUT':
      return {
        ...state,
        consoleEntries: [
          ...state.consoleEntries,
          { id: event.id, receivedAt: Date.now(), level: payload.level, args: payload.args },
        ],
      }
    case 'EXECUTION_ERROR':
      return {
        ...state,
        status: 'error',
        error: payload,
        consoleEntries: [
          ...state.consoleEntries,
          {
            id: event.id,
            receivedAt: Date.now(),
            level: 'error',
            args: [`${payload.name}: ${payload.message}`],
          },
        ],
      }
    case 'EXECUTION_COMPLETE':
      return { ...state, status: state.status === 'error' ? 'error' : 'complete', finishedAt: timestamp }

    case 'FUNCTION_CALL':
      // `frameId` is a per-instance sequence, distinct from the static
      // `functionId` — recursion means many simultaneous frames can share
      // the same functionId, but each still needs a unique React list key.
      return {
        ...state,
        callStack: [
          ...state.callStack,
          { frameId: ++frameSeq, functionId: payload.functionId, name: payload.name, args: payload.args, calledAt: timestamp },
        ],
      }
    case 'FUNCTION_RETURN':
      return { ...state, callStack: state.callStack.slice(0, -1) }

    case 'SCOPE_CREATED':
      return {
        ...state,
        scopes: [...state.scopes, { scopeId: payload.scopeId, functionId: payload.functionId, createdAt: timestamp }],
      }
    case 'SCOPE_DESTROYED':
      return { ...state, scopes: state.scopes.slice(0, -1) }

    case 'PROMISE_CREATED':
      return {
        ...state,
        promises: [
          ...state.promises,
          { id: payload.id, state: 'pending', derivedFrom: payload.derivedFrom ?? null, createdAt: timestamp },
        ],
      }
    case 'PROMISE_RESOLVED':
      return {
        ...state,
        promises: updateById(state.promises, payload.id, (p) => ({ ...p, state: 'fulfilled', value: payload.value })),
      }
    case 'PROMISE_REJECTED':
      return {
        ...state,
        promises: updateById(state.promises, payload.id, (p) => ({ ...p, state: 'rejected', reason: payload.reason })),
      }

    case 'TIMER_SCHEDULED':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { id: payload.id, kind: payload.kind, delay: payload.delay, state: 'scheduled', scheduledAt: timestamp },
        ],
      }
    case 'TIMER_EXECUTED':
      return { ...state, tasks: updateById(state.tasks, payload.id, (t) => ({ ...t, state: 'executed' })) }
    case 'TIMER_CLEARED':
      return payload.id
        ? { ...state, tasks: updateById(state.tasks, payload.id, (t) => ({ ...t, state: 'cleared' })) }
        : state

    case 'MICROTASK_QUEUED':
      return {
        ...state,
        microtasks: [
          ...state.microtasks,
          { id: payload.id, parentId: payload.parentId ?? null, kind: payload.kind, state: 'queued', queuedAt: timestamp },
        ],
      }
    case 'MICROTASK_EXECUTED':
      return {
        ...state,
        microtasks: updateById(state.microtasks, payload.id, (m) => ({ ...m, state: 'executed' })),
      }

    default:
      return state
  }
}

export function reducer(state, action) {
  switch (action.type) {
    case 'RUN_START':
      return {
        ...initialRunState,
        sourceCode: state.sourceCode,
        activeExampleId: state.activeExampleId,
        status: 'running',
        startedAt: action.timestamp,
      }
    case 'EVENT': {
      if (state.events.length >= EXECUTION_LIMITS.MAX_EVENTS) return state
      const withLog = { ...state, events: [...state.events, action.event] }
      const next = applyEvent(withLog, action.event)
      // Event timestamps come from the WORKER's performance.now(), which
      // does not share a time origin with the main thread's clock here —
      // comparing them directly against `startedAt` (main thread) produced
      // nonsensical negative durations. Re-stamp finishedAt with a
      // main-thread timestamp, captured synchronously as this dispatch
      // runs, so "total run time" only ever compares same-clock values.
      if (action.event.type === 'EXECUTION_COMPLETE') {
        return { ...next, finishedAt: performance.now() }
      }
      return next
    }
    case 'STOPPED':
      return { ...state, status: 'stopped', finishedAt: action.timestamp }
    case 'RESET':
      return { ...initialRunState, sourceCode: state.sourceCode, activeExampleId: state.activeExampleId }
    case 'SET_SOURCE':
      return { ...state, sourceCode: action.code, activeExampleId: null }
    case 'SELECT_EXAMPLE':
      return { ...state, sourceCode: action.code, activeExampleId: action.exampleId }
    default:
      return state
  }
}

function createExecutionWorker() {
  return new Worker(new URL('../engine/workers/execution.worker.js', import.meta.url), {
    type: 'module',
  })
}

export function useCodeExecution() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { start, terminate, postMessage, subscribe } = useWorker(createExecutionWorker)

  useEffect(
    () =>
      subscribe((message) => {
        eventId += 1
        dispatch({
          type: 'EVENT',
          event: { id: eventId, type: message.type, timestamp: message.timestamp, payload: message.payload },
        })
      }),
    [subscribe]
  )

  const run = useCallback(
    (code) => {
      if (!code || !code.trim()) return
      start()
      dispatch({ type: 'RUN_START', timestamp: performance.now() })
      postMessage({ type: 'RUN', payload: { code } })
    },
    [start, postMessage]
  )

  const stop = useCallback(() => {
    terminate()
    dispatch({ type: 'STOPPED', timestamp: performance.now() })
  }, [terminate])

  const reset = useCallback(() => {
    terminate()
    dispatch({ type: 'RESET' })
  }, [terminate])

  const setSourceCode = useCallback((code) => {
    dispatch({ type: 'SET_SOURCE', code })
  }, [])

  const selectExample = useCallback((example) => {
    dispatch({ type: 'SELECT_EXAMPLE', code: example.code, exampleId: example.id })
  }, [])

  return { state, run, stop, reset, setSourceCode, selectExample }
}
