import { useProjectStore } from '../store/projectStore';
import Clip from './Clip';

// Renders only a track's clip area. Track *labels* are rendered
// separately by Timeline, outside the horizontally-scrolling
// time-coordinate region - this keeps every element that represents a
// moment in time (clips, ruler, playhead) sharing exactly the same
// x=0 origin. Mixing a label column into this same row used to shift
// clips ~60px to the right of where the playhead's own coordinate
// system placed x=0, so the two would visibly drift apart by the end
// of a clip.
export default function Track({ track }) {
  const assets = useProjectStore((state) => state.assets);

  return (
    <div className={`track track-${track.type}`}>
      {track.clips.map((clip) => (
        <Clip
          key={clip.id}
          clip={clip}
          asset={assets.find((a) => a.id === clip.assetId)}
        />
      ))}
    </div>
  );
}
