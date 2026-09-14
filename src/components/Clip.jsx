import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { beginPointerDrag } from '../lib/pointerDrag';
import { calculateClipMove, calculateLeftTrim, calculateRightTrim } from '../lib/clipEditing';
import { PIXELS_PER_SECOND } from '../lib/constants';

export default function Clip({ clip, asset }) {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const pause = useEditorStore((state) => state.pause);
  const updateClip = useProjectStore((state) => state.updateClip);
  const isSelected = selectedClipId === clip.id;

  // Snapshot of the clip's own fields taken once at pointerdown. Every
  // pointermove during that same gesture computes the new values from
  // THIS fixed origin plus the pointer's total delta-so-far (not by
  // accumulating small per-frame deltas), so a long drag can't build up
  // rounding error.
  const dragOriginRef = useRef(null);

  // Selection happens on pointerdown (not click): starting a drag on
  // an unselected clip must select it before the drag even begins, and
  // relying on a `click` event after a pointer-capture drag is
  // unreliable (its target depends on raw release coordinates, not the
  // captured element). This also means dragging never clears an
  // existing selection - these handlers only ever select, never
  // deselect. Clicking empty timeline space (Timeline.jsx) is still
  // how a clip gets deselected.
  function selectAndPause() {
    setSelectedClipId(clip.id);
    if (isPlaying) pause(); // preserve currentTime; do not auto-resume after the edit
  }

  function handleBodyPointerDown(event) {
    if (event.button !== 0) return; // primary button/touch only
    event.preventDefault();
    event.stopPropagation(); // don't let Timeline's background click-to-seek fire
    selectAndPause();

    dragOriginRef.current = { startTime: clip.startTime };

    beginPointerDrag(event, {
      onMove: (deltaPixels) => {
        const deltaSeconds = deltaPixels / PIXELS_PER_SECOND;
        const startTime = calculateClipMove(dragOriginRef.current.startTime, deltaSeconds);
        updateClip(clip.id, { startTime });
      },
    });
  }

  function handleLeftHandlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation(); // don't also trigger handleBodyPointerDown
    selectAndPause();

    dragOriginRef.current = {
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart ?? 0,
    };

    beginPointerDrag(event, {
      onMove: (deltaPixels) => {
        const deltaSeconds = deltaPixels / PIXELS_PER_SECOND;
        updateClip(clip.id, calculateLeftTrim({ ...dragOriginRef.current, deltaSeconds }));
      },
    });
  }

  function handleRightHandlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectAndPause();

    dragOriginRef.current = {
      trimStart: clip.trimStart ?? 0,
      trimEnd: clip.trimEnd ?? clip.duration,
    };

    beginPointerDrag(event, {
      onMove: (deltaPixels) => {
        const deltaSeconds = deltaPixels / PIXELS_PER_SECOND;
        updateClip(
          clip.id,
          calculateRightTrim({ ...dragOriginRef.current, deltaSeconds, sourceDuration: asset?.duration })
        );
      },
    });
  }

  const style = {
    left: `${clip.startTime * PIXELS_PER_SECOND}px`,
    width: `${Math.max(clip.duration * PIXELS_PER_SECOND, 4)}px`,
  };

  return (
    <div
      className={`clip${isSelected ? ' clip-selected' : ''}`}
      style={style}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={handleBodyPointerDown}
    >
      <div className="clip-handle clip-handle-left" onPointerDown={handleLeftHandlePointerDown} />
      <span className="clip-name">{asset?.name ?? 'Missing asset'}</span>
      <div className="clip-handle clip-handle-right" onPointerDown={handleRightHandlePointerDown} />
    </div>
  );
}
