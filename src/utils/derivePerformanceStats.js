// All figures here come straight from real events and real performance.now()
// timestamps — nothing here is estimated or simulated. The one thing worth
// flagging honestly: browsers intentionally coarsen high-resolution timer
// precision for security (timing-attack mitigation), so these are real
// measurements, not laboratory-grade benchmarks.
export function derivePerformanceStats(state, allEvents) {
  const functionCalls = allEvents.filter(
    (e) => e.type === "FUNCTION_CALL",
  ).length;
  const promiseOps = allEvents.filter((e) =>
    ["PROMISE_CREATED", "PROMISE_RESOLVED", "PROMISE_REJECTED"].includes(
      e.type,
    ),
  ).length;
  const timersScheduled = allEvents.filter(
    (e) => e.type === "TIMER_SCHEDULED",
  ).length;
  const consoleMessages = allEvents.filter(
    (e) => e.type === "CONSOLE_OUTPUT",
  ).length;
  const microtasksQueued = allEvents.filter(
    (e) => e.type === "MICROTASK_QUEUED",
  ).length;

  let depth = 0;
  let maxDepth = 0;
  for (const event of allEvents) {
    if (event.type === "FUNCTION_CALL") {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    } else if (event.type === "FUNCTION_RETURN") {
      depth = Math.max(0, depth - 1);
    }
  }

  const executionStart = allEvents.find((e) => e.type === "EXECUTION_START");
  const executionComplete = [...allEvents]
    .reverse()
    .find((e) => e.type === "EXECUTION_COMPLETE");
  const workerExecutionMs =
    executionStart && executionComplete
      ? executionComplete.timestamp - executionStart.timestamp
      : null;

  const totalRunMs =
    state.startedAt !== null && state.finishedAt !== null
      ? state.finishedAt - state.startedAt
      : null;

  return {
    totalEvents: allEvents.length,
    functionCalls,
    promiseOps,
    timersScheduled,
    consoleMessages,
    microtasksQueued,
    maxDepth,
    workerExecutionMs,
    totalRunMs,
  };
}
