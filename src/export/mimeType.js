// Tried in order. Phase 7 records combined video+audio, so explicit
// ",opus" combinations are tried first - a browser can support
// "video/webm;codecs=vp9" for video-only recording while handling a
// stream that ALSO carries audio differently, so this doesn't assume
// video-only support implies combined support. Falls back to the
// video-only variants for browsers/streams where that still works with
// an implicit default audio codec.
const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function getSupportedExportMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function hasAudioContextSupport() {
  return typeof window !== 'undefined' && (typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function');
}

// Everything export needs from the browser: a canvas that can be
// captured as a live stream, a MediaRecorder able to encode at least
// one candidate WebM variant, and (Phase 7) a Web Audio API for mixing
// audio into that stream. Checked once, up front, so unsupported
// browsers get one clear message instead of a confusing failure
// partway through.
export function isExportSupported() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    hasAudioContextSupport() &&
    getSupportedExportMimeType() !== null
  );
}
