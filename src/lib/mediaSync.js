import { getClipSourceTime } from './playback';
import { getClipVolume, GAIN_RAMP_TIME_CONSTANT } from './volume';

// Synchronizes a <video>/<audio> element's playback position, play/
// pause state, AND (Phase 9) its GainNode's volume to the timeline/
// clip state. Shared by Preview's VideoLayer and AudioLayer so both
// element types use identical logic - only the drift tolerance differs
// per call site.
//
// This single position check handles both "correct small drift during
// normal playback" AND "the user just scrubbed somewhere else" - there
// is no separate code path for a jump versus ordinary jitter.
//
// `gainNode` is optional (null before routing has run, or if Web Audio
// is unavailable - see useMediaElementAudioRouting.js): when present,
// its gain is pushed toward the clip's current volume via
// setTargetAtTime rather than a direct assignment, to avoid an audible
// click if this fires while the value is changing quickly (e.g.
// dragging the Inspector's volume slider on a clip that's currently
// playing). See lib/volume.js for the exact ramp duration.
export function syncMediaElement(element, clip, currentTime, isPlaying, driftToleranceSeconds, gainNode) {
  if (!element) return;

  const sourceTime = getClipSourceTime(clip, currentTime);

  if (Math.abs(element.currentTime - sourceTime) > driftToleranceSeconds) {
    element.currentTime = sourceTime;
  }

  if (isPlaying && element.paused) {
    // Playback is user-initiated (the Play button), but this call
    // itself happens inside an effect rather than the click handler
    // directly, so some browsers may still block it without a prior
    // gesture - fail silently rather than throwing.
    element.play().catch(() => {});
  } else if (!isPlaying && !element.paused) {
    element.pause();
  }

  if (gainNode) {
    gainNode.gain.setTargetAtTime(getClipVolume(clip), gainNode.context.currentTime, GAIN_RAMP_TIME_CONSTANT);
  }
}
