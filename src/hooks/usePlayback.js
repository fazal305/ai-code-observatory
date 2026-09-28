import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyEvent, initialRunState } from "./useCodeExecution.js";
import { PLAYBACK_SPEEDS } from "../config/app.js";

// Replaying every event from scratch on every scrub tick would be O(n) per
// tick — fine for a click, not for smooth auto-play over thousands of
// events. Snapshots taken every N events bound replay cost to at most N
// events regardless of how far into the run the cursor sits.
const SNAPSHOT_INTERVAL = 200;
const BASE_TICK_MS = 120;

function buildSnapshots(events) {
  const snapshots = [{ index: 0, state: initialRunState }];
  let state = initialRunState;
  events.forEach((event, i) => {
    state = applyEvent(state, event);
    if ((i + 1) % SNAPSHOT_INTERVAL === 0)
      snapshots.push({ index: i + 1, state });
  });
  return snapshots;
}

function replayTo(events, snapshots, cursor) {
  let best = snapshots[0];
  for (const snap of snapshots) {
    if (snap.index > cursor) break;
    best = snap;
  }
  let state = best.state;
  for (let i = best.index; i < cursor; i++) {
    state = applyEvent(state, events[i]);
  }
  return state;
}

// Drives timeline scrubbing/playback on top of a finished run's event log.
// The returned `effectiveState` overlays the replayed point-in-time slices
// (callStack, scopes, promises, tasks, microtasks, consoleEntries, events)
// onto the live state — every visualizer already reads state from
// ExecutionContext, so once that context returns THIS effective state
// instead of the raw live one, all panels stay in sync with the scrub
// position for free, with no per-visualizer changes needed.
export function usePlayback(liveState) {
  const isFinished =
    liveState.status !== "idle" && liveState.status !== "running";
  const events = liveState.events;
  const totalEvents = events.length;

  const snapshots = useMemo(
    () => (isFinished ? buildSnapshots(events) : null),
    [isFinished, events],
  );

  const [cursor, setCursor] = useState(null); // null = live (show the real final state)
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // A fresh run invalidates any previous scrub position.
  const statusRef = useRef(liveState.status);
  useEffect(() => {
    if (liveState.status === "running" && statusRef.current !== "running") {
      setCursor(null);
      setIsPlaying(false);
    }
    statusRef.current = liveState.status;
  }, [liveState.status]);

  useEffect(() => {
    if (!isPlaying || !isFinished) return undefined;
    const id = setInterval(() => {
      setCursor((current) => {
        const next = (current ?? totalEvents) + 1;
        if (next >= totalEvents) {
          setIsPlaying(false);
          return totalEvents;
        }
        return next;
      });
    }, BASE_TICK_MS / speed);
    return () => clearInterval(id);
  }, [isPlaying, isFinished, speed, totalEvents]);

  const effectiveState = useMemo(() => {
    if (!isFinished || cursor === null || cursor >= totalEvents)
      return liveState;
    const replayed = replayTo(events, snapshots, cursor);
    return {
      ...liveState,
      events: events.slice(0, cursor),
      callStack: replayed.callStack,
      scopes: replayed.scopes,
      promises: replayed.promises,
      tasks: replayed.tasks,
      microtasks: replayed.microtasks,
      consoleEntries: replayed.consoleEntries,
    };
  }, [isFinished, cursor, totalEvents, events, snapshots, liveState]);

  const play = useCallback(() => {
    if (!isFinished) return;
    setCursor((current) =>
      current === null || current >= totalEvents ? 0 : current,
    );
    setIsPlaying(true);
  }, [isFinished, totalEvents]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCursor((current) => Math.min((current ?? totalEvents) + 1, totalEvents));
  }, [totalEvents]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setCursor((current) => Math.max((current ?? totalEvents) - 1, 0));
  }, [totalEvents]);

  const seekTo = useCallback(
    (index) => {
      setIsPlaying(false);
      setCursor(Math.max(0, Math.min(index, totalEvents)));
    },
    [totalEvents],
  );

  const resetPlayback = useCallback(() => {
    setIsPlaying(false);
    setCursor(null);
  }, []);

  return {
    isFinished,
    totalEvents,
    allEvents: events, // full, untruncated — for rendering the track itself, not just the scrubbed view
    cursor: cursor ?? totalEvents,
    isLive: cursor === null,
    isPlaying,
    speed,
    speeds: PLAYBACK_SPEEDS,
    setSpeed,
    effectiveState,
    play,
    pause,
    stepForward,
    stepBackward,
    seekTo,
    resetPlayback,
  };
}
