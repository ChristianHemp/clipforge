// Composes historyStore's undo/redo with the playback policy the two
// call sites (Toolbar buttons, keyboard shortcuts) both need: undo/
// redo should never rewind currentTime, but it also shouldn't leave
// the playhead sitting past the end of a now-shorter project, and
// playback should stop rather than keep running against timeline
// geometry that just changed out from under it.
//
// Deliberately a plain module, not a hook or a third store: it only
// needs to be CALLED from event handlers, not read reactively, and
// keeping it separate means historyStore.js and editorStore.js never
// need to import each other directly.
import { useHistoryStore } from '../store/historyStore';
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import { getProjectDuration } from './playback';

function settlePlaybackAfterHistoryChange() {
  const editor = useEditorStore.getState();
  if (editor.isPlaying) editor.pause(); // preserves currentTime; see editorStore.pause()

  const duration = getProjectDuration(useProjectStore.getState().tracks);
  if (editor.currentTime > duration) {
    editor.setCurrentTime(duration);
  }
}

export function performUndo() {
  if (useHistoryStore.getState().past.length === 0) return;
  useHistoryStore.getState().undo();
  settlePlaybackAfterHistoryChange();
}

export function performRedo() {
  if (useHistoryStore.getState().future.length === 0) return;
  useHistoryStore.getState().redo();
  settlePlaybackAfterHistoryChange();
}
