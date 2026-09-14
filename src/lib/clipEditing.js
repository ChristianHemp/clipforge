// Pure math for turning a pointer-drag delta into new clip field
// values. Kept separate from lib/playback.js on purpose: playback.js
// answers "given currentTime, what's true right now" (read side);
// this module answers "given a drag, what should the clip's stored
// fields become" (write side, called from Clip.jsx's drag handlers).
//
// All three functions are pure and side-effect free, so they can be
// (and were) checked against the task's worked examples directly in
// Node, without touching React or Zustand at all.
import { MIN_CLIP_DURATION } from './constants';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Moving a clip only ever changes startTime - trimStart/trimEnd (and
// therefore duration) are untouched, since moving doesn't change which
// part of the source media is shown, only when it plays.
export function calculateClipMove(originalStartTime, deltaSeconds) {
  return Math.max(0, originalStartTime + deltaSeconds);
}

// Dragging the RIGHT trim handle changes how much of the source is
// shown from the end. startTime and trimStart stay fixed; trimEnd
// moves and duration is re-derived from it, rather than computed
// independently - that keeps `duration = trimEnd - trimStart` true by
// construction instead of by two separate clamped calculations that
// could drift apart from each other.
export function calculateRightTrim({ trimStart, trimEnd, deltaSeconds, sourceDuration }) {
  // Number.isFinite, not `?? Infinity`: nullish coalescing only
  // substitutes for null/undefined, not for NaN - and a NaN
  // sourceDuration (e.g. from a video whose real length the browser
  // hadn't resolved yet) would otherwise clamp trimEnd to NaN here.
  const upperBound = Number.isFinite(sourceDuration) ? sourceDuration : Infinity;
  const lowerBound = trimStart + MIN_CLIP_DURATION;
  const newTrimEnd = clamp(trimEnd + deltaSeconds, lowerBound, upperBound);

  return {
    trimEnd: newTrimEnd,
    duration: newTrimEnd - trimStart,
  };
}

// Dragging the LEFT trim handle is the subtler case: the clip's
// timeline END point (startTime + duration) must stay fixed while its
// visible START moves. A single delta is clamped against all three
// constraints at once - can't reveal source before 0, can't move the
// timeline start before 0, can't shrink below the minimum duration -
// and then applied uniformly to all three fields. Clamping the delta
// once, rather than clamping startTime/trimStart/duration separately
// afterwards, is what guarantees they can never end up mutually
// inconsistent with each other.
export function calculateLeftTrim({ startTime, duration, trimStart, deltaSeconds }) {
  const minDelta = Math.max(-trimStart, -startTime);
  const maxDelta = duration - MIN_CLIP_DURATION;
  const clampedDelta = clamp(deltaSeconds, minDelta, maxDelta);

  return {
    startTime: startTime + clampedDelta,
    trimStart: trimStart + clampedDelta,
    duration: duration - clampedDelta,
  };
}
