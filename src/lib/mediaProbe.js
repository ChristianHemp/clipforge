// Reads duration/dimensions out of a media File before it's ever added
// to the timeline. The browser has no direct "inspect this file" API,
// so the standard trick is: load the file into an off-DOM <video>/<audio>/
// <img> element and wait for the metadata event that fires once the
// browser has parsed the container header (this does NOT download the
// whole file — for video/audio, `preload="metadata"` asks the browser
// to fetch just enough of the file to know its duration and dimensions).

export function detectAssetType(mimeType) {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

function probeVideoOrAudio(file, tagName) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tagName);
    const objectUrl = URL.createObjectURL(file);

    function finish(duration) {
      resolve({
        duration,
        width: el.videoWidth || undefined,
        height: el.videoHeight || undefined,
      });
      URL.revokeObjectURL(objectUrl);
    }

    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) {
        finish(el.duration);
        return;
      }

      // Files produced by MediaRecorder (screen/webcam captures - a
      // very common source for locally-made test clips) often lack a
      // proper duration header, so the browser reports `Infinity`
      // (sometimes NaN) here instead of the real length. Seeking far
      // past the end forces it to scan the file and resolve the true
      // duration, which then arrives via `durationchange`. Skipping
      // this would let a non-finite duration flow into clip.duration/
      // trimEnd, which poisons every derived calculation downstream
      // (project duration, the playback clock's stop condition, seek
      // clamping) - not just a display glitch for this one clip.
      el.addEventListener(
        'durationchange',
        () => finish(Number.isFinite(el.duration) ? el.duration : 0),
        { once: true }
      );
      el.currentTime = 1e101;
    };
    el.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read metadata from "${file.name}"`));
    };
    el.src = objectUrl;
  });
}

function probeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read dimensions from "${file.name}"`));
    };
    img.src = objectUrl;
  });
}

// Returns { duration?, width?, height? } appropriate to the asset type.
// Images have no intrinsic duration - the caller decides a default
// on-screen duration for image clips.
export async function probeMediaMetadata(file, type) {
  if (type === 'video') return probeVideoOrAudio(file, 'video');
  if (type === 'audio') return probeVideoOrAudio(file, 'audio');
  if (type === 'image') return probeImage(file);
  throw new Error(`Unsupported asset type: ${type}`);
}
