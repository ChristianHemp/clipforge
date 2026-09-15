import { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { exportProject } from './exportProject';
import { isExportSupported } from './mimeType';
import { EXPORT_FILENAME } from './constants';

// Local to this hook, not projectStore/editorStore/historyStore -
// export progress is neither project structure nor editor UI state,
// and it must never create a history entry, so it gets nowhere near
// historyStore either.
export function useExportProject() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'exporting' | 'error'
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const startExport = useCallback(async () => {
    // Snapshot taken ONCE, here, at click time. exportProject() never
    // reads projectStore again after this - it only ever sees this
    // frozen {tracks, assets}, so edits made while export is running
    // (allowed; see the Phase 6 report's "Editor isolation" section)
    // cannot change what gets rendered. This works safely with zero
    // extra guarding because projectStore's mutators never mutate an
    // existing track/clip/asset object in place (the same property
    // that makes historyStore's snapshots safe, Phase 5) - any edit
    // made during export produces entirely new objects, never touching
    // what this snapshot is still holding onto.
    const { tracks, assets } = useProjectStore.getState();

    setStatus('exporting');
    setProgress(0);
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const blob = await exportProject({ tracks, assets }, { onProgress: setProgress, signal: controller.signal });

      if (controller.signal.aborted || !blob) {
        setStatus('idle');
        return;
      }

      downloadBlob(blob, EXPORT_FILENAME);
      setStatus('idle');
    } catch (err) {
      console.error('Export failed:', err);
      setError(err.message || 'Export failed.');
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancelExport = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    status,
    progress,
    error,
    isSupported: isExportSupported(),
    startExport,
    cancelExport,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // This URL belongs to export alone (created fresh here, referenced
  // nowhere else) - revoking it doesn't affect the editor. A short
  // delay rather than revoking immediately is the commonly recommended
  // safeguard against revoking before the browser has actually started
  // reading the blob for the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
