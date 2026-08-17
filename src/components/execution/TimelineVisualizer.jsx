import { useMemo, useRef } from 'react'
import { useExecution } from '../../context/ExecutionContext.jsx'
import { deriveTimelineSpans, deriveTimelineMarkers } from '../../utils/deriveTimelineSpans.js'
import EmptyState from '../common/EmptyState.jsx'
import Button from '../common/Button.jsx'
import styles from './TimelineVisualizer.module.css'

const MARKER_LABEL = {
  console: 'console',
  timer: 'timer',
  promise: 'promise',
  microtask: 'microtask',
}

function formatMs(ms) {
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms`
}

function TimelineVisualizer() {
  const { playback } = useExecution()
  const {
    isFinished,
    totalEvents,
    allEvents,
    cursor,
    isLive,
    isPlaying,
    speed,
    speeds,
    setSpeed,
    play,
    pause,
    stepForward,
    stepBackward,
    seekTo,
    resetPlayback,
  } = playback
  const trackRef = useRef(null)

  const spans = useMemo(() => deriveTimelineSpans(allEvents), [allEvents])
  const markers = useMemo(() => deriveTimelineMarkers(allEvents), [allEvents])
  const maxDepth = spans.reduce((max, s) => Math.max(max, s.depth), 0)

  const startTime = allEvents[0]?.timestamp ?? 0
  const rawDuration = (allEvents[allEvents.length - 1]?.timestamp ?? startTime) - startTime
  const duration = Math.max(rawDuration, 20)

  // Real timer delays create meaningful gaps worth showing proportionally
  // (a 100ms setTimeout really should sit far right of a 0ms one). Without
  // one, elapsed wall-clock time for a handful of synchronous calls is
  // mostly postMessage/measurement noise — evenly-spaced-by-index reads far
  // more clearly there, and still shows order, nesting, and relative gaps.
  const hasRealDelay = useMemo(() => allEvents.some((e) => e.type === 'TIMER_SCHEDULED' && e.payload.delay > 0), [allEvents])

  const fractionForTime = (t) => Math.min(1, Math.max(0, (t - startTime) / duration))
  const fractionForIndex = (i) => (totalEvents > 0 ? Math.min(1, Math.max(0, i / totalEvents)) : 0)
  const positionOf = (index, timestamp) => (hasRealDelay ? fractionForTime(timestamp) : fractionForIndex(index))

  const cursorTime = cursor > 0 ? (allEvents[cursor - 1]?.timestamp ?? startTime) : startTime
  const playheadFraction = hasRealDelay ? fractionForTime(cursorTime) : fractionForIndex(cursor)

  const handleTrackClick = (event) => {
    const track = trackRef.current
    if (!track || allEvents.length === 0) return
    const rect = track.getBoundingClientRect()
    const clickFraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    if (hasRealDelay) {
      const targetTime = startTime + clickFraction * duration
      let nearestIndex = allEvents.length
      let nearestDiff = Infinity
      allEvents.forEach((e, i) => {
        const diff = Math.abs(e.timestamp - targetTime)
        if (diff < nearestDiff) {
          nearestDiff = diff
          nearestIndex = i + 1
        }
      })
      seekTo(nearestIndex)
    } else {
      seekTo(Math.round(clickFraction * totalEvents))
    }
  }

  if (!isFinished) {
    return (
      <EmptyState
        icon="▤"
        title="Timeline"
        description={
          playback.totalEvents === 0
            ? 'Run your code, then scrub, step, and replay its execution here.'
            : 'Recording — the timeline becomes scrubbable once execution finishes.'
        }
      />
    )
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.readout}>
        <span>
          Event <strong>{cursor}</strong> / {totalEvents}
        </span>
        <span>{formatMs(cursorTime - startTime)}</span>
        {isLive ? <span className={styles.liveTag}>live end</span> : null}
      </div>

      <div
        ref={trackRef}
        className={styles.track}
        style={{ height: `${Math.max(1, maxDepth + 1) * 18 + 20}px` }}
        onClick={handleTrackClick}
        role="slider"
        aria-label="Execution timeline"
        aria-valuemin={0}
        aria-valuemax={totalEvents}
        aria-valuenow={cursor}
        tabIndex={0}
      >
        {spans.map((span) => {
          const left = positionOf(span.startIndex, span.startTime) * 100
          const width = Math.max(positionOf(span.endIndex, span.endTime) * 100 - left, 0.6)
          return (
            <div
              key={span.id}
              className={styles.span}
              style={{ left: `${left}%`, width: `${width}%`, top: `${span.depth * 18}px` }}
              title={`${span.label}() — ${formatMs(span.endTime - span.startTime)}`}
            >
              {span.label}()
            </div>
          )
        })}

        <div className={styles.markerLane} style={{ top: `${(maxDepth + 1) * 18}px` }}>
          {markers.map((marker, i) => (
            <div
              key={i}
              className={[styles.marker, styles[marker.kind]].join(' ')}
              style={{ left: `${positionOf(marker.index, marker.timestamp) * 100}%` }}
              title={MARKER_LABEL[marker.kind]}
            />
          ))}
        </div>

        <div className={styles.playhead} style={{ left: `${playheadFraction * 100}%` }} />
      </div>

      <div className={styles.axis}>
        {hasRealDelay ? (
          <>
            <span>0ms</span>
            <span>{formatMs(duration)}</span>
          </>
        ) : (
          <>
            <span>event 0</span>
            <span className={styles.axisNote}>spaced by event order — no real timer delays to scale against</span>
            <span>event {totalEvents}</span>
          </>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.transport}>
          <Button size="sm" variant="ghost" onClick={stepBackward} disabled={cursor === 0} aria-label="Step backward">
            ⏮
          </Button>
          <Button size="sm" variant="primary" onClick={isPlaying ? pause : play} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </Button>
          <Button size="sm" variant="ghost" onClick={stepForward} disabled={cursor >= totalEvents} aria-label="Step forward">
            ⏭
          </Button>
          <Button size="sm" variant="ghost" onClick={resetPlayback} disabled={isLive}>
            ↺ Live
          </Button>
        </div>
        <div className={styles.speeds}>
          {speeds.map((s) => (
            <Button key={s} size="sm" variant="ghost" active={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TimelineVisualizer
