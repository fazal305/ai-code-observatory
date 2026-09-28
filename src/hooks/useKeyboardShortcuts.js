import { useEffect } from "react";

// Space/Arrow keys double as normal typing and navigation almost
// everywhere (the editor, native buttons, our own Tabs component's roving
// tabindex) — only reinterpret them as timeline shortcuts when focus isn't
// on anything that already owns them.
function ownsSpaceAndArrows(target) {
  if (!target) return false;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
    return true;
  if (target.isContentEditable) return true;
  if (typeof target.getAttribute === "function" && target.getAttribute("role"))
    return true;
  if (typeof target.closest === "function" && target.closest(".cm-editor"))
    return true;
  return false;
}

// Mounted once (in AppShell) so shortcuts work regardless of which panel
// has focus. Ctrl/Cmd+Enter, Escape, and Ctrl/Cmd+K are intentionally
// global — Space/Arrow keys back off wherever they'd otherwise be doing
// their normal job, per "don't override browser shortcuts unnecessarily".
export function useKeyboardShortcuts({
  onRun,
  onStop,
  onTogglePalette,
  onPlayPause,
  onStepForward,
  onStepBackward,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      // Respected globally, first, for every shortcut below — a dialog
      // (e.g. the command palette) that already handled and preventDefault-ed
      // this exact keydown (Escape to close itself, say) should not ALSO
      // trigger an app-wide action like stopping execution.
      if (event.defaultPrevented) return;

      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key === "Enter") {
        event.preventDefault();
        onRun?.();
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onTogglePalette?.();
        return;
      }
      if (event.key === "Escape") {
        onStop?.();
        return;
      }

      if (ownsSpaceAndArrows(event.target)) return;

      if (event.key === " ") {
        event.preventDefault();
        onPlayPause?.();
      } else if (event.key === "ArrowRight") {
        onStepForward?.();
      } else if (event.key === "ArrowLeft") {
        onStepBackward?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onRun,
    onStop,
    onTogglePalette,
    onPlayPause,
    onStepForward,
    onStepBackward,
  ]);
}
