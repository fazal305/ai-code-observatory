import { useCallback, useId, useRef } from 'react'
import styles from './Tabs.module.css'

// Accessible tab bar (WAI-ARIA Tabs pattern: roving tabindex + arrow-key nav).
// Renders only the tab list — the caller renders the matching tabpanel using
// the ids this component exposes via getPanelId/getTabId, so consumers keep
// full control over what a panel renders.
function Tabs({ tabs, activeId, onChange, idBase, size = 'md' }) {
  const autoId = useId()
  const base = idBase ?? autoId
  const listRef = useRef(null)

  const getTabId = (id) => `${base}-tab-${id}`
  const getPanelId = (id) => `${base}-panel-${id}`

  const focusTabAt = useCallback((index) => {
    const buttons = listRef.current?.querySelectorAll('[role="tab"]')
    if (!buttons || buttons.length === 0) return
    const wrapped = (index + buttons.length) % buttons.length
    buttons[wrapped].focus()
  }, [])

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const next = tabs[(index + 1) % tabs.length]
      onChange(next.id)
      focusTabAt(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const prev = tabs[(index - 1 + tabs.length) % tabs.length]
      onChange(prev.id)
      focusTabAt(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(tabs[0].id)
      focusTabAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(tabs[tabs.length - 1].id)
      focusTabAt(tabs.length - 1)
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      className={[styles.tablist, size === 'sm' ? styles.sm : styles.md].join(' ')}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            id={getTabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={getPanelId(tab.id)}
            tabIndex={isActive ? 0 : -1}
            className={[styles.tab, isActive ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.icon ? (
              <span className={styles.icon} aria-hidden="true">
                {tab.icon}
              </span>
            ) : null}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs

// Companion to Tabs: renders the tabpanel wrapper with matching id/aria
// wiring. `idBase` must match the value passed to the sibling <Tabs>.
export function TabPanel({ idBase, id, activeId, children, className = '' }) {
  if (id !== activeId) return null
  return (
    <div
      id={`${idBase}-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`${idBase}-tab-${id}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}
