import { useMemo, useState } from "react";
import { useExecution } from "../../context/ExecutionContext.jsx";
import { useSourceAnalysis } from "../../hooks/useSourceAnalysis.js";
import { useVariableValues } from "../../hooks/useVariableValues.js";
import { buildScopeTree } from "../../utils/scopeTree.js";
import { formatValue } from "../../utils/formatValue.js";
import EmptyState from "../common/EmptyState.jsx";
import styles from "./ScopeVisualizer.module.css";

const SCOPE_LABEL = { global: "Global", function: "Function", block: "Block" };

function ScopeNode({
  scope,
  depth,
  analysis,
  activeScopeIds,
  variableValues,
  selectedId,
  onSelect,
}) {
  const variables = analysis.variables.filter((v) => v.scopeId === scope.id);
  const functions = analysis.functions.filter(
    (f) => f.parentScopeId === scope.id,
  );
  const isActive = activeScopeIds.has(scope.id);

  return (
    <div className={styles.node} style={{ "--depth": depth }}>
      <div
        className={[styles.scopeHeader, isActive ? styles.active : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.scopeKind}>
          {SCOPE_LABEL[scope.kind] ?? scope.kind}
        </span>
        <span className={styles.scopeName}>{scope.name}</span>
        {isActive ? <span className={styles.liveBadge}>live</span> : null}
      </div>

      <ul className={styles.entries}>
        {variables.map((variable) => {
          const hasValue = variableValues.has(variable.id);
          return (
            <li key={variable.id}>
              <button
                type="button"
                className={[
                  styles.entryButton,
                  selectedId === variable.id ? styles.selected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onSelect(variable.id)}
              >
                <span className={styles.entryKind}>{variable.kind}</span>
                <span className={styles.entryName}>{variable.name}</span>
                {hasValue ? (
                  <span className={styles.entryValue}>
                    = {formatValue(variableValues.get(variable.id))}
                  </span>
                ) : (
                  <span className={styles.entryUnset}>unset</span>
                )}
              </button>
            </li>
          );
        })}
        {functions.map((fn) => (
          <li key={fn.id}>
            <span className={styles.entryFn}>
              {fn.name ?? "(anonymous)"}()
              {fn.isAsync ? (
                <span className={styles.asyncTag}>async</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {scope.children.map((child) => (
        <ScopeNode
          key={child.id}
          scope={child}
          depth={depth + 1}
          analysis={analysis}
          activeScopeIds={activeScopeIds}
          variableValues={variableValues}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ScopeVisualizer() {
  const { state } = useExecution();
  const analysis = useSourceAnalysis(state.sourceCode);
  const variableValues = useVariableValues(state.events);
  const [selectedId, setSelectedId] = useState(null);

  const tree = useMemo(
    () => (analysis.success ? buildScopeTree(analysis.scopes) : null),
    [analysis],
  );
  const activeScopeIds = useMemo(
    () => new Set(state.scopes.map((s) => s.scopeId)),
    [state.scopes],
  );

  const selectedVariable = analysis.success
    ? analysis.variables.find((v) => v.id === selectedId)
    : null;
  const selectedReferences = selectedVariable
    ? analysis.references.filter((r) => r.variableId === selectedId)
    : [];

  if (!analysis.success) {
    return (
      <EmptyState
        icon="◇"
        title="Scopes"
        description="Fix the syntax error in the editor to see the scope tree."
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.tree}>
        <ScopeNode
          scope={tree}
          depth={0}
          analysis={analysis}
          activeScopeIds={activeScopeIds}
          variableValues={variableValues}
          selectedId={selectedId}
          onSelect={(id) =>
            setSelectedId((current) => (current === id ? null : id))
          }
        />
      </div>

      {selectedVariable ? (
        <div className={styles.inspector}>
          <div className={styles.inspectorTitle}>
            {selectedVariable.kind} <strong>{selectedVariable.name}</strong>
          </div>
          <div className={styles.inspectorRow}>
            Declared at line {selectedVariable.loc?.start.line ?? "?"}
          </div>
          <div className={styles.inspectorRow}>
            {selectedReferences.length === 0
              ? "Never read after declaration."
              : `Referenced at line${selectedReferences.length > 1 ? "s" : ""} ${[
                  ...new Set(selectedReferences.map((r) => r.loc?.start.line)),
                ].join(", ")}`}
          </div>
        </div>
      ) : (
        <div className={styles.hint}>
          Click a variable to see where it's declared and referenced.
        </div>
      )}
    </div>
  );
}

export default ScopeVisualizer;
