// 0 = silent, 1 = full/original volume. Phase 9 deliberately does not
// support gain above 1.0 (no "boost") - matching the stated scope.
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
export const DEFAULT_VOLUME = 1;

// How quickly a GainNode approaches a new target volume once set via
// setTargetAtTime (see mediaSync.js) - an exponential approach that
// reaches ~95% of the way there after roughly 3x this value. Short
// enough to feel instantaneous to a user dragging the slider, long
// enough to avoid the audible "click" a truly instant gain jump can
// produce mid-waveform.
export const GAIN_RAMP_TIME_CONSTANT = 0.015;

// Single source of truth for "what is this clip's volume right now" -
// used identically by Inspector (to show the slider), the editor audio
// graph (mediaSync.js), and the export audio graph (renderFrame.js /
// syncExportAudio.js), so a missing or invalid value is interpreted
// exactly the same way everywhere rather than re-decided independently
// at each call site. Old clips with no `volume` field at all fall
// through to DEFAULT_VOLUME here - no migration needed.
export function getClipVolume(clip) {
  const raw = clip?.volume;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_VOLUME;
  return Math.min(Math.max(raw, MIN_VOLUME), MAX_VOLUME);
}
