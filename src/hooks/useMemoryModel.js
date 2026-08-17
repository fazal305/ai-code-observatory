import { useMemo, useRef } from 'react'

// Builds an educational reference model from the event log: which
// variables currently point at which value, and — critically — which
// variables share the SAME underlying object (aliases), using the refId
// the worker attaches to object/array snapshots (see
// engine/instrumentation/serialize.js's getRefId). Plain value equality
// can't tell aliasing apart from two separately-created equal objects;
// identity can, which is the whole point of this visualizer.
//
// The event scan (the part whose cost scales with run length) is done
// incrementally via a ref-held cache — see useVariableValues.js for the
// full rationale, the same O(n²)-over-a-run concern applies here. The
// final grouping pass below is intentionally NOT incremental: it's bounded
// by the number of distinct variables in the program, not the number of
// events, so it stays cheap to just redo every time.
export function useMemoryModel(events) {
  const cacheRef = useRef({ length: 0, lastEvent: null, currentByVariable: new Map(), shapeByRefId: new Map() })

  return useMemo(() => {
    const cache = cacheRef.current
    const isContinuation =
      events.length >= cache.length && (cache.length === 0 || events[cache.length - 1] === cache.lastEvent)

    if (!isContinuation) {
      cache.currentByVariable = new Map()
      cache.shapeByRefId = new Map()
      cache.length = 0
      cache.lastEvent = null
    }

    for (let i = cache.length; i < events.length; i++) {
      const event = events[i]
      if (event.type === 'VARIABLE_DECLARATION' || event.type === 'VARIABLE_UPDATE') {
        cache.currentByVariable.set(event.payload.variableId, {
          name: event.payload.name,
          value: event.payload.value,
          refId: event.payload.refId ?? null,
        })
        if (event.payload.refId) cache.shapeByRefId.set(event.payload.refId, event.payload.value)
      } else if (event.type === 'OBJECT_MUTATED' && event.payload.refId) {
        cache.shapeByRefId.set(event.payload.refId, event.payload.value)
      }
    }
    cache.length = events.length
    cache.lastEvent = events.length > 0 ? events[events.length - 1] : null

    const objectGroups = new Map()
    const primitives = []
    for (const [variableId, info] of cache.currentByVariable) {
      if (info.refId) {
        const group = objectGroups.get(info.refId) ?? { refId: info.refId, shape: info.value, variables: [] }
        group.shape = cache.shapeByRefId.get(info.refId) ?? group.shape
        group.variables.push({ variableId, name: info.name })
        objectGroups.set(info.refId, group)
      } else {
        primitives.push({ variableId, name: info.name, value: info.value })
      }
    }

    return { objectGroups: [...objectGroups.values()], primitives }
  }, [events])
}
