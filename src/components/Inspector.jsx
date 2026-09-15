import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useProjectStore, findClip } from '../store/projectStore';
import { useHistoryStore } from '../store/historyStore';
import { DEFAULT_OVERLAY_STYLE } from '../lib/textGeometry';

export default function Inspector() {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);
  const removeClip = useProjectStore((state) => state.removeClip);
  const updateClip = useProjectStore((state) => state.updateClip);
  const checkpoint = useHistoryStore((state) => state.checkpoint);
  const beginTransaction = useHistoryStore((state) => state.beginTransaction);
  const commitTransaction = useHistoryStore((state) => state.commitTransaction);
  const cancelTransaction = useHistoryStore((state) => state.cancelTransaction);

  // Persists a field's value across the focus->blur span of a SINGLE
  // edit session, so onBlur can tell "the user actually changed this"
  // apart from "they just clicked in and back out" - a plain variable
  // wouldn't survive the re-renders that happen between those two
  // events (every keystroke re-renders Inspector via updateClip), so
  // this has to be a ref, the same reason Clip.jsx's drag math uses one.
  const fieldValueAtFocusRef = useRef(null);

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

  function handleDelete() {
    checkpoint(); // before removeClip, so Undo restores exactly this clip (same id, same fields)
    removeClip(clip.id);
    setSelectedClipId(null);
  }

  // Typing "H", "He", "Hel", "Hell", "Hello" must not create five
  // undo entries - beginTransaction on focus snapshots the state
  // BEFORE the edit starts, live updateClip calls on every keystroke
  // update the field with no history entry each time (matching how a
  // drag's intermediate pointermoves don't create entries either), and
  // commitTransaction on blur collapses the whole edit into ONE entry -
  // or, if the value never actually changed (focused and blurred
  // without editing), cancelTransaction creates none at all. This
  // never touches the input's own native undo (Cmd/Ctrl+Z while
  // focused still does normal text-undo) since nothing here intercepts
  // keydown - only focus/change/blur.
  function handleFieldFocus(event) {
    fieldValueAtFocusRef.current = event.target.value;
    beginTransaction();
  }

  function handleFieldBlur(event) {
    if (event.target.value !== fieldValueAtFocusRef.current) {
      commitTransaction();
    } else {
      cancelTransaction();
    }
    fieldValueAtFocusRef.current = null;
  }

  function updateTextField(field, value) {
    updateClip(clip.id, { [field]: value });
  }

  // Weight/alignment are discrete, one-click choices (a dropdown pick,
  // a button click) - not continuous input like typing, so each change
  // is already a single complete edit and just gets its own checkpoint
  // directly, no focus/blur transaction needed.
  function setDiscreteField(field, value) {
    checkpoint();
    updateClip(clip.id, { [field]: value });
  }

  if (clip.type === 'text') {
    return (
      <section className="panel inspector">
        <div className="panel-header">
          <h2>Inspector</h2>
        </div>

        <label className="field">
          <span className="field-label">Text</span>
          <input
            type="text"
            value={clip.text ?? ''}
            onFocus={handleFieldFocus}
            onChange={(event) => updateTextField('text', event.target.value)}
            onBlur={handleFieldBlur}
          />
        </label>

        <label className="field">
          <span className="field-label">Font Size</span>
          <input
            type="number"
            min="1"
            value={clip.fontSize ?? DEFAULT_OVERLAY_STYLE.fontSize}
            onFocus={handleFieldFocus}
            onChange={(event) => updateTextField('fontSize', Number(event.target.value) || 1)}
            onBlur={handleFieldBlur}
          />
        </label>

        <label className="field">
          <span className="field-label">Color</span>
          <input
            type="color"
            value={clip.color ?? DEFAULT_OVERLAY_STYLE.color}
            onFocus={handleFieldFocus}
            onChange={(event) => updateTextField('color', event.target.value)}
            onBlur={handleFieldBlur}
          />
        </label>

        <label className="field">
          <span className="field-label">Weight</span>
          <select
            value={clip.fontWeight ?? DEFAULT_OVERLAY_STYLE.fontWeight}
            onChange={(event) => setDiscreteField('fontWeight', event.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </label>

        <div className="field">
          <span className="field-label">Alignment</span>
          <div className="alignment-buttons">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                className={(clip.textAlign ?? DEFAULT_OVERLAY_STYLE.textAlign) === align ? 'alignment-active' : ''}
                onClick={() => setDiscreteField('textAlign', align)}
              >
                {align[0].toUpperCase() + align.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button className="delete-button" onClick={handleDelete}>
          Delete Text
        </button>
      </section>
    );
  }

  const asset = assets.find((a) => a.id === clip.assetId);

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
