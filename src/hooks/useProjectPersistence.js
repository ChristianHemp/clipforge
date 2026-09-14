import { useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEditorStore } from '../store/editorStore';
import { loadProject, saveProject, deleteAssetBlob } from '../lib/projectPersistence';

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
  const debounceTimerRef = useRef(null);
  const knownAssetIdsRef = useRef(null);

  useEffect(() => {
    if (!isHydrated) return;

    // Seed with whatever's in the store right now (the just-hydrated
    // set, or still-empty if there was nothing to restore) so the
    // first real change doesn't get misread as "every asset removed".
    knownAssetIdsRef.current = new Set(useProjectStore.getState().assets.map((a) => a.id));

    const unsubscribe = useProjectStore.subscribe((state) => {
      // Clean up any asset that disappeared since the last change -
      // this is what keeps removeAsset() (not currently wired to any
      // UI, but callable) from leaving an orphaned blob behind, without
      // projectStore.js itself needing to know IndexedDB exists.
      const currentAssetIds = new Set(state.assets.map((a) => a.id));
      for (const id of knownAssetIdsRef.current) {
        if (!currentAssetIds.has(id)) {
          deleteAssetBlob(id).catch((error) =>
            console.error('Failed to delete stored asset blob:', error)
          );
        }
      }
      knownAssetIdsRef.current = currentAssetIds;

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
