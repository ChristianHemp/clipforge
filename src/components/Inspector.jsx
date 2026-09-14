import { useEditorStore } from '../store/editorStore';
import { useProjectStore, findClip } from '../store/projectStore';

export default function Inspector() {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);
  const removeClip = useProjectStore((state) => state.removeClip);

  const { clip } = findClip(tracks, selectedClipId);

  if (!clip) {
    return (
      <section className="panel inspector">
        <div className="panel-header">
          <h2>Inspector</h2>
        </div>
        <p className="empty-state">Select a clip to see its details.</p>
      </section>
    );
  }

  const asset = assets.find((a) => a.id === clip.assetId);

  function handleDelete() {
    removeClip(clip.id);
    setSelectedClipId(null);
  }

  return (
    <section className="panel inspector">
      <div className="panel-header">
        <h2>Inspector</h2>
      </div>
      <dl className="clip-details">
        <dt>Asset</dt>
        <dd>{asset?.name ?? 'Missing asset'}</dd>
        <dt>Start</dt>
        <dd>{clip.startTime.toFixed(2)}s</dd>
        <dt>Duration</dt>
        <dd>{clip.duration.toFixed(2)}s</dd>
      </dl>
      <button className="delete-button" onClick={handleDelete}>
        Delete Clip
      </button>
    </section>
  );
}
