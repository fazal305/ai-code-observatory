import { useMemo, useRef } from 'react'

// Rebuilding this map from scratch on every single new event would be
// O(n) per event — O(n²) over a run with n events (a real, measurable cost
// for something like the 6000+-event performance-loop example while its
// tab is open live). Instead, a ref-held map is extended incrementally:
// only events added since the last call are scanned. Mutating the same Map
// instance across renders is safe here because nothing downstream treats
// this Map's *reference* as an independent memoization signal — every
// consumer already re-renders whenever `events` itself changes, which is
// exactly what drives this hook.
export function useVariableValues(events) {
  const cacheRef = useRef({ length: 0, lastEvent: null, map: new Map() })

  return useMemo(() => {
    const cache = cacheRef.current
    const isContinuation =
      events.length >= cache.length && (cache.length === 0 || events[cache.length - 1] === cache.lastEvent)

    if (!isContinuation) {
      cache.map = new Map()
      cache.length = 0
      cache.lastEvent = null
    }

    for (let i = cache.length; i < events.length; i++) {
      const event = events[i]
      if (event.type === 'VARIABLE_DECLARATION' || event.type === 'VARIABLE_UPDATE') {
        cache.map.set(event.payload.variableId, event.payload.value)
      }
    }
    cache.length = events.length
    cache.lastEvent = events.length > 0 ? events[events.length - 1] : null

    return cache.map
  }, [events])
}
