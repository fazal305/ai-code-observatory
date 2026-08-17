import { useMemo } from 'react'
import { analyzeSource } from '../engine/analyzer/analyzeSource.js'

// Static analysis runs again here on the main thread (it's pure and fast —
// the same call the worker makes before instrumenting) so visualizers can
// render structure (scope tree, closures, functions) without waiting on or
// coupling to the worker's execution lifecycle.
export function useSourceAnalysis(sourceCode) {
  return useMemo(() => analyzeSource(sourceCode), [sourceCode])
}
