import { useCallback, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { useTheme } from "../../context/ThemeContext.jsx";
import styles from "./CodeEditor.module.css";

const jsLanguage = javascript();

// Matches the CodeMirror chrome to the app's CSS-variable theme so the
// editor never looks like a bolted-on third-party widget.
const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      height: "100%",
    },
    ".cm-content": { caretColor: "var(--accent)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--text-muted)",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "var(--surface-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--surface-hover)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--accent-muted) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--accent)" },
  },
  { dark: false },
);

const darkOverrides = EditorView.theme({
  "&": { backgroundColor: "transparent", height: "100%" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
});

function CodeEditor({ value, onChange, onCursorChange, readOnly = false }) {
  const { appliedTheme } = useTheme();
  const viewRef = useRef(null);

  const extensions = useMemo(
    () => [
      jsLanguage,
      EditorView.lineWrapping,
      ...(appliedTheme === "dark" ? [oneDark, darkOverrides] : [lightTheme]),
    ],
    [appliedTheme],
  );

  const handleCreateEditor = useCallback((view) => {
    viewRef.current = view;
  }, []);

  const handleUpdate = useCallback(
    (viewUpdate) => {
      if (!onCursorChange) return;
      if (!viewUpdate.selectionSet && !viewUpdate.docChanged) return;
      const pos = viewUpdate.state.selection.main.head;
      const line = viewUpdate.state.doc.lineAt(pos);
      onCursorChange({ line: line.number, column: pos - line.from + 1 });
    },
    [onCursorChange],
  );

  return (
    <div className={styles.wrapper}>
      <CodeMirror
        value={value}
        height="100%"
        theme="none"
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={handleCreateEditor}
        onUpdate={handleUpdate}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          foldGutter: true,
          tabSize: 2,
        }}
        className={styles.codemirror}
      />
    </div>
  );
}

export default CodeEditor;
