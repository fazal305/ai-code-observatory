// Builds a nested tree from the analyzer's flat scope list (each scope only
// knows its parentId). There is always exactly one root — the global scope.
export function buildScopeTree(scopes) {
  const byId = new Map(
    scopes.map((scope) => [scope.id, { ...scope, children: [] }]),
  );
  let root = null;
  for (const scope of byId.values()) {
    if (scope.parentId && byId.has(scope.parentId)) {
      byId.get(scope.parentId).children.push(scope);
    } else {
      root = scope;
    }
  }
  return root;
}
