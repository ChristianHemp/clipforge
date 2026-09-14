import { useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { generateId } from '../lib/id';
import { detectAssetType, probeMediaMetadata } from '../lib/mediaProbe';
import { DEFAULT_IMAGE_DURATION } from '../lib/constants';
import MediaItem from './MediaItem';

export default function MediaLibrary() {
  const assets = useProjectStore((state) => state.assets);
  const addAsset = useProjectStore((state) => state.addAsset);
  const getOrCreateTrack = useProjectStore((state) => state.getOrCreateTrack);
  const addClip = useProjectStore((state) => state.addClip);
  const inputRef = useRef(null);

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ''; // reset so selecting the same file again still fires onChange

    for (const file of files) {
      const type = detectAssetType(file.type);
      if (!type) {
        console.warn(`Skipping unsupported file type: ${file.type || file.name}`);
        continue;
      }

      try {
        const metadata = await probeMediaMetadata(file, type);
        addAsset({
          id: generateId(),
          name: file.name,
          type,
          src: URL.createObjectURL(file),
          duration: metadata.duration ?? DEFAULT_IMAGE_DURATION,
          width: metadata.width,
          height: metadata.height,
        });
      } catch (error) {
        console.error('Failed to read media metadata:', error);
      }
    }
  }

  function handleAddToTimeline(asset) {
    const trackType = asset.type === 'audio' ? 'audio' : 'video';
    const trackId = getOrCreateTrack(trackType);

    // Append after the last clip on this track instead of always
    // starting at 0, so multiple clips don't stack on top of each other.
    const track = useProjectStore.getState().tracks.find((t) => t.id === trackId);
    const startTime = track.clips.reduce(
      (end, clip) => Math.max(end, clip.startTime + clip.duration),
      0
    );

    addClip(trackId, {
      id: generateId(),
      assetId: asset.id,
      startTime,
      duration: asset.duration,
      trimStart: 0,
      trimEnd: asset.duration,
    });
  }

  return (
    <section className="panel media-library">
      <div className="panel-header">
        <h2>Media Library</h2>
        <button onClick={() => inputRef.current?.click()}>Upload</button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          hidden
          onChange={handleFilesSelected}
        />
      </div>

      {assets.length === 0 ? (
        <p className="empty-state">No assets yet. Upload a video, audio, or image file.</p>
      ) : (
        <ul className="media-list">
          {assets.map((asset) => (
            <MediaItem key={asset.id} asset={asset} onAddToTimeline={handleAddToTimeline} />
          ))}
        </ul>
      )}
    </section>
  );
}
