import { useEditorStore } from '../store/editorStore';
import { PIXELS_PER_SECOND } from '../lib/constants';

export default function Clip({ clip, asset }) {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const isSelected = selectedClipId === clip.id;

  const style = {
    left: `${clip.startTime * PIXELS_PER_SECOND}px`,
    width: `${Math.max(clip.duration * PIXELS_PER_SECOND, 4)}px`,
  };

  return (
    <div
      className={`clip${isSelected ? ' clip-selected' : ''}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedClipId(isSelected ? null : clip.id);
      }}
    >
      <span className="clip-name">{asset?.name ?? 'Missing asset'}</span>
    </div>
  );
}
