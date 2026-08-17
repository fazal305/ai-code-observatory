// Theme metadata consumed by ThemeContext. The actual color values live in
// index.css as CSS custom properties, scoped by [data-theme="..."]; this
// module only knows the *names* of the modes and how to resolve "system".

export const THEME_STORAGE_VALUES = ['dark', 'light', 'system'];

export function resolveSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Resolves a stored preference ("dark" | "light" | "system") to the concrete
// theme that should be applied to the document ("dark" | "light").
export function resolveAppliedTheme(mode) {
  return mode === 'system' ? resolveSystemTheme() : mode;
}
