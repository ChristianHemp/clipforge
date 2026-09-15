import { useEditorStore } from '../store/editorStore';
import { useProjectStore } from '../store/projectStore';
import { useHistoryStore } from '../store/historyStore';
import { getProjectDuration, formatTime } from '../lib/playback';
import { clearPersistedProject } from '../lib/projectPersistence';
import { performUndo, performRedo } from '../lib/undoRedoActions';
import { useExportProject } from '../export/useExportProject';
import { resumeEditorAudioContext } from '../audio/audioGraph';
import { generateId } from '../lib/id';
import { DEFAULT_OVERLAY_STYLE } from '../lib/textGeometry';

const DEFAULT_TEXT_OVERLAY_DURATION = 3;

export default function Toolbar() {
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const togglePlayback = useEditorStore((state) => state.togglePlayback);
  const persistenceError = useEditorStore((state) => state.persistenceError);
  const setPersistenceError = useEditorStore((state) => state.setPersistenceError);
  const resetTransientState = useEditorStore((state) => state.resetTransientState);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const assets = useProjectStore((state) => state.assets);
  const clearProject = useProjectStore((state) => state.clearProject);
  const getOrCreateTrack = useProjectStore((state) => state.getOrCreateTrack);
  const addClip = useProjectStore((state) => state.addClip);
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const checkpoint = useHistoryStore((state) => state.checkpoint);
  const exportState = useExportProject();

  const projectDuration = getProjectDuration(tracks);

  function handleAddText() {
    checkpoint(); // one history entry for the whole creation
    const trackId = getOrCreateTrack('text');
    const id = generateId();
    addClip(trackId, {
      id,
      type: 'text',
      text: 'Text',
      startTime: currentTime,
      duration: DEFAULT_TEXT_OVERLAY_DURATION,
      x: 0.5,
      y: 0.5,
      ...DEFAULT_OVERLAY_STYLE,
    });
    setSelectedClipId(id); // select it immediately so Inspector shows its fields for editing right away
  }

  function handleTogglePlayback() {
    if (!isPlaying) {
      if (projectDuration <= 0) return; // nothing to play
      // A genuine user gesture (this click) - the one place browsers
      // reliably allow an AudioContext to leave the 'suspended' state.
      resumeEditorAudioContext();
      // Restart from the beginning if pressing Play while sitting at
      // (or past) the end, rather than doing nothing.
      if (currentTime >= projectDuration) {
        setCurrentTime(0);
      }
    }
    togglePlayback();
  }

  async function handleClearProject() {
    if (assets.length === 0 && tracks.length === 0) return; // nothing to clear
    const confirmed = window.confirm(
      'Clear the current project? This removes all uploaded media and cannot be undone.'
    );
    if (!confirmed) return;

    clearProject(); // in-memory: revokes blob URLs, empties assets/tracks
    resetTransientState(); // selection/playhead/playback back to defaults
    clearHistory(); // a true reset is a history BOUNDARY - Undo must not resurrect a cleared project

    try {
      await clearPersistedProject(); // immediate, not debounced - a refresh right after Clear shouldn't restore stale data
      setPersistenceError(null);
    } catch (error) {
      console.error('Failed to clear saved project from storage:', error);
      setPersistenceError('Could not fully clear saved data - it may reappear after refresh.');
    }
  }

  return (
    <header className="toolbar">
      <h1>Video Editor</h1>
      <div className="transport">
        <button onClick={performUndo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)">
          Undo
        </button>
        <button onClick={performRedo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)">
          Redo
        </button>
        <button onClick={handleTogglePlayback} disabled={projectDuration <= 0}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="time-readout">
          {formatTime(currentTime)} / {formatTime(projectDuration)}
        </span>
      </div>
      <button onClick={handleAddText}>Add Text</button>
      <div className="export-controls">
        <button
          onClick={exportState.startExport}
          disabled={projectDuration <= 0 || exportState.status === 'exporting' || !exportState.isSupported}
          title={!exportState.isSupported ? 'This browser does not support video export' : undefined}
        >
          Export
        </button>
        {exportState.status === 'exporting' && (
          <>
            <span className="export-progress">Exporting… {Math.round(exportState.progress * 100)}%</span>
            <button onClick={exportState.cancelExport}>Cancel</button>
          </>
        )}
        {exportState.status === 'error' && <span className="export-error">{exportState.error}</span>}
      </div>
      <button className="clear-project-button" onClick={handleClearProject}>
        Clear Project
      </button>
      {persistenceError && <span className="persistence-error">{persistenceError}</span>}
    </header>
  );
}
