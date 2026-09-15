import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { getActiveClip, getActiveClips } from '../lib/playback';
import { syncMediaElement } from '../lib/mediaSync';
import { useMediaElementAudioRouting } from '../audio/useMediaElementAudioRouting';
import AudioLayer from './AudioLayer';

const VIDEO_DRIFT_TOLERANCE_SECONDS = 0.3;

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
  // Unlike video, audio genuinely supports overlap - see
  // getActiveClips in lib/playback.js.
  const activeAudioClips = getActiveClips(tracks, assets, currentTime, 'audio');

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

      {/* No visual output - each owns one <audio> element's sync/routing
          lifecycle. Keyed by clip id, not asset id: two different clips
          can reference the same audio asset and need independent
          playback positions. */}
      {activeAudioClips.map((clip) => {
        const asset = assets.find((a) => a.id === clip.assetId);
        return asset ? (
          <AudioLayer key={clip.id} asset={asset} clip={clip} currentTime={currentTime} isPlaying={isPlaying} />
        ) : null;
      })}
    </section>
  );
}

function VideoLayer({ asset, clip, currentTime, isPlaying }) {
  const videoRef = useRef(null);
  // Routes this video's embedded audio through the same shared graph
  // AudioLayer uses, so a video clip's own dialogue/sound mixes
  // correctly with any overlapping standalone audio clips instead of
  // playing through a separate, unmixed native output path.
  useMediaElementAudioRouting(videoRef);

  useEffect(() => {
    syncMediaElement(videoRef.current, clip, currentTime, isPlaying, VIDEO_DRIFT_TOLERANCE_SECONDS);
  }, [clip, currentTime, isPlaying]);

  // Deterministically silence this element's audio the instant it's no
  // longer the active clip (component unmount - e.g. the playhead
  // entered a gap, or a different clip became active), rather than
  // relying on garbage-collection timing to eventually stop it.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={asset.src}
      className="preview-media"
      playsInline
    />
  );
}
