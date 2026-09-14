import { useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import { getProjectDuration } from '../lib/playback';
import { PIXELS_PER_SECOND } from '../lib/constants';
import Track from './Track';
import Playhead from './Playhead';

// Keeps a reasonable click target for seeking even on a short or empty
// project, rather than the timeline collapsing to zero width.
const MIN_TIMELINE_SECONDS = 10;

export default function Timeline() {
  const tracks = useProjectStore((state) => state.tracks);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const containerRef = useRef(null);

  const projectDuration = getProjectDuration(tracks);
  const timelineWidth = Math.max(projectDuration, MIN_TIMELINE_SECONDS) * PIXELS_PER_SECOND;

  // Clicking the ruler or any empty track background seeks the
  // playhead to that position. Clip.jsx stops propagation on its own
  // click handler, so clicking a clip selects it WITHOUT also seeking -
  // selection and playback position stay deliberately independent.
  // This works correctly whether paused or playing: usePlaybackClock
  // detects the resulting currentTime change and re-anchors its
  // baseline on the very next frame, so there's no jump or stall.
  function handleSeek(event) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickedSeconds = (event.clientX - rect.left + container.scrollLeft) / PIXELS_PER_SECOND;
    setCurrentTime(Math.min(Math.max(clickedSeconds, 0), projectDuration));
    setSelectedClipId(null);
  }

  return (
    <section className="panel timeline">
      <div className="panel-header">
        <h2>Timeline</h2>
      </div>

      {tracks.length === 0 ? (
        <p className="empty-state">Add an asset from the Media Library to get started.</p>
      ) : (
        <div className="timeline-body">
          {/* Fixed sidebar, deliberately outside the scrolling/time-
              coordinate area - see the comment in Track.jsx for why. */}
          <div className="track-labels">
            <div className="timeline-ruler-spacer" />
            {tracks.map((track) => (
              <div key={track.id} className="track-label">
                {track.type}
              </div>
            ))}
          </div>

          <div className="timeline-scroll" ref={containerRef} onClick={handleSeek}>
            <div className="timeline-content" style={{ width: timelineWidth }}>
              <div className="timeline-ruler" />
              <div className="track-list">
                {tracks.map((track) => (
                  <Track key={track.id} track={track} />
                ))}
              </div>
              <Playhead currentTime={currentTime} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
