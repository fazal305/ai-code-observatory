// Renders a sanitized runtime value (see engine/instrumentation/serialize.js)
// as a short, readable label for compact UI contexts (stack frames, scope
// rows, closure cards).
export function formatValue(value) {
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (value && typeof value === "object" && value.__error)
    return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
