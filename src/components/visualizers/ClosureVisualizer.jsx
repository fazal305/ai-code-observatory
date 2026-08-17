import { useMemo } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { useSourceAnalysis } from '../../hooks/useSourceAnalysis.js'
import { useVariableValues } from '../../hooks/useVariableValues.js'
import { formatValue } from '../../utils/formatValue.js'
import EmptyState from '../common/EmptyState.jsx'
import styles from './ClosureVisualizer.module.css'

function functionLabel(analysis, functionId) {
  if (functionId === 'global') return '(global scope)'
  const fn = analysis.functions.find((f) => f.id === functionId)
  return fn ? fn.name ?? '(anonymous function)' : functionId
}

function ClosureCard({ closure, analysis, variableValues, runtimeAccessCounts }) {
  const capturingName = functionLabel(analysis, closure.functionId)
  const definingName = functionLabel(analysis, closure.definingFunctionId)
  const hasValue = variableValues.has(closure.variableId)
  const runtimeCount = runtimeAccessCounts.get(closure.variableId)
  const accessLabel =
    runtimeCount !== undefined
      ? `accessed ${runtimeCount} time${runtimeCount === 1 ? '' : 's'} at runtime`
      : `${closure.accessLocations.length} reference site${closure.accessLocations.length === 1 ? '' : 's'} in source (not run yet)`

  return (
    <div className={styles.card}>
      <div className={styles.box}>
        <div className={styles.boxLabel}>Defined in</div>
        <div className={styles.boxValue}>{definingName}</div>
        <div className={styles.varLine}>
          {closure.variableName}
          {hasValue ? <span className={styles.varValue}> = {formatValue(variableValues.get(closure.variableId))}</span> : null}
        </div>
      </div>

      <div className={styles.arrow} aria-hidden="true">
        ↓
      </div>

      <div className={[styles.box, styles.capturing].join(' ')}>
        <div className={styles.boxLabel}>Captured by</div>
        <div className={styles.boxValue}>{capturingName}()</div>
      </div>

      <div className={styles.footer}>{accessLabel}</div>
    </div>
  )
}

function ClosureVisualizer() {
  const { state } = useExecution()
  const analysis = useSourceAnalysis(state.sourceCode)
  const variableValues = useVariableValues(state.events)

  const runtimeAccessCounts = useMemo(() => {
    const counts = new Map()
    for (const event of state.events) {
      if (event.type !== 'CLOSURE_ACCESS') continue
      counts.set(event.payload.variableId, (counts.get(event.payload.variableId) ?? 0) + 1)
    }
    return counts
  }, [state.events])

  if (!analysis.success) {
    return (
      <EmptyState icon="◇" title="Closures" description="Fix the syntax error in the editor to detect closures." />
    )
  }

  if (analysis.closures.length === 0) {
    return (
      <EmptyState
        icon="◇"
        title="No closures here"
        description="This code doesn't reference any outer-scope variable from inside a nested function. Try one of the Closures examples."
      />
    )
  }

  return (
    <div className={styles.list}>
      {analysis.closures.map((closure) => (
        <ClosureCard
          key={closure.id}
          closure={closure}
          analysis={analysis}
          variableValues={variableValues}
          runtimeAccessCounts={runtimeAccessCounts}
        />
      ))}
    </div>
  )
}

export default ClosureVisualizer
