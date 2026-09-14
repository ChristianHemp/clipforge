import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import MediaLibrary from './components/MediaLibrary';
import Preview from './components/Preview';
import Timeline from './components/Timeline';
import Inspector from './components/Inspector';
import { useEditorStore } from './store/editorStore';
import { useProjectStore } from './store/projectStore';

export default function App() {
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
