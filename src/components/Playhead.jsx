import { PIXELS_PER_SECOND } from '../lib/constants';

// currentTime (from editorStore) is the only source of truth for the
// playhead's position - there is no separately-stored "playhead x"
// coordinate to keep in sync.
export default function Playhead({ currentTime }) {
  return <div className="playhead" style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }} />;
}
