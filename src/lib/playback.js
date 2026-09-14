// Pure timeline math. Kept separate from React components and from the
// Zustand stores so this logic is easy to read and reason about on its
// own, without any rendering or state-management code mixed in.

// The project's total length is derived from its clips rather than
// stored as its own piece of state, so it's always correct after any
// add/remove/trim - there is nothing to keep in sync by hand.
export function getProjectDuration(tracks) {
  let duration = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipEnd = clip.startTime + clip.duration;
      // Math.max propagates NaN/Infinity through the entire reduction
      // if let through unguarded - one clip with a bad (non-finite)
      // duration would otherwise make the WHOLE project's derived
      // duration non-finite, breaking the playback clock's stop
      // condition and every seek clamp that depends on it. Skipping a
      // bad clip here is a safety net; the real fix is not producing
      // one in the first place (see mediaProbe.js).
      if (Number.isFinite(clipEnd)) {
        duration = Math.max(duration, clipEnd);
      }
    }
  }
  return duration;
}

// Finds whichever clip of `assetType` ('video' | 'image' | 'audio')
// is playing at `time`.
//
// Policy: the FIRST matching clip found, scanning tracks in array
// order and then clips within a track in array order. If two clips of
// the same asset type ever overlap (not possible yet through the UI,
// since "Add to Timeline" always appends after the last clip on a
// track - but will become possible once drag-to-move exists), the one
// that appears earlier in the tracks/clips arrays wins. There is no
// compositing/layering engine here; at most one clip is ever "active"
// for a given asset type.
//
// `assetType` is checked against the referenced ASSET, not the track,
// because a single video-type track can hold both video and image
// clips (images are visual content too) - the track's own `type` only
// distinguishes "visual" tracks from "audio" tracks.
export function getActiveClip(tracks, assets, time, assetType) {
  for (const track of tracks) {
    for (const clip of track.clips) {
      const isActive = time >= clip.startTime && time < clip.startTime + clip.duration;
      if (!isActive) continue;

      if (assetType) {
        const asset = assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.type !== assetType) continue;
      }
      return clip;
    }
  }
  return null;
}

// Maps a moment on the global timeline to a moment within the clip's
// own source media. E.g. if a clip starts at t=8 on the timeline but
// its source video is trimmed to start 2s in, then timeline time 11
// corresponds to source time 5 (3s into the clip, offset by the trim).
export function getClipSourceTime(clip, currentTime) {
  const localTime = currentTime - clip.startTime;
  return (clip.trimStart ?? 0) + localTime;
}

// Formats seconds as "MM:SS.d" - fine-grained enough to see the
// playhead moving without needing frame-accurate timecode math (this
// app has no fps concept yet).
export function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  const tenths = Math.floor((safeSeconds * 10) % 10);
  return `${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${tenths}`;
}
