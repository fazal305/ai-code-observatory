import { useState } from 'react'
import Button from '../common/Button.jsx'
import { formatJavaScript } from '../../utils/formatting.js'
import styles from './EditorToolbar.module.css'

function EditorToolbar({ value, onChange, cursorPosition }) {
  const [formatError, setFormatError] = useState(null)

  const handleFormat = async () => {
    try {
      const formatted = await formatJavaScript(value)
      setFormatError(null)
      onChange(formatted)
    } catch (error) {
      setFormatError(error.message.split('\n')[0])
    }
  }

  const handleClear = () => {
    setFormatError(null)
    onChange('')
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <Button size="sm" onClick={handleFormat} title="Format with Prettier">
          Format
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClear} title="Clear the editor">
          Clear
        </Button>
        {formatError ? <span className={styles.error}>{formatError}</span> : null}
      </div>
      <div className={styles.right}>
        {cursorPosition ? (
          <span className={styles.cursor}>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default EditorToolbar
