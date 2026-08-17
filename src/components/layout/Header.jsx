import Button from '../common/Button.jsx'
import ExecutionControls from '../execution/ExecutionControls.jsx'
import ExecutionStatus from '../execution/ExecutionStatus.jsx'
import { useTheme } from '../../context/ThemeContext.jsx'
import { APP_NAME } from '../../config/app.js'
import styles from './Header.module.css'

const THEME_ICON = { dark: '🌙', light: '☀️', system: '🖥️' }

function Header({ onToggleSidebar, sidebarOpen, sourceCode, onOpenPalette }) {
  const { mode, cycleTheme } = useTheme()

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-pressed={sidebarOpen}
          className={styles.sidebarToggle}
        >
          ☰
        </Button>
        <span className={styles.mark} aria-hidden="true">
          ⌁
        </span>
        <span className={styles.name}>{APP_NAME}</span>
      </div>

      <div className={styles.center}>
        <ExecutionControls code={sourceCode} />
        <ExecutionStatus />
      </div>

      <div className={styles.right}>
        <Button variant="ghost" size="sm" onClick={onOpenPalette} title="Command palette (Ctrl/Cmd+K)">
          ⌘K
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleTheme}
          aria-label={`Theme: ${mode}. Click to cycle.`}
          title={`Theme: ${mode}`}
        >
          {THEME_ICON[mode]}
        </Button>
      </div>
    </header>
  )
}

export default Header
