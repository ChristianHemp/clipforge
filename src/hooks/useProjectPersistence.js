import { useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import { loadProject, saveProject } from '../lib/projectPersistence';

// Long enough to coalesce an entire drag/trim gesture's rapid
// pointermove-driven updates (Phase 3) into a single write once the
// user stops moving, short enough that a refresh shortly after
// finishing an edit doesn't lose meaningful work.
const SAVE_DEBOUNCE_MS = 800;

// Owns both directions of persistence. Mounted once in App.jsx,
// alongside usePlaybackClock - same pattern: a hook with no visual
// output that manages a cross-cutting concern imperatively rather than
// through render output.
export function useProjectPersistence() {
  const hydrate = useProjectStore((state) => state.hydrate);
  const isHydrated = useEditorStore((state) => state.isHydrated);
  const setHydrated = useEditorStore((state) => state.setHydrated);
  const setPersistenceError = useEditorStore((state) => state.setPersistenceError);

  // 1. Hydrate once on mount, before anything is allowed to save.
  useEffect(() => {
    let cancelled = false;

    loadProject()
      .then((restored) => {
        if (cancelled) return;
        if (restored) hydrate(restored);
      })
      .catch((error) => {
        console.error('Failed to load saved project:', error);
        if (!cancelled) setPersistenceError('Could not load your saved project - starting fresh.');
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally runs only once (on mount) - hydrate/setHydrated/
    // setPersistenceError are stable Zustand action references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Debounced autosave, gated on hydration having finished. Without
  // that gate, this effect would fire the instant the component
  // mounts (tracks/assets still at their default empty arrays) and
  // write an empty project over a real saved one before loadProject()
  // above has had a chance to restore it - the exact feedback loop the
  // Phase 4 brief calls out to avoid.
  //
  // Phase 4 also had this effect delete an asset's stored blob
  // whenever that asset's id disappeared from projectStore, to keep
  // removeAsset() (not wired to any UI, but callable) from leaving an
  // orphan behind. Phase 5's undo removed that: Undo can make an asset
  // disappear from the live store TEMPORARILY (restoring a pre-upload
  // snapshot) with Redo able to bring it right back - "disappeared
  // from the store" no longer means "the user is done with this
  // asset". Deleting its blob on that signal would silently break Redo
  // (the in-memory asset would still work, but reloading the page
  // after Redo would find its blob missing from IndexedDB). Real
  // per-asset deletion doesn't have a UI yet anyway; when it does, it
  // should call deleteAssetBlob from that action's own discrete
  // handler (alongside its history checkpoint), not be inferred here
  // from a diff against the previous render.
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    if (!isHydrated) return;

    const unsubscribe = useProjectStore.subscribe((state) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        saveProject(state)
          .then(() => setPersistenceError(null))
          .catch((error) => {
            console.error('Failed to save project:', error);
            setPersistenceError('Could not save your changes locally.');
          });
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isHydrated, setPersistenceError]);
}
