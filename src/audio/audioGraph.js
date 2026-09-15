// One shared AudioContext for the EDITOR only - never the export
// pipeline, which uses its own temporary, per-export context (see
// export/exportAudioGraph.js). Lazily created on first use rather than
// at module load, and never recreated afterward: AudioContext
// construction is a real browser resource, and some browsers cap how
// many a page can have open at once.
let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('This browser does not support the Web Audio API.');
    }
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

// Browsers keep a new AudioContext in the 'suspended' state until a
// user gesture resumes it. Call this from inside a genuine click
// handler (Toolbar's Play button) - calling it from an effect or at
// module load would not satisfy that requirement on most browsers.
export function resumeEditorAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch((error) => console.error('Failed to resume AudioContext:', error));
  }
}

// createMediaElementSource() throws if called twice on the same
// element for the same context, so every route is cached per element.
// A WeakMap, not a plain Map or object, so an element's cache entry is
// naturally forgotten once nothing else references that element
// anymore (e.g. after Preview's VideoLayer/AudioLayer unmounts and
// remounts a fresh element at a clip change) - no manual cleanup call
// is needed for this cache itself.
const routedElements = new WeakMap();

// Connects a <video>/<audio> element into the editor's audio graph
// exactly once, returning its GainNode (fixed at 1.0 - Phase 7 has no
// per-clip volume UI, but this is where a future one would plug in).
// Calling this again for an already-routed element is a safe no-op
// that returns the existing route rather than throwing.
export function routeMediaElementAudio(mediaElement) {
  const ctx = getAudioContext();
  const existing = routedElements.get(mediaElement);
  if (existing) return existing.gainNode;

  const sourceNode = ctx.createMediaElementSource(mediaElement);
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;
  sourceNode.connect(gainNode).connect(ctx.destination);

  routedElements.set(mediaElement, { sourceNode, gainNode });
  return gainNode;
}
