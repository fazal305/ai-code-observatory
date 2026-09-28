// Walks a binding/assignment-target pattern (Identifier, destructuring,
// defaults, rest) without assuming which of those two contexts it's in —
// the caller decides via the two callbacks:
//   onIdentifier(node) — a name that binds or is written to
//   onExpression(node) — a sub-expression that should re-enter normal
//                         expression traversal (default values, computed
//                         keys, or a MemberExpression assignment target)
export function walkPattern(node, { onIdentifier, onExpression }) {
  if (!node) return;
  switch (node.type) {
    case "Identifier":
      onIdentifier(node);
      break;
    case "AssignmentPattern":
      walkPattern(node.left, { onIdentifier, onExpression });
      onExpression(node.right);
      break;
    case "ObjectPattern":
      for (const prop of node.properties) {
        if (prop.type === "RestElement") {
          walkPattern(prop.argument, { onIdentifier, onExpression });
        } else {
          if (prop.computed) onExpression(prop.key);
          walkPattern(prop.value, { onIdentifier, onExpression });
        }
      }
      break;
    case "ArrayPattern":
      for (const element of node.elements) {
        if (element) walkPattern(element, { onIdentifier, onExpression });
      }
      break;
    case "RestElement":
      walkPattern(node.argument, { onIdentifier, onExpression });
      break;
    default:
      // MemberExpression (`obj.prop = x`) or anything unexpected: treat as
      // a plain expression rather than a binding.
      onExpression(node);
  }
}

// Best-effort human-readable parameter signature, used for the functions
// list shown in visualizers later.
export function describeParam(node) {
  switch (node.type) {
    case "Identifier":
      return node.name;
    case "AssignmentPattern":
      return `${describeParam(node.left)} = …`;
    case "RestElement":
      return `...${describeParam(node.argument)}`;
    case "ObjectPattern":
      return `{ ${node.properties
        .map((prop) =>
          prop.type === "RestElement"
            ? describeParam(prop)
            : describeParam(prop.value),
        )
        .join(", ")} }`;
    case "ArrayPattern":
      return `[ ${node.elements.map((el) => (el ? describeParam(el) : "")).join(", ")} ]`;
    default:
      return "?";
  }
}

// Best-effort callee name for callback/async detection — "forEach" for
// `arr.forEach(...)`, "setTimeout" for `setTimeout(...)`, null otherwise.
export function describeCallee(callee) {
  if (callee.type === "Identifier") return callee.name;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier"
  ) {
    return callee.property.name;
  }
  return null;
}
