import { useCallback, useEffect, useRef } from 'react'

// Generic Web Worker lifecycle manager: creates/terminates on demand and
// tags each worker instance with a "generation" so messages from a worker
// that has since been replaced or terminated are discarded instead of
// corrupting state with stale results (a real race in Run → Stop → Run).
export function useWorker(createWorker) {
  const workerRef = useRef(null)
  const generationRef = useRef(0)
  const listenersRef = useRef(new Set())

  const attach = useCallback((worker, generation) => {
    worker.onmessage = (event) => {
      if (generation !== generationRef.current) return
      // Security note: the code running inside this worker is UNTRUSTED
      // user code, and nothing stops it from calling the real
      // `self.postMessage` directly (we only wrap it for our own tracing
      // calls, we don't — and can't — remove it). That's not a cross-user
      // vulnerability: the only thing a spoofed message could do is feed
      // this app's OWN visualizers bad data about the user's OWN code, and
      // they could lie to themselves just as easily by editing devtools
      // state directly. It's still worth rejecting obviously-malformed
      // shapes here, at the boundary where untrusted data enters trusted
      // state, rather than trusting the channel unconditionally.
      const data = event.data
      if (!data || typeof data.type !== 'string' || typeof data.timestamp !== 'number') return
      listenersRef.current.forEach((listener) => listener(data))
    }
    worker.onerror = (event) => {
      if (generation !== generationRef.current) return
      listenersRef.current.forEach((listener) =>
        listener({
          type: 'EXECUTION_ERROR',
          payload: { name: 'WorkerError', message: event.message, stack: null },
          timestamp: performance.now(),
        })
      )
    }
  }, [])

  const start = useCallback(() => {
    workerRef.current?.terminate()
    generationRef.current += 1
    const worker = createWorker()
    attach(worker, generationRef.current)
    workerRef.current = worker
    return worker
  }, [createWorker, attach])

  const terminate = useCallback(() => {
    generationRef.current += 1
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const postMessage = useCallback((message) => {
    workerRef.current?.postMessage(message)
  }, [])

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  useEffect(() => terminate, [terminate])

  return { start, terminate, postMessage, subscribe }
}
