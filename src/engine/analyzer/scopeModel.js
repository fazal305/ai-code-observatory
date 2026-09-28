// Scope-tree bookkeeping shared by the AST analyzer. Scopes form a tree via
// `parentId`; `ownerFunctionId` tags every scope with the nearest enclosing
// function (or `'global'`), which is how closure captures are detected —
// a reference resolves to a declaration whose owning function differs from
// the function currently being visited.

export function locOf(loc) {
  if (!loc) return null;
  return {
    start: { line: loc.start.line, column: loc.start.column },
    end: { line: loc.end.line, column: loc.end.column },
  };
}

export function makeScope(ctx, kind, name, parentScope, ownerFunctionId, loc) {
  const id = `scope-${ctx.counters.scope++}`;
  const scope = {
    id,
    kind, // 'global' | 'function' | 'block'
    name,
    parentId: parentScope ? parentScope.id : null,
    ownerFunctionId,
    loc: locOf(loc),
    declarations: {},
  };
  ctx.scopes.push(scope);
  ctx.scopeById.set(id, scope);
  return scope;
}

export function getScope(ctx, scopeId) {
  return ctx.scopeById.get(scopeId);
}

export function findFunctionOrGlobalScope(ctx, scope) {
  let current = scope;
  while (current.kind !== "function" && current.kind !== "global") {
    current = getScope(ctx, current.parentId);
  }
  return current;
}

export function declare(ctx, scope, name, kind, loc, extra = {}) {
  const id = `var-${ctx.counters.variable++}`;
  const variable = {
    id,
    name,
    kind,
    scopeId: scope.id,
    loc: locOf(loc),
    ...extra,
  };
  ctx.variables.push(variable);
  scope.declarations[name] = id;
  return variable;
}

export function resolve(ctx, scope, name) {
  let current = scope;
  while (current) {
    if (Object.prototype.hasOwnProperty.call(current.declarations, name)) {
      return {
        scopeId: current.id,
        variableId: current.declarations[name],
        ownerFunctionId: current.ownerFunctionId,
      };
    }
    current = current.parentId ? getScope(ctx, current.parentId) : null;
  }
  return null;
}

// Records a use of `name` (a "read" in the general sense — this also covers
// assignment targets), regardless of whether it turns out to be a closure
// capture. `ctx.references` is the complete list, keyed later by source
// location so the instrumenter (Step 7) can resolve exactly which static
// variable a given runtime read/write corresponds to — including plain
// same-function reads, which aren't closures and wouldn't otherwise be
// recorded anywhere.
export function recordReference(ctx, state, name, loc) {
  const scope = getScope(ctx, state.scopeId);
  const resolved = resolve(ctx, scope, name);
  if (!resolved) return null; // unresolved: global built-in (console, Math, ...) or genuinely undeclared

  const isClosure = resolved.ownerFunctionId !== state.functionId;

  ctx.references.push({
    variableId: resolved.variableId,
    variableName: name,
    scopeId: resolved.scopeId,
    loc: locOf(loc),
    isClosure,
  });

  if (!isClosure) return resolved;

  const key = `${state.functionId}::${resolved.variableId}`;
  const existing = ctx.closureIndex.get(key);
  if (existing) {
    existing.accessLocations.push(locOf(loc));
    return resolved;
  }
  ctx.closureIndex.set(key, {
    id: `closure-${ctx.counters.closure++}`,
    functionId: state.functionId,
    variableId: resolved.variableId,
    variableName: name,
    definingScopeId: resolved.scopeId,
    definingFunctionId: resolved.ownerFunctionId,
    accessLocations: [locOf(loc)],
  });
  return resolved;
}
