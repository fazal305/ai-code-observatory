// Transforms JavaScript source into an equivalent program that also calls a
// global `__trace(type, payload)` function at meaningful points, so the
// execution worker can report real runtime events instead of only static
// analysis. This is genuine source-to-source instrumentation — every event
// it produces corresponds to code that actually ran, not a guess.
//
// Technique: collect a list of pure-insertion edits (never replacements —
// original source text is never altered, only wrapped) keyed by character
// offset, then apply them back-to-front so earlier offsets stay valid.
// Every AST node an event refers to is matched back to its static-analysis
// record by source *location* (line/column), not by re-deriving IDs from a
// second traversal — location is a stable, traversal-order-independent key.
//
// Coverage in this pass: function call/return + scope create/destroy,
// variable declarations, variable updates (any assignment operator),
// closure creation (a captured-capable function expression evaluating) and
// closure access (a read that resolves outside the current function). Block
// scopes are modeled statically (Step 6) but only function-level scope
// create/destroy is traced at runtime — tracing every block would multiply
// event volume for limited educational payoff, and is documented here as a
// deliberate scope limit rather than left as a silent gap.

import { parse } from "acorn";
import * as walk from "acorn-walk";

function keyOf(pos) {
  return `${pos.line}:${pos.column}`;
}

function indexByLoc(list, getLoc) {
  const map = new Map();
  for (const item of list) {
    const loc = getLoc(item);
    if (loc) map.set(keyOf(loc.start), item);
  }
  return map;
}

// `priority` breaks ties when two edits land on the exact offset (e.g. a
// closure-created wrap around a whole arrow function, and that same arrow's
// own body-wrap, both closing at the same character when the body is a bare
// expression with no braces of its own). Lower priority is applied first,
// which — given how insertAt-the-same-offset composes — ends up as the
// OUTERMOST text; higher priority ends up innermost, closest to the
// original code. Default 5 sits in the middle for edits that never collide.
function insertAt(edits, offset, text, priority = 5) {
  edits.push({ offset, text, priority });
}

function applyEdits(source, edits) {
  const sorted = [...edits].sort(
    (a, b) => b.offset - a.offset || a.priority - b.priority,
  );
  let out = source;
  for (const edit of sorted) {
    out = out.slice(0, edit.offset) + edit.text + out.slice(edit.offset);
  }
  return out;
}

function argsSnapshotExpr(params) {
  const simple = params.filter((p) => p.type === "Identifier");
  return `{${simple.map((p) => `${p.name}:${p.name}`).join(",")}}`;
}

function traceCall(type, fields) {
  return `__trace(${JSON.stringify(type)},{${fields.join(",")}})`;
}

export function instrumentSource(code, analysis) {
  if (!analysis || !analysis.success) {
    return {
      success: false,
      code,
      error: "Instrumentation requires a successful analysis.",
    };
  }

  let ast;
  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
      ranges: true,
    });
  } catch (error) {
    return { success: false, code, error: error.message };
  }

  const functionByKey = indexByLoc(analysis.functions, (f) => f.loc);
  const variableDeclByKey = indexByLoc(analysis.variables, (v) => v.loc);
  const referenceByKey = indexByLoc(analysis.references, (r) => r.loc);
  const closureCreatorIds = new Set(analysis.closures.map((c) => c.functionId));
  const capturedNamesByFunction = new Map();
  for (const closure of analysis.closures) {
    const list = capturedNamesByFunction.get(closure.functionId) ?? [];
    list.push(closure.variableName);
    capturedNamesByFunction.set(closure.functionId, list);
  }

  const edits = [];

  // UpdateExpression (`count++`, `--count`) reads AND writes its argument in
  // one syntactic slot — `simple` always fully recurses into it before this
  // pass runs, so a generic read-wrap would corrupt `x++` into `(...)++`,
  // which isn't a valid assignment target. Collect these positions first so
  // the Identifier visitor below can skip them; they get their own handling.
  const updateArgumentKeys = new Set();
  // Likewise, `for (let i = 0; ...)` isn't a standalone statement — it's a
  // clause inside the loop header, so a trailing `;__trace(...);` there
  // would corrupt the `for(...)` syntax. Declarations in that position are
  // left untraced (their updates via `i++` etc. are still traced normally).
  const forHeaderDeclarationKeys = new Set();
  walk.simple(ast, {
    UpdateExpression(node) {
      if (node.argument.type === "Identifier")
        updateArgumentKeys.add(keyOf(node.argument.loc.start));
    },
    ForStatement(node) {
      if (node.init && node.init.type === "VariableDeclaration") {
        forHeaderDeclarationKeys.add(keyOf(node.init.loc.start));
      }
    },
    ForInStatement(node) {
      if (node.left.type === "VariableDeclaration")
        forHeaderDeclarationKeys.add(keyOf(node.left.loc.start));
    },
    ForOfStatement(node) {
      if (node.left.type === "VariableDeclaration")
        forHeaderDeclarationKeys.add(keyOf(node.left.loc.start));
    },
  });

  // An arrow's expression body (`() => ++count`) is wrapped wholesale by
  // instrumentFunction below. If that same node is ALSO a bare
  // UpdateExpression/AssignmentExpression/Identifier read, generically
  // wrapping it too would nest an expression-wrap directly against a
  // block-conversion wrap at the identical offset — incompatible, not just
  // redundant. Skip generic wrapping for exactly those top-level nodes.
  const arrowBodyKeys = new Set();
  walk.simple(ast, {
    ArrowFunctionExpression(node) {
      if (node.body.type !== "BlockStatement")
        arrowBodyKeys.add(keyOf(node.body.loc.start));
    },
  });

  function instrumentFunction(node) {
    const fn = functionByKey.get(keyOf(node.loc.start));
    if (!fn) return; // shouldn't happen when analysis matches this exact source, but fail safe

    const enter = [
      traceCall("FUNCTION_CALL", [
        `functionId:${JSON.stringify(fn.id)}`,
        `name:${JSON.stringify(fn.name)}`,
        `args:${argsSnapshotExpr(node.params)}`,
      ]),
      traceCall("SCOPE_CREATED", [
        `scopeId:${JSON.stringify(fn.scopeId)}`,
        `functionId:${JSON.stringify(fn.id)}`,
      ]),
    ].join(";");
    const exit = [
      traceCall("SCOPE_DESTROYED", [
        `scopeId:${JSON.stringify(fn.scopeId)}`,
        `functionId:${JSON.stringify(fn.id)}`,
      ]),
      traceCall("FUNCTION_RETURN", [
        `functionId:${JSON.stringify(fn.id)}`,
        `name:${JSON.stringify(fn.name)}`,
      ]),
    ].join(";");

    if (node.body.type === "BlockStatement") {
      insertAt(edits, node.body.range[0] + 1, `;${enter};try{`, 10);
      insertAt(edits, node.body.range[1] - 1, `}finally{${exit};}`, 10);
    } else {
      // Expression-bodied arrow: its body's range IS the whole function's
      // trailing range, so this close can tie with an outer wrap (e.g.
      // closure-created) at the same offset — priority 10 keeps it innermost.
      insertAt(edits, node.body.range[0], `{${enter};try{return (`, 10);
      insertAt(edits, node.body.range[1], `);}finally{${exit};}}`, 10);
    }

    if (node.type !== "FunctionDeclaration" && closureCreatorIds.has(fn.id)) {
      const captured = JSON.stringify(capturedNamesByFunction.get(fn.id) ?? []);
      insertAt(
        edits,
        node.range[0],
        `(${traceCall("CLOSURE_CREATED", [`functionId:${JSON.stringify(fn.id)}`, `capturedVariables:${captured}`])},`,
        0,
      );
      insertAt(edits, node.range[1], `)`, 0);
    }
  }

  function instrumentVariableDeclaration(node) {
    if (forHeaderDeclarationKeys.has(keyOf(node.loc.start))) return;
    const calls = [];
    for (const decl of node.declarations) {
      if (decl.id.type !== "Identifier") continue;
      const v = variableDeclByKey.get(keyOf(decl.id.loc.start));
      if (!v) continue;
      calls.push(
        traceCall("VARIABLE_DECLARATION", [
          `variableId:${JSON.stringify(v.id)}`,
          `name:${JSON.stringify(v.name)}`,
          `scopeId:${JSON.stringify(v.scopeId)}`,
          `kind:${JSON.stringify(v.kind)}`,
          `value:${v.name}`,
          `ref:${v.name}`,
        ]),
      );
    }
    if (calls.length > 0)
      insertAt(edits, node.range[1], `;${calls.join(";")};`);
  }

  function instrumentAssignment(node) {
    if (arrowBodyKeys.has(keyOf(node.loc.start))) return;

    // `obj.prop = x` — the variable `obj` isn't reassigned, but the object
    // it points to changed shape. Only the simple, common form is handled
    // (non-computed property on a bare identifier) — matches the same
    // "simple identifier only" scoping used elsewhere in this file, and
    // covers the realistic mutation-through-alias case the Memory
    // visualizer (Step 13) needs to stay honest rather than showing a
    // stale snapshot from declaration time.
    if (
      node.left.type === "MemberExpression" &&
      !node.left.computed &&
      node.left.object.type === "Identifier" &&
      node.left.property.type === "Identifier"
    ) {
      const objectName = node.left.object.name;
      const propertyName = node.left.property.name;
      insertAt(edits, node.range[0], `(`);
      insertAt(
        edits,
        node.range[1],
        `,${traceCall("OBJECT_MUTATED", [
          `name:${JSON.stringify(objectName)}`,
          `value:${objectName}`,
          `ref:${objectName}`,
        ])},${objectName}.${propertyName})`,
      );
      return;
    }

    if (node.left.type !== "Identifier") return;
    const ref = referenceByKey.get(keyOf(node.left.loc.start));
    if (!ref) return;
    const name = node.left.name;
    insertAt(edits, node.range[0], `(`);
    insertAt(
      edits,
      node.range[1],
      `,${traceCall("VARIABLE_UPDATE", [
        `variableId:${JSON.stringify(ref.variableId)}`,
        `name:${JSON.stringify(name)}`,
        `scopeId:${JSON.stringify(ref.scopeId)}`,
        `isClosure:${ref.isClosure}`,
        `value:${name}`,
        `ref:${name}`,
      ])},${name})`,
    );
  }

  function instrumentUpdateExpression(node) {
    if (arrowBodyKeys.has(keyOf(node.loc.start))) return;
    if (node.argument.type !== "Identifier") return;
    const ref = referenceByKey.get(keyOf(node.argument.loc.start));
    if (!ref) return;
    const name = node.argument.name;
    insertAt(edits, node.range[0], `(`);
    insertAt(
      edits,
      node.range[1],
      `,${traceCall("VARIABLE_UPDATE", [
        `variableId:${JSON.stringify(ref.variableId)}`,
        `name:${JSON.stringify(name)}`,
        `scopeId:${JSON.stringify(ref.scopeId)}`,
        `isClosure:${ref.isClosure}`,
        `value:${name}`,
        `ref:${name}`,
      ])},${name})`,
    );
  }

  function instrumentIdentifierRead(node) {
    if (updateArgumentKeys.has(keyOf(node.loc.start))) return;
    if (arrowBodyKeys.has(keyOf(node.loc.start))) return;
    const ref = referenceByKey.get(keyOf(node.loc.start));
    if (!ref || !ref.isClosure) return;
    const name = node.name;
    insertAt(
      edits,
      node.range[0],
      `(${traceCall("CLOSURE_ACCESS", [
        `variableId:${JSON.stringify(ref.variableId)}`,
        `name:${JSON.stringify(name)}`,
        `scopeId:${JSON.stringify(ref.scopeId)}`,
        `value:${name}`,
      ])},`,
    );
    insertAt(edits, node.range[1], `)`);
  }

  walk.simple(ast, {
    FunctionDeclaration: instrumentFunction,
    FunctionExpression: instrumentFunction,
    ArrowFunctionExpression: instrumentFunction,
    VariableDeclaration: instrumentVariableDeclaration,
    AssignmentExpression: instrumentAssignment,
    UpdateExpression: instrumentUpdateExpression,
    Identifier: instrumentIdentifierRead,
  });

  return { success: true, code: applyEdits(code, edits), error: null };
}
