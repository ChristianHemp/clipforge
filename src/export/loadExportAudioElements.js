// Creates one hidden <audio> element PER AUDIO CLIP (not per asset,
// mirroring AudioLayer's keying in Preview.jsx) - the same audio asset
// can legitimately be used by two different clips (e.g. the same sound
// effect twice), each needing an independent playback position.
export async function loadExportAudioElements({ tracks, assets }) {
  const audioClips = [];
  for (const track of tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId);
      if (asset?.type === 'audio') audioClips.push({ clip, asset });
    }
  }

  const audioElements = new Map();

  await Promise.all(
    audioClips.map(async ({ clip, asset }) => {
      const audio = document.createElement('audio');
      // Deliberately NOT muted - see the matching comment in
      // loadExportVideoElements.js. createMediaElementSource() already
      // suppresses this element's native output once routed (which
      // happens before anything ever calls .play() on it, in
      // exportProject.js); muting on top of that risked some browsers
      // skipping audio decoding entirely for a muted element, which
      // would produce a real but silent track in the export - the exact
      // bug this fixes.
      audio.preload = 'auto';
      audio.src = asset.src;

      await new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject(new Error(`Failed to load "${asset.name}" for export.`));
      });

      audioElements.set(clip.id, audio);
    })
  );

  return audioElements;
}

export function releaseExportAudioElements(audioElements) {
  for (const audio of audioElements.values()) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  audioElements.clear();
}
