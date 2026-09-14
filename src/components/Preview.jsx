import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { getActiveClip, getClipSourceTime } from '../lib/playback';

// A video is considered "in sync" if the <video> element's own
// currentTime is within this many seconds of where the timeline says
// it should be. Small drift (normal decoder jitter) is left alone so
// native playback stays smooth; anything bigger snaps immediately.
// This single check handles both drift-correction during normal
// playback AND scrub-seeking - there's no separate code path for
// "the user just jumped somewhere else".
const DRIFT_TOLERANCE_SECONDS = 0.3;

// Preview no longer shows the *selected* clip - it shows whatever is
// active at the global `currentTime`. Selection (editorStore) and
// playback position (also editorStore, but a different field) are
// independent: the selected clip keeps its highlight in the Inspector
// even while a completely different clip is what's actually playing.
export default function Preview() {
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);

  const activeVideoClip = getActiveClip(tracks, assets, currentTime, 'video');
  // Only look for an active image if no video is playing - video takes
  // visual priority when both happen to be active (shouldn't normally
  // both be active at once, but this keeps the policy unambiguous).
  const activeImageClip = !activeVideoClip
    ? getActiveClip(tracks, assets, currentTime, 'image')
    : null;

  const videoAsset = activeVideoClip
    ? assets.find((a) => a.id === activeVideoClip.assetId)
    : null;
  const imageAsset = activeImageClip
    ? assets.find((a) => a.id === activeImageClip.assetId)
    : null;

  return (
    <section className="panel preview">
      <div className="panel-header">
        <h2>Preview</h2>
      </div>
      <div className="preview-surface">
        {videoAsset && (
          // Keyed by asset id so switching to a different clip's asset
          // remounts a fresh <video> element rather than reusing one in
          // place - simpler and more predictable than patching src on
          // an existing element, at the cost of a tiny reload blip at
          // clip boundaries (negligible for local blob URLs).
          <VideoLayer
            key={videoAsset.id}
            asset={videoAsset}
            clip={activeVideoClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        )}
        {!videoAsset && imageAsset && (
          <img key={imageAsset.id} src={imageAsset.src} alt={imageAsset.name} className="preview-media" />
        )}
        {!videoAsset && !imageAsset && (
          <p className="empty-state">No active clip at this position.</p>
        )}
      </div>
    </section>
  );
}

function VideoLayer({ asset, clip, currentTime, isPlaying }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sourceTime = getClipSourceTime(clip, currentTime);

    if (Math.abs(video.currentTime - sourceTime) > DRIFT_TOLERANCE_SECONDS) {
      video.currentTime = sourceTime;
    }

    if (isPlaying && video.paused) {
      // Playback is user-initiated (the Play button), but this call
      // itself happens inside an effect rather than the click handler
      // directly, so some browsers may still block it without a prior
      // gesture - fail silently rather than throwing.
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [clip, currentTime, isPlaying]);

  return (
    <video
      ref={videoRef}
      src={asset.src}
      className="preview-media"
      playsInline
    />
  );
}
