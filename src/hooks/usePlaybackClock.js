import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { getProjectDuration } from '../lib/playback';

// Drives the global timeline clock with requestAnimationFrame. Mounted
// once (in App.jsx) - this is the single authoritative source of
// `currentTime` during playback, not any individual <video> element.
//
// Rather than accumulating a small per-frame delta onto currentTime
// (which drifts over a long session, and would force this effect to
// depend on currentTime itself - recreating the RAF loop every single
// frame), this hook anchors a "baseline": the (wallClockTime,
// timelineTime) pair as of the moment playback last started or was
// seeked. Every frame it recomputes currentTime fresh from that fixed
// baseline:
//
//   currentTime = baseline.timelineTime + (now - baseline.wallTime)
//
// That can't accumulate drift, and the effect only needs to depend on
// `isPlaying` - so the RAF loop has one stable identity for the whole
// play session instead of being torn down and rebuilt every tick.
//
// To handle scrubbing *while playing* (or play() restarting from 0)
// without a separate "re-anchor" API, each tick compares the store's
// currentTime against what THIS loop last wrote there. If they don't
// match, something else changed it since the last frame, so the
// baseline is re-anchored to that new value before continuing - this
// one check covers "just started playing", "resumed", and "scrubbed
// mid-playback" uniformly.
export function usePlaybackClock() {
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const rafIdRef = useRef(null);
  const baselineRef = useRef(null);
  const lastWrittenRef = useRef(null);

  useEffect(() => {
    if (!isPlaying) {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      return;
    }

    // Starting a new play session: force the first tick below to
    // anchor fresh from whatever currentTime is right now.
    baselineRef.current = null;
    lastWrittenRef.current = null;

    function tick(rafTimestamp) {
      const { currentTime, setCurrentTime, setIsPlaying } = useEditorStore.getState();
      const { tracks } = useProjectStore.getState();
      const duration = getProjectDuration(tracks);

      const externallyChanged =
        baselineRef.current === null || Math.abs(currentTime - lastWrittenRef.current) > 0.001;

      if (externallyChanged) {
        baselineRef.current = { wallTime: rafTimestamp, timelineTime: currentTime };
      }

      const elapsedSeconds = (rafTimestamp - baselineRef.current.wallTime) / 1000;
      const nextTime = baselineRef.current.timelineTime + elapsedSeconds;

      if (nextTime >= duration) {
        // Reached the end: stop cleanly, playhead parked at the end
        // (not reset to 0 - that only happens when Play is pressed
        // again, see Toolbar's handleTogglePlayback).
        setCurrentTime(duration);
        setIsPlaying(false);
        lastWrittenRef.current = duration;
        return; // do not reschedule - playback has stopped
      }

      setCurrentTime(nextTime);
      lastWrittenRef.current = nextTime;
      rafIdRef.current = requestAnimationFrame(tick);
    }

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying]);
}
