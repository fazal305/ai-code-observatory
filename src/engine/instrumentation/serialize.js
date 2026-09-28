// Deep-sanitizes a value so it survives postMessage's structured clone.
// Functions/symbols/bigints aren't cloneable, and cyclic object graphs need
// an explicit cycle guard — used for both console arguments (Step 5) and
// runtime trace payloads (variable/argument value snapshots, Step 7).
export function sanitize(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function")
      return `[Function: ${value.name || "anonymous"}]`;
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "bigint") return `${value.toString()}n`;
    return value;
  }
  if (value instanceof Error) {
    return {
      __error: true,
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) return `[Map(${value.size})]`;
  if (value instanceof Set) return `[Set(${value.size})]`;
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = sanitize(value[key], seen);
  }
  return out;
}

// Stable per-run identity for plain objects/arrays, used by the Memory
// Reference visualizer to detect aliasing (`admin = user`) — information
// that plain structured-clone deep-copying would otherwise erase, since two
// clones of the same object are indistinguishable from two equal-but-
// separate objects once they've crossed the worker→main postMessage
// boundary. Scoped to one module-level map, which is fine because a fresh
// worker (and therefore a fresh map) is created for every run.
const refIds = new WeakMap();
let refCounter = 0;

export function getRefId(value) {
  if (value === null || typeof value !== "object") return null;
  if (
    value instanceof Error ||
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set
  )
    return null;
  let id = refIds.get(value);
  if (!id) {
    id = `ref-${++refCounter}`;
    refIds.set(value, id);
  }
  return id;
}

export function errorToPayload(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  return { name: "Error", message: String(error), stack: null };
}
