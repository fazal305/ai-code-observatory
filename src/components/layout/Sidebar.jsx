import ExampleSelector from '../editor/ExampleSelector.jsx'
import styles from './Sidebar.module.css'

function Sidebar({ activeExampleId, onSelectExample }) {
  return (
    <aside className={styles.sidebar} aria-label="Example library">
      <div className={styles.sectionHeader}>Examples</div>
      <div className={styles.scroll}>
        <ExampleSelector activeExampleId={activeExampleId} onSelect={onSelectExample} />
      </div>
    </aside>
  )
}

export default Sidebar
