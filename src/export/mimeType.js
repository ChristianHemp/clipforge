// Tried in order, most-compressed/modern first. VP9 isn't universally
// available (older browsers, some Linux builds), so this never assumes
// it - MediaRecorder.isTypeSupported is checked before picking anything.
const CANDIDATE_MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function getSupportedExportMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

// Everything Phase 6 export needs from the browser: a canvas that can
// be captured as a live stream, and a MediaRecorder able to encode at
// least one of the candidate WebM variants. Checked once, up front, so
// unsupported browsers get one clear message instead of a confusing
// failure partway through.
export function isExportSupported() {
  return (
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    getSupportedExportMimeType() !== null
  );
}
