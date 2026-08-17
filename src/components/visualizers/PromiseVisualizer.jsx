import { useMemo } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { formatValue } from '../../utils/formatValue.js'
import EmptyState from '../common/EmptyState.jsx'
import styles from './PromiseVisualizer.module.css'

const STATE_LABEL = { pending: 'Pending', fulfilled: 'Fulfilled', rejected: 'Rejected' }

function PromiseNode({ promise, byParent, microtasksByParent, depth }) {
  const children = byParent.get(promise.id) ?? []
  const microtasks = microtasksByParent.get(promise.id) ?? []
  const settled = promise.state !== 'pending'

  return (
    <div className={styles.node} style={{ '--depth': depth }}>
      <div className={styles.card}>
        <div className={styles.transition}>
          <span className={[styles.stateChip, styles.pendingChip].join(' ')}>Pending</span>
          {settled ? (
            <>
              <span className={styles.transitionArrow}>→</span>
              <span className={[styles.stateChip, styles[`${promise.state}Chip`]].join(' ')}>
                {STATE_LABEL[promise.state]}
              </span>
            </>
          ) : null}
        </div>
        <div className={styles.meta}>
          <span className={styles.id}>{promise.id}</span>
          {settled ? (
            <span className={styles.value}>
              {promise.state === 'fulfilled' ? formatValue(promise.value) : formatValue(promise.reason)}
            </span>
          ) : (
            <span className={styles.waiting}>awaiting settlement…</span>
          )}
        </div>
        {microtasks.length > 0 ? (
          <div className={styles.microtasks}>
            {microtasks.map((m) => (
              <span key={m.id} className={[styles.microtaskTag, m.state === 'executed' ? styles.executed : ''].join(' ')}>
                .{m.kind}() {m.state === 'executed' ? 'ran' : 'queued'}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {children.map((child) => (
        <PromiseNode
          key={child.id}
          promise={child}
          byParent={byParent}
          microtasksByParent={microtasksByParent}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

function PromiseVisualizer() {
  const { state } = useExecution()

  const byParent = useMemo(() => {
    const map = new Map()
    for (const promise of state.promises) {
      if (!promise.derivedFrom) continue
      const list = map.get(promise.derivedFrom) ?? []
      list.push(promise)
      map.set(promise.derivedFrom, list)
    }
    return map
  }, [state.promises])

  const microtasksByParent = useMemo(() => {
    const map = new Map()
    for (const microtask of state.microtasks) {
      if (!microtask.parentId) continue
      const list = map.get(microtask.parentId) ?? []
      list.push(microtask)
      map.set(microtask.parentId, list)
    }
    return map
  }, [state.microtasks])

  const roots = state.promises.filter((p) => !p.derivedFrom)

  if (state.status === 'idle') {
    return (
      <EmptyState icon="◇" title="Promises" description="Run code that creates a Promise to see its state here." />
    )
  }

  if (roots.length === 0) {
    return <EmptyState icon="◇" title="No promises" description="This run didn't create any Promises." />
  }

  return (
    <div className={styles.list}>
      {roots.map((root) => (
        <PromiseNode
          key={root.id}
          promise={root}
          byParent={byParent}
          microtasksByParent={microtasksByParent}
          depth={0}
        />
      ))}
    </div>
  )
}

export default PromiseVisualizer
