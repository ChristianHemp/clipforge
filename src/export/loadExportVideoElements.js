// Creates one hidden, muted <video> per DISTINCT video asset actually
// referenced by a clip on the timeline (not every uploaded asset).
// Each element reuses the asset's EXISTING blob URL (already live from
// upload or persistence hydration) rather than creating a new one -
// export doesn't own any object URLs of its own, only the temporary
// <video> elements themselves, which is all it needs to clean up
// afterward (see releaseExportVideoElements).
export async function loadExportVideoElements({ tracks, assets }) {
  const neededAssetIds = new Set();
  for (const track of tracks) {
    for (const clip of track.clips) {
      const asset = assets.find((a) => a.id === clip.assetId);
      if (asset?.type === 'video') neededAssetIds.add(asset.id);
    }
  }

  const videoElements = new Map();

  await Promise.all(
    Array.from(neededAssetIds).map(async (assetId) => {
      const asset = assets.find((a) => a.id === assetId);
      const video = document.createElement('video');
      // Deliberately NOT muted. This element's audio is routed into the
      // export Web Audio graph (exportProject.js calls routeElement()
      // on it before anything ever plays), and once
      // createMediaElementSource() is called, its native output is
      // suppressed by spec regardless of `muted` - so `muted` would be
      // redundant at best. At worst, some browsers skip decoding audio
      // entirely for a muted element as an optimization (nothing will
      // ever need those samples for native playback), which would
      // starve the Web Audio tap of real sample data - a real audio
      // track with no actual sound in it. That silent-but-present track
      // is exactly the bug this fixes.
      video.playsInline = true;
      video.preload = 'auto';
      video.src = asset.src;

      await new Promise((resolve, reject) => {
        video.oncanplaythrough = () => resolve();
        video.onerror = () => reject(new Error(`Failed to load "${asset.name}" for export.`));
      });

      videoElements.set(assetId, video);
    })
  );

  return videoElements;
}

// Releases the temporary elements created above. Deliberately does NOT
// touch asset.src / URL.revokeObjectURL - those blob URLs are owned by
// projectStore/persistence and stay valid for the editor regardless of
// whether an export just ran.
export function releaseExportVideoElements(videoElements) {
  for (const video of videoElements.values()) {
    video.pause();
    video.removeAttribute('src');
    video.load(); // releases the element's internal decode/buffer resources
  }
  videoElements.clear();
}
