// A SEPARATE, temporary AudioContext for export - never the editor's
// live one (src/audio/audioGraph.js). Export must not depend on
// whatever state the editor's playback audio happens to be in, and
// this context is closed at the end of every export regardless of
// outcome (see exportProject.js's cleanup), unlike the editor's
// context, which lives for the whole app session.
export async function createExportAudioGraph() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('This browser does not support the Web Audio API.');
  }

  const audioContext = new AudioContextClass();

  // A new AudioContext starts 'suspended' unless it's created AND used
  // entirely within a user gesture's synchronous call stack. By the
  // time this runs, exportProject() has already awaited loading the
  // video/audio elements, so we're well past that window - without an
  // explicit resume() here, this context would silently stay suspended:
  // its destination still exposes a normal-looking, "live" audio track
  // (so nothing downstream errors, and a player's volume control isn't
  // greyed out), but no audio samples ever actually flow through it,
  // producing a silent track rather than a missing one. Failing loudly
  // here is deliberate - a silently-video-only export that LOOKS like
  // it has audio would be far more confusing than a clear error.
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  if (audioContext.state !== 'running') {
    throw new Error('Could not start audio for export (AudioContext stayed suspended).');
  }

  const destination = audioContext.createMediaStreamDestination();

  // Same "once per element per context" constraint as the editor graph
  // - see audioGraph.js for why a WeakMap.
  const routedElements = new WeakMap();

  function routeElement(mediaElement) {
    const existing = routedElements.get(mediaElement);
    if (existing) return existing;

    const sourceNode = audioContext.createMediaElementSource(mediaElement);
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1; // corrected to the active clip's real volume every tick - see renderFrame.js / syncExportAudio.js
    sourceNode.connect(gainNode).connect(destination);

    const route = { sourceNode, gainNode };
    routedElements.set(mediaElement, route);
    return route;
  }

  // Phase 9: the SAME video element can be shared across two different
  // clips that reference the same asset (loadExportVideoElements.js
  // keys by assetId, not clip id), and those two clips could have
  // different volumes - so gain can't just be set once here at routing
  // time. This accessor lets the per-tick render/sync code look up the
  // already-routed node and re-apply whichever clip is currently active
  // each frame. Standalone audio elements (keyed by clip id, never
  // shared) don't strictly need this, but use the same accessor for
  // consistency rather than two different gain-setting strategies.
  function getGainNode(mediaElement) {
    return routedElements.get(mediaElement)?.gainNode;
  }

  async function close() {
    try {
      await audioContext.close();
    } catch (error) {
      console.error('Failed to close export AudioContext:', error);
    }
  }

  return { destination, routeElement, getGainNode, close };
}
