import { useEffect, useRef } from 'react';
import { syncMediaElement } from '../lib/mediaSync';
import { useMediaElementAudioRouting } from '../audio/useMediaElementAudioRouting';

// Tighter than VideoLayer's 0.3s - audio drift is more perceptible to
// the ear than a slightly-off video frame is to the eye.
const DRIFT_TOLERANCE_SECONDS = 0.15;

// One of these renders per currently-active standalone audio clip (see
// Preview.jsx, which maps over getActiveClips(..., 'audio') and keys
// each instance by clip.id - not asset.id, since two different clips
// can reference the same audio asset and need independent playback
// positions). No visual output; this exists purely to own one <audio>
// element's sync/routing lifecycle.
export default function AudioLayer({ asset, clip, currentTime, isPlaying }) {
  const audioRef = useRef(null);
  const gainNodeRef = useMediaElementAudioRouting(audioRef);

  useEffect(() => {
    syncMediaElement(audioRef.current, clip, currentTime, isPlaying, DRIFT_TOLERANCE_SECONDS, gainNodeRef.current);
  }, [clip, currentTime, isPlaying]);

  // Deterministically silence this element the instant it's no longer
  // active (component unmount - the clip's active window ended), rather
  // than relying on garbage-collection timing to eventually stop it.
  // `audio` is captured at mount time, before it could be cleared.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  return <audio ref={audioRef} src={asset.src} />;
}
