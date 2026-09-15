import { getActiveClip, getClipSourceTime } from '../lib/playback';
import { computeAspectFitRect } from './aspectFit';
import { drawTextOverlays } from './renderTextOverlays';
import { getClipVolume } from '../lib/volume';

// Looser than Preview's 0.3s tolerance would be too loose for export
// (we want the recorded frame to closely match the intended source
// position), but tight enough to avoid reseeking on every frame due to
// ordinary decoder jitter while a video is already playing forward
// naturally in sync with the export clock.
const DRIFT_TOLERANCE_SECONDS = 0.15;

// Returns a renderFrame(ctx, params) function. A factory rather than a
// bare export: `lastActiveClipId` below must be fresh per export run,
// not shared module-level state that could leak between two separate
// exports (e.g. if the user exports twice in a row).
export function createFrameRenderer() {
  let lastActiveClipId = null;

  return async function renderFrame(ctx, { canvasWidth, canvasHeight, time, tracks, assets, videoElements, audioGraph }) {
    // Filled every frame before anything else - this is what makes a
    // gap between clips render as black without any special-casing:
    // if nothing is active below, this is simply never painted over.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Same active-clip policy as normal playback (first match wins,
    // scanning tracks/clips in array order) - reused directly, not
    // reimplemented, so export can never disagree with Preview about
    // which clip is showing at a given time.
    const activeClip = getActiveClip(tracks, assets, time, 'video');

    // Restructured (Phase 8) from three early `return`s into this
    // if/else so text overlays - drawn unconditionally at the end -
    // still appear during a video gap or a missing-asset frame, not
    // just while a video happens to be active. Every branch below is
    // otherwise unchanged from the original per-video logic.
    if (!activeClip) {
      pauseAll(videoElements);
      lastActiveClipId = null;
    } else {
      const video = videoElements.get(activeClip.assetId);
      if (!video) {
        // Referenced asset failed to load into an export video element -
        // draw black for this frame rather than aborting the whole export.
        lastActiveClipId = activeClip.id;
      } else {
        pauseAllExcept(videoElements, activeClip.assetId);

        const sourceTime = getClipSourceTime(activeClip, time);
        const clipJustBecameActive = activeClip.id !== lastActiveClipId;
        const drifted = Math.abs(video.currentTime - sourceTime) > DRIFT_TOLERANCE_SECONDS;

        // A clip change always forces a seek, regardless of drift - two
        // different clips can reference the same asset, where the drift
        // check alone might (wrongly) look "close enough".
        if (clipJustBecameActive || drifted) {
          await seekTo(video, sourceTime);
        }
        if (video.paused) {
          await video.play().catch(() => {});
        }

        // This element may be shared with a DIFFERENT clip (same
        // asset, used twice) that has a different volume - so gain is
        // re-applied here, keyed to THIS tick's active clip, every
        // frame, rather than once when the element was first routed.
        const gainNode = audioGraph?.getGainNode(video);
        if (gainNode) {
          gainNode.gain.value = getClipVolume(activeClip);
        }

        const rect = computeAspectFitRect(video.videoWidth, video.videoHeight, canvasWidth, canvasHeight);
        ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);

        lastActiveClipId = activeClip.id;
      }
    }

    // Text overlays draw on top of whatever was (or wasn't) drawn
    // above - independent of video activity, so a title card can show
    // during a video gap.
    drawTextOverlays(ctx, { canvasWidth, canvasHeight, time, tracks });
  };
}

function pauseAll(videoElements) {
  for (const video of videoElements.values()) {
    if (!video.paused) video.pause();
  }
}

function pauseAllExcept(videoElements, keepAssetId) {
  for (const [assetId, video] of videoElements) {
    if (assetId !== keepAssetId && !video.paused) video.pause();
  }
}

function seekTo(video, time) {
  return new Promise((resolve) => {
    function handleSeeked() {
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    }
    video.addEventListener('seeked', handleSeeked);
    video.currentTime = time;
    // `seeked` is documented to not always fire reliably across
    // browsers/codecs - never let one stuck seek hang the whole export.
    setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    }, 200);
  });
}
