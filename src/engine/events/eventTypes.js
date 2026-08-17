// The normalized instrumentation event vocabulary. Every event the worker
// posts during a run uses one of these `type` values, matching the shape
// `{ id, timestamp, type, sourceLocation, functionName, scopeId, payload }`
// described in the project's execution model.
export const EVENT_TYPES = {
  EXECUTION_START: 'EXECUTION_START',
  EXECUTION_COMPLETE: 'EXECUTION_COMPLETE',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  CONSOLE_OUTPUT: 'CONSOLE_OUTPUT',

  FUNCTION_CALL: 'FUNCTION_CALL',
  FUNCTION_RETURN: 'FUNCTION_RETURN',

  SCOPE_CREATED: 'SCOPE_CREATED',
  SCOPE_DESTROYED: 'SCOPE_DESTROYED',

  VARIABLE_DECLARATION: 'VARIABLE_DECLARATION',
  VARIABLE_UPDATE: 'VARIABLE_UPDATE',
  OBJECT_MUTATED: 'OBJECT_MUTATED', // a property write (`obj.prop = x`) — the binding itself didn't change, its target did

  CLOSURE_CREATED: 'CLOSURE_CREATED',
  CLOSURE_ACCESS: 'CLOSURE_ACCESS',

  PROMISE_CREATED: 'PROMISE_CREATED',
  PROMISE_RESOLVED: 'PROMISE_RESOLVED',
  PROMISE_REJECTED: 'PROMISE_REJECTED',

  MICROTASK_QUEUED: 'MICROTASK_QUEUED',
  MICROTASK_EXECUTED: 'MICROTASK_EXECUTED',

  TIMER_SCHEDULED: 'TIMER_SCHEDULED',
  TIMER_EXECUTED: 'TIMER_EXECUTED',
  TIMER_CLEARED: 'TIMER_CLEARED',
}

// Events produced purely by static analysis + source instrumentation (call
// stack, scopes, variables, closures) vs. events produced by hooking real
// browser APIs at runtime (promises, timers). Neither is "fake" — they're
// just different evidence sources, and visualizers built on top of these
// events (Steps 9–14) should be honest with users about which is which.
export const EVENT_SOURCE = {
  INSTRUMENTED: 'instrumented', // injected trace calls in transformed source
  RUNTIME_HOOK: 'runtime-hook', // real Promise/timer API interception
  NATIVE: 'native', // console override, worker error events
}
