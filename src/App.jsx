import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import MediaLibrary from './components/MediaLibrary';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import Inspector from './components/Inspector';
import { useEditorStore } from './store/editorStore';
import { useProjectStore } from './store/projectStore';
import { usePlaybackClock } from './hooks/usePlaybackClock';
import { useProjectPersistence } from './hooks/useProjectPersistence';

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

  // Delete/Backspace removes the selected clip, as a faster alternative
  // to the Inspector's Delete button. Ignored while typing in a field
  // so future text inputs (clip names, etc.) don't lose keystrokes.
  useEffect(() => {
    function handleKeyDown(event) {
      if (!selectedClipId) return;
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        removeClip(selectedClipId);
        setSelectedClipId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, removeClip, setSelectedClipId]);

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
