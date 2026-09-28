// Application-wide configuration constants.
// Centralized so behavior (naming, storage keys, limits) can change in one place.

export const APP_NAME = "AI Code Observatory";
export const APP_TAGLINE =
  "A JavaScript execution visualization & analysis environment";
export const APP_VERSION = "0.1.0";

export const STORAGE_KEYS = {
  THEME: "aco.theme",
  LAST_SOURCE: "aco.lastSource",
};

export const THEME_MODES = ["dark", "light", "system"];
export const DEFAULT_THEME_MODE = "dark";

// Guardrails for the execution engine (used by later steps: worker + instrumentation).
export const EXECUTION_LIMITS = {
  MAX_EVENTS: 20000,
  MAX_EXECUTION_MS: 5000,
  MAX_CALL_STACK_DEPTH: 500,
};

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4];
