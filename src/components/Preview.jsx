import { useEditorStore } from '../store/editorStore';
import { useProjectStore, findClip } from '../store/projectStore';

// Phase 1 preview: play the selected clip's raw asset with the browser's
// native <video>/<audio> controls. This intentionally does NOT sync to
// a shared playhead or composite multiple clips together yet - that's
// real synchronization work saved for a later phase.
export default function Preview() {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);

  const { clip } = findClip(tracks, selectedClipId);
  const asset = clip ? assets.find((a) => a.id === clip.assetId) : null;

  return (
    <section className="panel preview">
      <div className="panel-header">
        <h2>Preview</h2>
      </div>
      <div className="preview-surface">
        {!asset && <p className="empty-state">Select a clip to preview it.</p>}
        {asset?.type === 'video' && (
          <video key={asset.id} src={asset.src} controls className="preview-media" />
        )}
        {asset?.type === 'image' && (
          <img key={asset.id} src={asset.src} alt={asset.name} className="preview-media" />
        )}
        {asset?.type === 'audio' && (
          <audio key={asset.id} src={asset.src} controls className="preview-media" />
        )}
      </div>
    </section>
  );
}
