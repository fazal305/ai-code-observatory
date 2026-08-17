// Pairs FUNCTION_CALL/FUNCTION_RETURN events (stack-based, so correct under
// recursion) into duration spans for the timeline's flame-graph-style
// bars, and picks out point-in-time markers (console/timer/promise/
// microtask events) for the marker lane beneath them.
export function deriveTimelineSpans(events) {
  const spans = []
  const stack = []
  events.forEach((event, index) => {
    if (event.type === 'FUNCTION_CALL') {
      stack.push({ label: event.payload.name ?? '(anonymous)', startIndex: index, startTime: event.timestamp, depth: stack.length })
    } else if (event.type === 'FUNCTION_RETURN') {
      const frame = stack.pop()
      if (frame) {
        spans.push({
          id: `span-${spans.length}`,
          label: frame.label,
          depth: frame.depth,
          startIndex: frame.startIndex,
          endIndex: index,
          startTime: frame.startTime,
          endTime: event.timestamp,
        })
      }
    }
  })
  return spans
}

const MARKER_KIND = {
  CONSOLE_OUTPUT: 'console',
  TIMER_SCHEDULED: 'timer',
  TIMER_EXECUTED: 'timer',
  PROMISE_CREATED: 'promise',
  PROMISE_RESOLVED: 'promise',
  PROMISE_REJECTED: 'promise',
  MICROTASK_QUEUED: 'microtask',
  MICROTASK_EXECUTED: 'microtask',
}

export function deriveTimelineMarkers(events) {
  const markers = []
  events.forEach((event, index) => {
    const kind = MARKER_KIND[event.type]
    if (kind) markers.push({ index, timestamp: event.timestamp, kind, type: event.type })
  })
  return markers
}
