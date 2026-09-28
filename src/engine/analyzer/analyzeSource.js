// Static analysis of a JavaScript source string: parses it with Acorn, then
// walks the AST once to build a scope tree, a flat variable/function list,
// closure captures, async-operation sites, and control-flow structures.
//
// This module is intentionally UI-agnostic and execution-agnostic — it only
// looks at source text, never runs anything. Everything it reports is
// STATIC ANALYSIS: what the code's shape implies, not what actually
// happens at runtime (that distinction matters once the execution engine's
// real events are layered on top in later steps).

import { parse } from "acorn";
import * as walk from "acorn-walk";
import {
  makeScope,
  getScope,
  findFunctionOrGlobalScope,
  declare,
  recordReference,
  locOf,
} from "./scopeModel.js";
import { walkPattern, describeParam, describeCallee } from "./astHelpers.js";

const TIMER_NAMES = new Set([
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "queueMicrotask",
]);
const PROMISE_STATIC_METHODS = new Set([
  "resolve",
  "reject",
  "all",
  "race",
  "allSettled",
  "any",
]);
const PROMISE_INSTANCE_METHODS = new Set(["then", "catch", "finally"]);
const CONTROL_FLOW_TYPES = new Set([
  "IfStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "SwitchStatement",
  "TryStatement",
]);

function nextId(ctx, kind) {
  ctx.counters[kind] = (ctx.counters[kind] ?? 0) + 1;
  return `${kind}-${ctx.counters[kind]}`;
}

function pushAsync(ctx, kind, loc) {
  ctx.asyncOperations.push({ id: nextId(ctx, "async"), kind, loc: locOf(loc) });
}

function recordAsyncForCall(ctx, node) {
  const callee = node.callee;
  if (callee.type === "Identifier" && TIMER_NAMES.has(callee.name)) {
    pushAsync(ctx, `timer-${callee.name}`, node.loc);
    return;
  }
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier"
  ) {
    const propName = callee.property.name;
    if (
      callee.object.type === "Identifier" &&
      callee.object.name === "Promise" &&
      PROMISE_STATIC_METHODS.has(propName)
    ) {
      pushAsync(ctx, `promise-${propName}`, node.loc);
      return;
    }
    if (PROMISE_INSTANCE_METHODS.has(propName)) {
      // Heuristic: any `.then/.catch/.finally` call, regardless of receiver
      // type — static analysis can't know the receiver is really a Promise.
      pushAsync(ctx, `promise-${propName}`, node.loc);
    }
  }
}

function handleFunction(ctx, node, state, c) {
  const parentScope = getScope(ctx, state.scopeId);
  const isDeclaration = node.type === "FunctionDeclaration";
  const name = node.id ? node.id.name : null;

  if (isDeclaration && name) {
    declare(ctx, parentScope, name, "function", node.id.loc);
  }

  const functionId = nextId(ctx, "fn");
  const functionScope = makeScope(
    ctx,
    "function",
    name || "(anonymous)",
    parentScope,
    functionId,
    node.loc,
  );

  if (!isDeclaration && name) {
    // Named function expression: self-reference binding, visible only inside its own body.
    declare(ctx, functionScope, name, "function-self", node.id.loc);
  }

  const childState = { scopeId: functionScope.id, functionId };

  for (const param of node.params) {
    walkPattern(param, {
      onIdentifier: (id) =>
        declare(ctx, functionScope, id.name, "param", id.loc, {
          isParam: true,
        }),
      onExpression: (expr) => c(expr, childState, "Expression"),
    });
  }

  if (node.body.type === "BlockStatement") {
    for (const stmt of node.body.body) c(stmt, childState, "Statement");
  } else {
    c(node.body, childState, "Expression"); // arrow with expression body
  }

  if (node.async) pushAsync(ctx, "async-function", node.loc);

  ctx.functions.push({
    id: functionId,
    name,
    type: node.type,
    isAsync: !!node.async,
    isGenerator: !!node.generator,
    isCallback: Boolean(state.callbackHint),
    passedToCallee: state.callbackHint ?? null,
    params: node.params.map(describeParam),
    scopeId: functionScope.id,
    parentScopeId: parentScope.id,
    loc: locOf(node.loc),
  });
}

function handleDeclarator(ctx, decl, kind, state, c) {
  const targetScope =
    kind === "var"
      ? findFunctionOrGlobalScope(ctx, getScope(ctx, state.scopeId))
      : getScope(ctx, state.scopeId);
  walkPattern(decl.id, {
    onIdentifier: (id) => declare(ctx, targetScope, id.name, kind, id.loc),
    onExpression: (expr) => c(expr, state, "Expression"),
  });
  if (decl.init) c(decl.init, state, "Expression");
}

function buildVisitors(ctx) {
  return {
    Program(node, state, c) {
      for (const stmt of node.body) c(stmt, state, "Statement");
    },

    BlockStatement(node, state, c) {
      const parentScope = getScope(ctx, state.scopeId);
      const blockScope = makeScope(
        ctx,
        "block",
        "Block",
        parentScope,
        state.functionId,
        node.loc,
      );
      const childState = {
        scopeId: blockScope.id,
        functionId: state.functionId,
      };
      for (const stmt of node.body) c(stmt, childState, "Statement");
    },

    VariableDeclaration(node, state, c) {
      for (const decl of node.declarations)
        handleDeclarator(ctx, decl, node.kind, state, c);
    },

    FunctionDeclaration: (node, state, c) =>
      handleFunction(ctx, node, state, c),
    FunctionExpression: (node, state, c) => handleFunction(ctx, node, state, c),
    ArrowFunctionExpression: (node, state, c) =>
      handleFunction(ctx, node, state, c),

    CatchClause(node, state, c) {
      const parentScope = getScope(ctx, state.scopeId);
      const catchScope = makeScope(
        ctx,
        "block",
        "catch",
        parentScope,
        state.functionId,
        node.loc,
      );
      const childState = {
        scopeId: catchScope.id,
        functionId: state.functionId,
      };
      if (node.param) {
        walkPattern(node.param, {
          onIdentifier: (id) =>
            declare(ctx, catchScope, id.name, "catch", id.loc),
          onExpression: (expr) => c(expr, childState, "Expression"),
        });
      }
      c(node.body, childState, "Statement");
    },

    AssignmentExpression(node, state, c) {
      walkPattern(node.left, {
        onIdentifier: (id) => recordReference(ctx, state, id.name, id.loc),
        onExpression: (expr) => c(expr, state, "Expression"),
      });
      c(node.right, state, "Expression");
    },

    // Rare fallback: a Pattern reached via acorn-walk's own default routing
    // (e.g. a destructured, undeclared for-of target) that none of the
    // overrides above intercepted first. Treat it as a reference, not a
    // fresh binding, so it's never silently dropped.
    VariablePattern(node, state) {
      recordReference(ctx, state, node.name, node.loc);
    },

    ForStatement(node, state, c) {
      recordControlFlow(node);
      const loopScope = makeScope(
        ctx,
        "block",
        "for",
        getScope(ctx, state.scopeId),
        state.functionId,
        node.loc,
      );
      walk.base.ForStatement(
        node,
        { scopeId: loopScope.id, functionId: state.functionId },
        c,
      );
    },
    ForInStatement(node, state, c) {
      recordControlFlow(node);
      const loopScope = makeScope(
        ctx,
        "block",
        "for-in",
        getScope(ctx, state.scopeId),
        state.functionId,
        node.loc,
      );
      walk.base.ForInStatement(
        node,
        { scopeId: loopScope.id, functionId: state.functionId },
        c,
      );
    },
    ForOfStatement(node, state, c) {
      recordControlFlow(node);
      const loopScope = makeScope(
        ctx,
        "block",
        "for-of",
        getScope(ctx, state.scopeId),
        state.functionId,
        node.loc,
      );
      walk.base.ForOfStatement(
        node,
        { scopeId: loopScope.id, functionId: state.functionId },
        c,
      );
    },
    IfStatement(node, state, c) {
      recordControlFlow(node);
      walk.base.IfStatement(node, state, c);
    },
    WhileStatement(node, state, c) {
      recordControlFlow(node);
      walk.base.WhileStatement(node, state, c);
    },
    DoWhileStatement(node, state, c) {
      recordControlFlow(node);
      walk.base.DoWhileStatement(node, state, c);
    },
    SwitchStatement(node, state, c) {
      recordControlFlow(node);
      walk.base.SwitchStatement(node, state, c);
    },
    TryStatement(node, state, c) {
      recordControlFlow(node);
      walk.base.TryStatement(node, state, c);
    },

    CallExpression(node, state, c) {
      recordAsyncForCall(ctx, node);
      const calleeName = describeCallee(node.callee);
      c(node.callee, state, "Expression");
      for (const arg of node.arguments) {
        const isFunctionArg =
          arg.type === "FunctionExpression" ||
          arg.type === "ArrowFunctionExpression";
        c(
          arg,
          isFunctionArg ? { ...state, callbackHint: calleeName } : state,
          "Expression",
        );
      }
    },
    NewExpression(node, state, c) {
      if (node.callee.type === "Identifier" && node.callee.name === "Promise") {
        pushAsync(ctx, "promise-constructor", node.loc);
      }
      walk.base.NewExpression(node, state, c);
    },
    AwaitExpression(node, state, c) {
      pushAsync(ctx, "await", node.loc);
      walk.base.AwaitExpression(node, state, c);
    },

    Identifier(node, state) {
      recordReference(ctx, state, node.name, node.loc);
    },
  };

  function recordControlFlow(node) {
    if (!CONTROL_FLOW_TYPES.has(node.type)) return;
    ctx.controlFlow.push({
      id: nextId(ctx, "flow"),
      type: node.type,
      loc: locOf(node.loc),
    });
  }
}

function buildSourceLocations(ctx) {
  const entries = [];
  for (const fn of ctx.functions)
    entries.push({ category: "function", refId: fn.id, loc: fn.loc });
  for (const v of ctx.variables)
    entries.push({ category: "variable", refId: v.id, loc: v.loc });
  for (const op of ctx.asyncOperations)
    entries.push({ category: "async", refId: op.id, loc: op.loc });
  for (const flow of ctx.controlFlow)
    entries.push({ category: "controlFlow", refId: flow.id, loc: flow.loc });
  for (const closure of ctx.closureIndex.values()) {
    for (const loc of closure.accessLocations) {
      entries.push({ category: "closure", refId: closure.id, loc });
    }
  }
  return entries
    .filter((entry) => entry.loc)
    .sort(
      (a, b) =>
        a.loc.start.line - b.loc.start.line ||
        a.loc.start.column - b.loc.start.column,
    );
}

const EMPTY_RESULT = {
  functions: [],
  variables: [],
  scopes: [],
  asyncOperations: [],
  closures: [],
  controlFlow: [],
  sourceLocations: [],
  references: [],
};

export function analyzeSource(code) {
  let ast;
  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
      ranges: true,
    });
  } catch (error) {
    return {
      success: false,
      ast: null,
      ...EMPTY_RESULT,
      errors: [
        {
          message: error.message,
          loc: error.loc
            ? { line: error.loc.line, column: error.loc.column }
            : null,
        },
      ],
    };
  }

  const ctx = {
    scopes: [],
    functions: [],
    variables: [],
    asyncOperations: [],
    controlFlow: [],
    references: [],
    scopeById: new Map(),
    closureIndex: new Map(),
    counters: { scope: 0, variable: 0, closure: 0, fn: 0, async: 0, flow: 0 },
  };

  const globalScope = makeScope(
    ctx,
    "global",
    "Global",
    null,
    "global",
    ast.loc,
  );
  const visitors = buildVisitors(ctx);
  walk.recursive(
    ast,
    { scopeId: globalScope.id, functionId: "global" },
    visitors,
    walk.base,
  );

  return {
    success: true,
    ast,
    functions: ctx.functions,
    variables: ctx.variables,
    scopes: ctx.scopes,
    asyncOperations: ctx.asyncOperations,
    closures: [...ctx.closureIndex.values()],
    controlFlow: ctx.controlFlow,
    references: ctx.references,
    sourceLocations: buildSourceLocations(ctx),
    errors: [],
  };
}
