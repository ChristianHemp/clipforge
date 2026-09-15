import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import MediaLibrary from './components/MediaLibrary';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import Inspector from './components/Inspector';
import { useEditorStore } from './store/editorStore';
import { useProjectStore } from './store/projectStore';
import { useHistoryStore } from './store/historyStore';
import { usePlaybackClock } from './hooks/usePlaybackClock';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { performUndo, performRedo } from './lib/undoRedoActions';
import { isEditableTarget } from './lib/isEditableTarget';

export default function App() {
  // Mounted once, globally - this is what actually advances
  // currentTime during playback. See hooks/usePlaybackClock.js.
  usePlaybackClock();

  // Also mounted once, globally: loads any saved project from
  // IndexedDB on startup, then debounce-saves future changes back to
  // it. See hooks/useProjectPersistence.js.
  useProjectPersistence();
  const isHydrated = useEditorStore((state) => state.isHydrated);

  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const removeClip = useProjectStore((state) => state.removeClip);
  const checkpoint = useHistoryStore((state) => state.checkpoint);

  // Global keyboard shortcuts: Delete/Backspace removes the selected
  // clip (a faster alternative to the Inspector's Delete button), and
  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z (also Ctrl+Y) drive undo/redo. All of
  // these are ignored while focus is inside a text field - see
  // isEditableTarget.js - so the browser's own text-undo and typing
  // keep working normally there instead of being hijacked.
  useEffect(() => {
    function handleKeyDown(event) {
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const withModifier = event.metaKey || event.ctrlKey;

      if (withModifier && key === 'z') {
        event.preventDefault(); // don't let the browser attempt its own page-level undo
        if (event.shiftKey) performRedo();
        else performUndo();
        return;
      }
      if (withModifier && key === 'y') {
        event.preventDefault();
        performRedo();
        return;
      }

      if (!selectedClipId) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        checkpoint(); // before removeClip, matching Inspector's Delete button
        removeClip(selectedClipId);
        setSelectedClipId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, removeClip, setSelectedClipId, checkpoint]);

  // Wait for hydration before rendering the real editor - otherwise a
  // saved project would flash as empty for a moment while IndexedDB
  // reads resolve, which is confusing at best and (if hydration were
  // slow) risks the debounced autosave firing against real data before
  // it's been restored. useProjectPersistence.js already guards
  // against that at the persistence layer; this is the UI-visible
  // half of the same guarantee.
  if (!isHydrated) {
    return <div className="app-loading">Loading project…</div>;
  }

  return (
    <div className="app">
      <Toolbar />
      <div className="main-area">
        <MediaLibrary />
        <Preview />
        <Inspector />
      </div>
      <Timeline />
    </div>
  );
}
