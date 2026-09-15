import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { getActiveClip, getActiveClips, getActiveTextOverlays } from '../lib/playback';
import { syncMediaElement } from '../lib/mediaSync';
import { useMediaElementAudioRouting } from '../audio/useMediaElementAudioRouting';
import { useElementSize } from '../lib/useElementSize';
// Preview deliberately imports these two numbers from the export
// subsystem rather than duplicating them: Preview and export must
// agree on exactly one composition size for text overlay coordinates
// to mean the same thing in both places (see the composition-frame
// comment below). This is the one intentional coupling point between
// the two subsystems - nothing else about export leaks into Preview.
import { EXPORT_WIDTH, EXPORT_HEIGHT } from '../export/constants';
import AudioLayer from './AudioLayer';
import TextOverlayLayer from './TextOverlayLayer';

const VIDEO_DRIFT_TOLERANCE_SECONDS = 0.3;

// Preview no longer shows the *selected* clip - it shows whatever is
// active at the global `currentTime`. Selection (editorStore) and
// playback position (also editorStore, but a different field) are
// independent: the selected clip keeps its highlight in the Inspector
// even while a completely different clip is what's actually playing.
export default function Preview() {
  const currentTime = useEditorStore((state) => state.currentTime);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);

  const compositionFrameRef = useRef(null);
  // Text overlay font sizing scales against this (see
  // TextOverlayLayer's previewScale prop) - CSS handles overlay
  // POSITION scaling natively via percentages, but font-size has no
  // equivalent "percent of container" unit, so the actual measured
  // pixel size is needed to replicate export's
  // `fontSize * (previewWidth / EXPORT_WIDTH)` scaling.
  const compositionSize = useElementSize(compositionFrameRef);
  const previewScale = compositionSize.width > 0 ? compositionSize.width / EXPORT_WIDTH : 1;

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
  // Text overlays also support overlap, same reasoning as audio.
  const activeTextOverlays = getActiveTextOverlays(tracks, currentTime);

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
        {/* Fixed EXPORT_WIDTH:EXPORT_HEIGHT (16:9) box, letterboxed/
            pillarboxed within the available space via CSS aspect-ratio
            - mirrors export's computeAspectFitRect centering, just
            expressed in CSS instead of canvas math. This is the "full
            composition canvas" text overlays are positioned relative
            to (0,0 top-left, 1,1 bottom-right), NOT the fitted video's
            own rectangle - so overlay position stays meaningful
            regardless of which clip's aspect ratio happens to be
            active. */}
        <div className="composition-frame" ref={compositionFrameRef} onClick={() => setSelectedClipId(null)}>
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
          {!videoAsset && !imageAsset && activeTextOverlays.length === 0 && (
            <p className="empty-state">No active clip at this position.</p>
          )}

          <div className="overlay-layer">
            {activeTextOverlays.map((overlay) => (
              <TextOverlayLayer
                key={overlay.id}
                overlay={overlay}
                previewScale={previewScale}
                frameWidth={compositionSize.width}
                frameHeight={compositionSize.height}
              />
            ))}
          </div>
        </div>
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
  // playing through a separate, unmixed native output path. Also
  // returns this element's GainNode (Phase 9), kept in sync with
  // clip.volume below.
  const gainNodeRef = useMediaElementAudioRouting(videoRef);

  useEffect(() => {
    syncMediaElement(videoRef.current, clip, currentTime, isPlaying, VIDEO_DRIFT_TOLERANCE_SECONDS, gainNodeRef.current);
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
