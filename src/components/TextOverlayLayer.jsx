import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { useHistoryStore } from '../store/historyStore';
import { beginPointerDrag } from '../lib/pointerDrag';
import { buildFontString, DEFAULT_OVERLAY_STYLE } from '../lib/textGeometry';

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}

// One of these renders per active text overlay, positioned absolutely
// within Preview's .composition-frame using CSS percentages - x=0.5
// means "50% across the frame", the same normalized coordinate space
// export's Canvas rendering maps onto actual pixels (see
// textGeometry.js and export/renderTextOverlays.js). `frameWidth`/
// `frameHeight` are the frame's CURRENT measured pixel size (from
// Preview's useElementSize), needed only to convert a drag's pixel
// delta into a normalized delta - not for positioning itself, which
// CSS percentages already handle.
export default function TextOverlayLayer({ overlay, previewScale, frameWidth, frameHeight }) {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const pause = useEditorStore((state) => state.pause);
  const updateClip = useProjectStore((state) => state.updateClip);
  const beginTransaction = useHistoryStore((state) => state.beginTransaction);
  const commitTransaction = useHistoryStore((state) => state.commitTransaction);
  const cancelTransaction = useHistoryStore((state) => state.cancelTransaction);

  const isSelected = selectedClipId === overlay.id;
  const dragOriginRef = useRef(null);

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation(); // don't let the composition-frame's background click deselect right after selecting

    setSelectedClipId(overlay.id);
    if (isPlaying) pause(); // preserve currentTime; do not auto-resume after the edit - same policy as Clip.jsx
    beginTransaction();

    dragOriginRef.current = { x: overlay.x, y: overlay.y };

    beginPointerDrag(event, {
      onMove: (deltaX, deltaY) => {
        // Pixel delta -> normalized delta using the frame's actual
        // measured size, so dragging feels 1:1 with the pointer
        // regardless of how large Preview is currently rendered.
        const deltaNormX = frameWidth > 0 ? deltaX / frameWidth : 0;
        const deltaNormY = frameHeight > 0 ? deltaY / frameHeight : 0;
        updateClip(overlay.id, {
          x: clamp01(dragOriginRef.current.x + deltaNormX),
          y: clamp01(dragOriginRef.current.y + deltaNormY),
        });
      },
      onEnd: (moved) => {
        if (moved) commitTransaction();
        else cancelTransaction();
      },
    });
  }

  const fontSize = (overlay.fontSize ?? DEFAULT_OVERLAY_STYLE.fontSize) * previewScale;

  const style = {
    left: `${overlay.x * 100}%`,
    top: `${overlay.y * 100}%`,
    font: buildFontString(overlay, fontSize),
    color: overlay.color ?? DEFAULT_OVERLAY_STYLE.color,
    textAlign: overlay.textAlign ?? DEFAULT_OVERLAY_STYLE.textAlign,
  };

  return (
    <div
      className={`text-overlay${isSelected ? ' text-overlay-selected' : ''}`}
      style={style}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={handlePointerDown}
    >
      {overlay.text}
    </div>
  );
}
