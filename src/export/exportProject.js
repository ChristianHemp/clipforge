import { getProjectDuration } from '../lib/playback';
import { EXPORT_WIDTH, EXPORT_HEIGHT, EXPORT_FPS, EXPORT_VIDEO_BITRATE, EXPORT_AUDIO_BITRATE } from './constants';
import { getSupportedExportMimeType, isExportSupported } from './mimeType';
import { loadExportVideoElements, releaseExportVideoElements } from './loadExportVideoElements';
import { loadExportAudioElements, releaseExportAudioElements } from './loadExportAudioElements';
import { createExportAudioGraph } from './exportAudioGraph';
import { createFrameRenderer } from './renderFrame';
import { createAudioSynchronizer } from './syncExportAudio';

// Renders `{tracks, assets}` (a caller-provided SNAPSHOT - see
// useExportProject.js) to a downloadable WebM Blob with mixed audio.
//
// Timing model: real-time, not frame-stepped. canvas.captureStream()
// + MediaRecorder record in actual wall-clock time - the output file's
// duration is however long the recorder was running, not however many
// frames got drawn. So this loop is paced by an isolated
// requestAnimationFrame clock (own to this function, never
// editorStore.currentTime), and each active clip's media element
// genuinely PLAYS rather than being seeked to a new position every
// frame - real decoding already happens in real time, so letting it
// play and only correcting drift (see renderFrame.js / syncExportAudio.js)
// keeps the render loop's pace matched to the timeline's actual
// duration. A naive "await a seek for every single frame" loop would
// very likely run slower than 1/EXPORT_FPS per frame (seeks routinely
// take 50-200ms), which would make the RECORDED file longer than the
// timeline - a duration bug, not just a speed tradeoff. The same
// export clock drives both video frame selection and audio
// synchronization below - there is only ever one authoritative
// `exportTime` per tick.
export async function exportProject({ tracks, assets }, { onProgress, signal } = {}) {
  if (!isExportSupported()) {
    throw new Error('This browser does not support video export (needs canvas.captureStream + MediaRecorder + Web Audio).');
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
  let audioElements = null;
  let canvasStream = null;
  let audioGraph = null;

  try {
    videoElements = await loadExportVideoElements({ tracks, assets });
    audioElements = await loadExportAudioElements({ tracks, assets });
    if (signal?.aborted) return null;

    // A dedicated temporary AudioContext for this export only (never
    // the editor's live one - see exportAudioGraph.js). Every media
    // element that can produce sound - both the video elements (their
    // own embedded audio) and the standalone audio elements - is
    // routed into this SAME graph, so overlapping sources genuinely
    // mix rather than fighting over separate native output paths.
    // Video elements need no per-tick audio handling beyond this: once
    // routed, their audio follows whatever renderFrame.js is already
    // doing to them for visual purposes (seek/play/pause).
    audioGraph = await createExportAudioGraph();
    for (const video of videoElements.values()) {
      audioGraph.routeElement(video);
    }
    for (const audio of audioElements.values()) {
      audioGraph.routeElement(audio);
    }

    canvasStream = canvas.captureStream(EXPORT_FPS);
    // Combine the canvas's video track(s) with the mixed audio
    // destination's track(s) into one stream BEFORE MediaRecorder ever
    // sees it - not two separate recordings muxed together afterward.
    const outputStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioGraph.destination.stream.getAudioTracks(),
    ]);

    // A structural check, not a content check - this can't tell us the
    // track carries real sound, only that one exists at all. Catches a
    // different failure mode (destination/combination wiring broken)
    // than the "present but silent" bug this fixes; kept as a guard
    // against that other failure mode recurring unnoticed.
    if (outputStream.getAudioTracks().length === 0) {
      throw new Error('Export audio track was not created - the exported file would have no sound.');
    }

    const mimeType = getSupportedExportMimeType();
    const recorder = new MediaRecorder(outputStream, {
      mimeType,
      videoBitsPerSecond: EXPORT_VIDEO_BITRATE,
      audioBitsPerSecond: EXPORT_AUDIO_BITRATE,
    });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const recorderStopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (event) => reject(event.error ?? new Error('MediaRecorder failed during export.'));
    });

    const renderFrame = createFrameRenderer();
    const syncAudio = createAudioSynchronizer();
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

          Promise.all([
            renderFrame(ctx, {
              canvasWidth: EXPORT_WIDTH,
              canvasHeight: EXPORT_HEIGHT,
              time: exportTime,
              tracks,
              assets,
              videoElements,
              audioGraph,
            }),
            syncAudio(exportTime, { tracks, assets, audioElements, audioGraph }),
          ])
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
    // must never leave a live captured stream, an open AudioContext, or
    // a decoding media element behind regardless of how it ended.
    if (canvasStream) {
      for (const track of canvasStream.getTracks()) track.stop();
    }
    if (audioGraph) {
      await audioGraph.close();
    }
    if (videoElements) {
      releaseExportVideoElements(videoElements);
    }
    if (audioElements) {
      releaseExportAudioElements(audioElements);
    }
  }
}
