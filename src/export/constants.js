// Export-specific configuration, kept separate from lib/constants.js
// (which is about timeline/editing concerns) so the export subsystem
// stays self-contained.

// Fixed output resolution for Phase 6 - no per-project canvas/format
// editing yet. Source video of any aspect ratio is letterboxed/
// pillarboxed to fit inside this box (see aspectFit.js), never stretched.
export const EXPORT_WIDTH = 1280;
export const EXPORT_HEIGHT = 720;

// Fixed export frame rate. canvas.captureStream(EXPORT_FPS) samples
// the canvas automatically at this rate in real time - see
// exportProject.js for why the render loop is paced to real time
// rather than stepping through frames as fast as possible.
export const EXPORT_FPS = 30;

// ~8 Mbps is a reasonable default for 720p30 VP9/VP8 (in the same
// range as YouTube's own recommended 720p30 upload bitrate).
export const EXPORT_VIDEO_BITRATE = 8_000_000;

// 128 kbps is a standard, transparent-enough default for Opus stereo.
// Specified explicitly (not left to MediaRecorder's own default)
// alongside EXPORT_VIDEO_BITRATE so both tracks have deliberate,
// known encoding parameters rather than one specified and one implicit.
export const EXPORT_AUDIO_BITRATE = 128_000;

export const EXPORT_FILENAME = 'video-editor-export.webm';
