import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { getProjectDuration, formatTime } from '../lib/playback';

export default function Toolbar() {
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const togglePlayback = useEditorStore((state) => state.togglePlayback);
  const tracks = useProjectStore((state) => state.tracks);

  const projectDuration = getProjectDuration(tracks);

  function handleTogglePlayback() {
    if (!isPlaying) {
      if (projectDuration <= 0) return; // nothing to play
      // Restart from the beginning if pressing Play while sitting at
      // (or past) the end, rather than doing nothing.
      if (currentTime >= projectDuration) {
        setCurrentTime(0);
      }
    }
    togglePlayback();
  }

  return (
    <header className="toolbar">
      <h1>Video Editor</h1>
      <div className="transport">
        <button onClick={handleTogglePlayback} disabled={projectDuration <= 0}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="time-readout">
          {formatTime(currentTime)} / {formatTime(projectDuration)}
        </span>
      </div>
    </header>
  );
}
