import styles from './Panel.module.css'

// Generic bordered container used for every editor/visualizer/console panel
// so panel chrome (title bar, actions, scroll body) stays consistent app-wide.
function Panel({ title, actions = null, header = null, children, noPadding = false, className = '', ...rest }) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')} {...rest}>
      {header ? (
        <header className={[styles.header, styles.headerCustom].join(' ')}>{header}</header>
      ) : title ? (
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={[styles.body, noPadding ? styles.noPadding : ''].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  )
}

export default Panel
