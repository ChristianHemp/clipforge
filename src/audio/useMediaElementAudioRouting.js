import { useEffect, useRef } from 'react';
import { routeMediaElementAudio } from './audioGraph';

// Routes a <video>/<audio> element's audio through the shared editor
// Web Audio graph as soon as it mounts, and returns a ref to its
// GainNode so the caller can keep that node's gain in sync with
// clip.volume (see mediaSync.js) without re-running this routing
// effect - createMediaElementSource() can only be called once per
// element, so routing must stay a mount-only effect, while volume can
// change on every render.
//
// Per the Web Audio spec, once an element is connected via
// createMediaElementSource(), its audio no longer plays through the
// browser's normal "native" output path at all - it only reaches
// speakers via wherever the graph is connected. This is what prevents
// a video clip's embedded audio from being heard TWICE (once natively,
// once through the graph): there is no "natively" left once this runs.
export function useMediaElementAudioRouting(mediaRef) {
  const gainNodeRef = useRef(null);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;
    try {
      gainNodeRef.current = routeMediaElementAudio(element);
    } catch (error) {
      // Web Audio unavailable or unsupported - the element still plays
      // natively as a fallback, just without going through the shared
      // graph (meaning it won't get ducked/mixed uniformly with other
      // sources, but it won't be silent either, and gainNodeRef.current
      // simply stays null - mediaSync.js already guards for that).
      console.error('Failed to route media element audio:', error);
    }
    // mediaRef is a stable useRef object identity - this runs once per
    // mount, matching "route once", not on every render.
  }, [mediaRef]);

  return gainNodeRef;
}
