import { getClipSourceTime } from './playback';

// Synchronizes a <video>/<audio> element's playback position and
// play/pause state to the timeline. Shared by Preview's VideoLayer and
// AudioLayer (src/components/) so both element types use identical
// drift-correction logic - only the tolerance differs per call site
// (audio drift tends to be more perceptible than a slightly-off video
// frame, so AudioLayer uses a tighter threshold than VideoLayer).
//
// This single check handles both "correct small drift during normal
// playback" AND "the user just scrubbed somewhere else" - there is no
// separate code path for a jump versus ordinary jitter.
export function syncMediaElement(element, clip, currentTime, isPlaying, driftToleranceSeconds) {
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
}
