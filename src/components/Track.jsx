import { useProjectStore } from '../store/projectStore';
import Clip from './Clip';

export default function Track({ track }) {
  const assets = useProjectStore((state) => state.assets);

  return (
    <div className={`track track-${track.type}`}>
      <div className="track-label">{track.type}</div>
      <div className="track-body">
        {track.clips.map((clip) => (
          <Clip
            key={clip.id}
            clip={clip}
            asset={assets.find((a) => a.id === clip.assetId)}
          />
        ))}
      </div>
    </div>
  );
}
