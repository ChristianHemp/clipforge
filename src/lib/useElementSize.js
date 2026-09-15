import { useEffect, useState } from 'react';

// Tracks an element's rendered pixel size via ResizeObserver. Used by
// Preview to know the composition-frame's actual on-screen size, which
// text overlay font sizing scales against (see textGeometry.js /
// Preview's font-scale comment) - CSS percentage positioning doesn't
// need this (the browser already does that math), but font-size
// scaling does, since CSS has no "percent of container" unit for
// font-size the way it does for position.
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}
