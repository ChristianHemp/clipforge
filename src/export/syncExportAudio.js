import { getActiveClips, getClipSourceTime } from '../lib/playback';
import { getClipVolume } from '../lib/volume';

// Same tolerance as the editor's AudioLayer (src/components/AudioLayer.jsx).
const DRIFT_TOLERANCE_SECONDS = 0.15;

// Returns a per-tick sync function for STANDALONE audio clips only.
// Video clips' own audio needs no separate handling here: their
// <video> elements are already being seeked/played by renderFrame.js
// for visual purposes, and since exportProject.js routes them into the
// SAME export audio graph once at load time, their audio comes along
// for the ride automatically - pausing a video for a visual gap also
// silences its audio, with no extra code.
//
// A factory, not a bare function, for the same reason renderFrame.js's
// createFrameRenderer is one: the "what was active last tick" state
// below must be fresh per export run, never shared module-level state
// that could leak between two separate exports.
export function createAudioSynchronizer() {
  let previouslyActiveIds = new Set();

  return async function syncExportAudio(time, { tracks, assets, audioElements, audioGraph }) {
    const activeClips = getActiveClips(tracks, assets, time, 'audio');
    const nowActiveIds = new Set(activeClips.map((clip) => clip.id));

    // Pause anything that WAS active but no longer is - mirrors
    // AudioLayer unmounting when a clip leaves the active set, just
    // expressed imperatively here since export has no React tree.
    for (const clipId of previouslyActiveIds) {
      if (!nowActiveIds.has(clipId)) {
        audioElements.get(clipId)?.pause();
      }
    }

    await Promise.all(
      activeClips.map(async (clip) => {
        const audio = audioElements.get(clip.id);
        if (!audio) return; // asset failed to load for export - skip silently, matching renderFrame.js's "draw black" fallback for the equivalent video case

        // Standalone audio elements are keyed by clip id (never shared
        // across clips - see loadExportAudioElements.js), so this only
        // ever needs to reflect the ONE clip this element belongs to,
        // but it's applied every tick for consistency with the video
        // path above rather than two different gain-setting strategies.
        const gainNode = audioGraph?.getGainNode(audio);
        if (gainNode) {
          gainNode.gain.value = getClipVolume(clip);
        }

        const sourceTime = getClipSourceTime(clip, time);
        const justBecameActive = !previouslyActiveIds.has(clip.id);
        const drifted = Math.abs(audio.currentTime - sourceTime) > DRIFT_TOLERANCE_SECONDS;

        if (justBecameActive || drifted) {
          audio.currentTime = sourceTime;
        }
        if (audio.paused) {
          await audio.play().catch(() => {});
        }
      })
    );

    previouslyActiveIds = nowActiveIds;
  };
}
