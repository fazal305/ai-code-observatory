import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CommandPalette.module.css";

function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q))
      : commands;
    return list.filter((c) => !c.disabled);
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the dialog paints so it actually receives it.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const runCommand = (command) => {
    onClose();
    command.action();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[activeIndex]) runCommand(filtered[activeIndex]);
    } else if (event.key === "Tab") {
      // Every option is reachable via Arrow keys from the input, which stays
      // focused the whole time — Tab has no useful job here, so it's kept
      // from leaking focus out to the page behind this modal.
      event.preventDefault();
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Type a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search commands"
          aria-activedescendant={
            filtered[activeIndex]
              ? `cmd-${filtered[activeIndex].id}`
              : undefined
          }
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
        />
        <ul className={styles.list} id="command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className={styles.empty}>No matching commands.</li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  id={`cmd-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={[
                    styles.item,
                    index === activeIndex ? styles.active : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runCommand(command)}
                >
                  <span>{command.label}</span>
                  {command.shortcut ? (
                    <span className={styles.shortcut}>{command.shortcut}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette;
