import { getProjectDuration } from '../lib/playback';
import { EXPORT_WIDTH, EXPORT_HEIGHT, EXPORT_FPS, EXPORT_VIDEO_BITRATE } from './constants';
import { getSupportedExportMimeType, isExportSupported } from './mimeType';
import { loadExportVideoElements, releaseExportVideoElements } from './loadExportVideoElements';
import { createFrameRenderer } from './renderFrame';

// Renders `{tracks, assets}` (a caller-provided SNAPSHOT - see
// useExportProject.js) to a downloadable WebM Blob.
//
// Timing model: real-time, not frame-stepped. canvas.captureStream()
// + MediaRecorder record in actual wall-clock time - the output file's
// duration is however long the recorder was running, not however many
// frames got drawn. So this loop is paced by an isolated
// requestAnimationFrame clock (own to this function, never
// editorStore.currentTime), and each active clip's <video> element
// genuinely PLAYS rather than being seeked to a new position every
// frame - real video decoding already happens in real time, so letting
// it play and only correcting drift (see renderFrame.js) keeps the
// render loop's pace matched to the timeline's actual duration. A
// naive "await a seek for every single frame" loop would very likely
// run slower than 1/EXPORT_FPS per frame (seeks routinely take
// 50-200ms), which would make the RECORDED file longer than the
// timeline - a duration bug, not just a speed tradeoff.
export async function exportProject({ tracks, assets }, { onProgress, signal } = {}) {
  if (!isExportSupported()) {
    throw new Error('This browser does not support video export (needs canvas.captureStream + MediaRecorder).');
  }

  const duration = getProjectDuration(tracks);
  if (duration <= 0) {
    throw new Error('Nothing to export - add a clip to the timeline first.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: false });

  let videoElements = null;
  let stream = null;

  try {
    videoElements = await loadExportVideoElements({ tracks, assets });
    if (signal?.aborted) return null;

    stream = canvas.captureStream(EXPORT_FPS);
    const mimeType = getSupportedExportMimeType();
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: EXPORT_VIDEO_BITRATE });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const recorderStopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (event) => reject(event.error ?? new Error('MediaRecorder failed during export.'));
    });

    const renderFrame = createFrameRenderer();
    let cancelled = signal?.aborted ?? false;
    function handleAbort() {
      cancelled = true;
    }
    signal?.addEventListener('abort', handleAbort);

    try {
      recorder.start();
      const startTime = performance.now();

      await new Promise((resolveLoop, rejectLoop) => {
        function tick() {
          if (cancelled) {
            resolveLoop();
            return;
          }

          const exportTime = Math.min((performance.now() - startTime) / 1000, duration);

          renderFrame(ctx, {
            canvasWidth: EXPORT_WIDTH,
            canvasHeight: EXPORT_HEIGHT,
            time: exportTime,
            tracks,
            assets,
            videoElements,
          })
            .then(() => {
              onProgress?.(exportTime / duration);
              if (exportTime >= duration) {
                resolveLoop();
              } else {
                requestAnimationFrame(tick);
              }
            })
            .catch(rejectLoop);
        }
        requestAnimationFrame(tick);
      });

      if (recorder.state !== 'inactive') recorder.stop();
      await recorderStopped;
    } finally {
      signal?.removeEventListener('abort', handleAbort);
    }

    if (cancelled) return null;

    onProgress?.(1);
    return new Blob(chunks, { type: mimeType });
  } finally {
    // Runs on success, on error, and on cancellation alike - export
    // must never leave a live captured stream or a decoding <video>
    // element behind regardless of how it ended.
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoElements) {
      releaseExportVideoElements(videoElements);
    }
  }
}
