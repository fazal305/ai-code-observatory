// Executes user-submitted JavaScript off the main thread.
//
// Isolation note: a Web Worker has no access to the DOM, `window`, or the
// main thread's memory — but it is NOT a security sandbox. Worker code can
// still run indefinitely, allocate memory, or make network requests. The
// only reliable way to stop it is `worker.terminate()` from the main
// thread, which is what the Stop control does.
//
// Step 7: before running, the code is statically analyzed (Step 6) and,
// when analysis succeeds, source-instrumented (Step 7's instrumentSource)
// so it emits real FUNCTION_CALL/SCOPE_CREATED/VARIABLE_*/CLOSURE_* events
// as it actually executes. If analysis fails (e.g. a syntax error) the raw
// code still runs — instrumentation is a bonus layer, never a gate on
// whether the user's program executes. Promises and timers are traced by
// hooking the real global APIs below, not by instrumenting call sites.

import { analyzeSource } from '../analyzer/analyzeSource.js'
import { instrumentSource } from '../instrumentation/instrumentSource.js'
import { sanitize, getRefId, errorToPayload } from '../instrumentation/serialize.js'
import { EVENT_TYPES } from '../events/eventTypes.js'

function post(type, payload) {
  self.postMessage({ type, payload, timestamp: performance.now() })
}

self.__trace = function trace(type, data) {
  // `ref`, when present, is the LIVE (unsanitized) value — read here, before
  // sanitize() deep-clones it, so object identity can still be resolved.
  let payload = data
  if (data && Object.prototype.hasOwnProperty.call(data, 'ref')) {
    const { ref, ...rest } = data
    payload = { ...rest, refId: getRefId(ref) }
  }
  post(type, sanitize(payload))
}

const CONSOLE_LEVELS = ['log', 'info', 'warn', 'error', 'debug']
for (const level of CONSOLE_LEVELS) {
  self.console[level] = (...args) => {
    post(EVENT_TYPES.CONSOLE_OUTPUT, { level, args: args.map((arg) => sanitize(arg)) })
  }
}

self.addEventListener('error', (event) => {
  event.preventDefault()
  post(EVENT_TYPES.EXECUTION_ERROR, errorToPayload(event.error ?? new Error(event.message)))
})

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  post(EVENT_TYPES.EXECUTION_ERROR, { ...errorToPayload(event.reason), unhandledRejection: true })
})

// --- Real runtime hooks: Promises & timers -----------------------------
// These trace ACTUAL browser API behavior (real microtask/macrotask
// timing), not a guess derived from source structure.

let promiseSeq = 0
let microtaskSeq = 0
const promiseIds = new WeakMap()
const NativePromise = self.Promise

function idFor(promise) {
  let id = promiseIds.get(promise)
  if (!id) {
    id = `promise-${++promiseSeq}`
    promiseIds.set(promise, id)
  }
  return id
}

// `super.then()`/`super.finally()` construct their result promise
// internally via Symbol.species, which resolves to TrackedPromise here —
// so OUR constructor runs for that result too. Rather than also posting a
// second PROMISE_CREATED from then()/finally() (producing two records for
// one promise), a pending "derivedFrom" handoff is stashed just before the
// call and read once by the constructor that fires synchronously inside it.
let pendingDerivedFrom = null

class TrackedPromise extends NativePromise {
  constructor(executor) {
    let selfId
    const derivedFrom = pendingDerivedFrom
    super((resolve, reject) => {
      const tracedResolve = (value) => {
        post(EVENT_TYPES.PROMISE_RESOLVED, { id: selfId, value: sanitize(value) })
        resolve(value)
      }
      const tracedReject = (reason) => {
        post(EVENT_TYPES.PROMISE_REJECTED, { id: selfId, reason: sanitize(reason) })
        reject(reason)
      }
      try {
        executor(tracedResolve, tracedReject)
      } catch (error) {
        tracedReject(error)
      }
    })
    selfId = idFor(this)
    post(EVENT_TYPES.PROMISE_CREATED, { id: selfId, derivedFrom })
  }

  then(onFulfilled, onRejected) {
    const parentId = idFor(this)
    // One .then() call schedules exactly one PromiseReactionJob — whichever
    // handler matches the outcome — so both wrapped handlers share one id.
    const microtaskId = `microtask-${++microtaskSeq}`
    const wrap = (handler) =>
      typeof handler === 'function'
        ? (value) => {
            post(EVENT_TYPES.MICROTASK_EXECUTED, { id: microtaskId, parentId, kind: 'then' })
            return handler(value)
          }
        : handler
    post(EVENT_TYPES.MICROTASK_QUEUED, { id: microtaskId, parentId, kind: 'then' })
    pendingDerivedFrom = parentId
    const result = super.then(wrap(onFulfilled), wrap(onRejected))
    pendingDerivedFrom = null
    return result
  }

  catch(onRejected) {
    return this.then(undefined, onRejected)
  }

  finally(onFinally) {
    const parentId = idFor(this)
    const microtaskId = `microtask-${++microtaskSeq}`
    post(EVENT_TYPES.MICROTASK_QUEUED, { id: microtaskId, parentId, kind: 'finally' })
    const wrapped =
      typeof onFinally === 'function'
        ? () => {
            post(EVENT_TYPES.MICROTASK_EXECUTED, { id: microtaskId, parentId, kind: 'finally' })
            return onFinally()
          }
        : onFinally
    pendingDerivedFrom = parentId
    const result = super.finally(wrapped)
    pendingDerivedFrom = null
    return result
  }
}

self.Promise = TrackedPromise

const nativeQueueMicrotask = self.queueMicrotask?.bind(self)
if (nativeQueueMicrotask) {
  self.queueMicrotask = (callback) => {
    const id = `microtask-${++microtaskSeq}`
    post(EVENT_TYPES.MICROTASK_QUEUED, { id, kind: 'queueMicrotask' })
    nativeQueueMicrotask(() => {
      post(EVENT_TYPES.MICROTASK_EXECUTED, { id, kind: 'queueMicrotask' })
      callback()
    })
  }
}

let timerSeq = 0
const nativeSetTimeout = self.setTimeout.bind(self)
const nativeSetInterval = self.setInterval.bind(self)
const nativeClearTimeout = self.clearTimeout.bind(self)
const nativeClearInterval = self.clearInterval.bind(self)
// Native timer handles are plain numbers, not objects, so identity can't be
// tracked via WeakMap — a regular Map keyed by handle is needed to report
// which tracked timer a clearTimeout/clearInterval call actually cancels.
const timerIdByHandle = new Map()

self.setTimeout = (callback, delay, ...args) => {
  const id = `timer-${++timerSeq}`
  post(EVENT_TYPES.TIMER_SCHEDULED, { id, delay: delay ?? 0, kind: 'timeout' })
  const handle = nativeSetTimeout(
    (...cbArgs) => {
      post(EVENT_TYPES.TIMER_EXECUTED, { id, kind: 'timeout' })
      timerIdByHandle.delete(handle)
      callback(...cbArgs)
    },
    delay,
    ...args
  )
  timerIdByHandle.set(handle, id)
  return handle
}

self.setInterval = (callback, delay, ...args) => {
  const id = `timer-${++timerSeq}`
  post(EVENT_TYPES.TIMER_SCHEDULED, { id, delay: delay ?? 0, kind: 'interval' })
  const handle = nativeSetInterval(
    (...cbArgs) => {
      post(EVENT_TYPES.TIMER_EXECUTED, { id, kind: 'interval' })
      callback(...cbArgs)
    },
    delay,
    ...args
  )
  timerIdByHandle.set(handle, id)
  return handle
}

self.clearTimeout = (handle) => {
  const id = timerIdByHandle.get(handle) ?? null
  post(EVENT_TYPES.TIMER_CLEARED, { id, kind: 'timeout' })
  timerIdByHandle.delete(handle)
  nativeClearTimeout(handle)
}

self.clearInterval = (handle) => {
  const id = timerIdByHandle.get(handle) ?? null
  post(EVENT_TYPES.TIMER_CLEARED, { id, kind: 'interval' })
  timerIdByHandle.delete(handle)
  nativeClearInterval(handle)
}

// --- Run -----------------------------------------------------------------

function runUserCode(code) {
  post(EVENT_TYPES.EXECUTION_START, null)

  const analysis = analyzeSource(code)
  let toRun = code
  let globalScopeId = null

  if (analysis.success) {
    const instrumented = instrumentSource(code, analysis)
    if (instrumented.success) {
      toRun = instrumented.code
      globalScopeId = analysis.scopes.find((s) => s.kind === 'global')?.id ?? null
    }
    // If instrumentation itself fails, fall back to the raw (uninstrumented)
    // code — the user's program still runs, just without rich events.
  }

  if (globalScopeId) post(EVENT_TYPES.SCOPE_CREATED, { scopeId: globalScopeId, functionId: 'global' })

  try {
    // Indirect eval runs in global scope and — unlike `new Function` —
    // adds no wrapper lines, so error line numbers match the source exactly.
    // Deployment note: this is the app's core feature, so any Content-
    // Security-Policy applied to this page MUST include 'unsafe-eval' in
    // script-src (or omit script-src restrictions on this worker's scope)
    // — otherwise every run fails with a CSP EvalError, not a code bug.
    const indirectEval = self.eval
    indirectEval(toRun)
    post(EVENT_TYPES.EXECUTION_COMPLETE, { ok: true })
  } catch (error) {
    post(EVENT_TYPES.EXECUTION_ERROR, errorToPayload(error))
    post(EVENT_TYPES.EXECUTION_COMPLETE, { ok: false })
  } finally {
    if (globalScopeId) post(EVENT_TYPES.SCOPE_DESTROYED, { scopeId: globalScopeId, functionId: 'global' })
  }
}

self.addEventListener('message', (event) => {
  const { type, payload } = event.data ?? {}
  if (type === 'RUN') {
    runUserCode(payload.code)
  }
})
