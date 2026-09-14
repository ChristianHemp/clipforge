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

    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      resolve({
        duration: el.duration,
        width: el.videoWidth || undefined,
        height: el.videoHeight || undefined,
      });
      URL.revokeObjectURL(objectUrl);
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
