import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import Track from './Track';

export default function Timeline() {
  const tracks = useProjectStore((state) => state.tracks);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);

  return (
    <section className="panel timeline">
      <div className="panel-header">
        <h2>Timeline</h2>
      </div>

      {tracks.length === 0 ? (
        <p className="empty-state">Add an asset from the Media Library to get started.</p>
      ) : (
        // Clicking empty timeline space deselects the current clip;
        // Clip.jsx stops propagation so clicking a clip itself doesn't.
        <div className="track-list" onClick={() => setSelectedClipId(null)}>
          {tracks.map((track) => (
            <Track key={track.id} track={track} />
          ))}
        </div>
      )}
    </section>
  );
}
