import { useExecution } from '../../context/ExecutionContext.jsx'
import { useMemoryModel } from '../../hooks/useMemoryModel.js'
import { formatValue } from '../../utils/formatValue.js'
import EmptyState from '../common/EmptyState.jsx'
import styles from './MemoryVisualizer.module.css'

function ObjectCard({ group }) {
  const isArray = Array.isArray(group.shape)
  const entries = isArray
    ? group.shape.map((item, index) => [String(index), item])
    : Object.entries(group.shape ?? {})

  return (
    <div className={styles.objectCard}>
      <div className={styles.referencedBy}>
        {group.variables.map((v) => (
          <span key={v.variableId} className={styles.varChip}>
            {v.name}
          </span>
        ))}
        {group.variables.length > 1 ? <span className={styles.aliasBadge}>{group.variables.length} references</span> : null}
      </div>
      <div className={styles.objectBody}>
        <span className={styles.typeLabel}>{isArray ? 'Array' : 'Object'}</span>
        {entries.length === 0 ? (
          <div className={styles.emptyShape}>(empty)</div>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className={styles.propRow}>
              <span className={styles.propKey}>{key}:</span>
              <span className={styles.propValue}>{formatValue(value)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MemoryVisualizer() {
  const { state } = useExecution()
  const { objectGroups, primitives } = useMemoryModel(state.events)

  if (state.status === 'idle') {
    return (
      <EmptyState
        icon="◇"
        title="Memory references"
        description="Run code that creates objects or arrays to see this educational reference model."
      />
    )
  }

  if (objectGroups.length === 0 && primitives.length === 0) {
    return <EmptyState icon="◇" title="No variables to show" description="Declare a variable to see it here." />
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.disclaimer}>
        An educational model of variable references — not the JavaScript engine's actual memory heap.
      </p>

      {objectGroups.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Objects &amp; Arrays</div>
          <div className={styles.cards}>
            {objectGroups.map((group) => (
              <ObjectCard key={group.refId} group={group} />
            ))}
          </div>
        </div>
      ) : null}

      {primitives.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Primitives (copied by value, never aliased)</div>
          <div className={styles.primitiveGrid}>
            {primitives.map((p) => (
              <div key={p.variableId} className={styles.primitiveRow}>
                <span className={styles.varChip}>{p.name}</span>
                <span className={styles.primitiveValue}>{formatValue(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default MemoryVisualizer
