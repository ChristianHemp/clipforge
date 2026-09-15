import { create } from 'zustand';
import { useProjectStore } from './projectStore';
import { MAX_HISTORY } from '../lib/constants';

// Snapshot-based undo/redo over project STRUCTURE only ({assets,
// tracks}) - never editor/playback state (see editorStore.js, which
// this store never imports). A dedicated store rather than folding
// this into projectStore, so neither store has to know about the
// other's concerns; the two-way link is just the one `hydrate()` call
// inside undo/redo below, restoring exactly the shape
// useProjectPersistence.js already produces on startup.
//
// Snapshots are held by REFERENCE, not cloned. Every projectStore
// mutator already builds new arrays/objects immutably and never
// mutates an existing one in place, so a past `{assets, tracks}`
// reference can never be changed out from under us by a later edit -
// there is nothing to copy defensively. This is also why history
// doesn't duplicate media: an asset's `blob`/`src` fields are just
// object references, carried through unchanged from snapshot to
// snapshot, never re-read or re-copied.
function currentSnapshot() {
  const { assets, tracks } = useProjectStore.getState();
  return { assets, tracks };
}

function pushWithLimit(stack, entry) {
  const next = [...stack, entry];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useHistoryStore = create((set, get) => ({
  past: [], // oldest first; past[past.length - 1] is the most recent undo target
  future: [], // most recent redo target first
  pendingSnapshot: null, // captured at beginTransaction(), not yet committed

  // For a DISCRETE edit (add clip, delete clip, upload asset): call
  // this immediately before the mutation, in the same synchronous
  // handler. Captures "what the project looked like right before this
  // edit" and clears future - any new edit invalidates the old redo path.
  checkpoint: () => {
    set((state) => ({
      past: pushWithLimit(state.past, currentSnapshot()),
      future: [],
    }));
  },

  // For a CONTINUOUS edit (drag-to-move, drag-to-trim): call at
  // pointerdown, before the gesture's first projectStore mutation.
  beginTransaction: () => {
    set({ pendingSnapshot: currentSnapshot() });
  },

  // Call at pointerup, but only if the gesture actually changed
  // something (see pointerDrag.js's `moved` flag) - pushes the ONE
  // snapshot captured at beginTransaction, regardless of how many
  // intermediate updateClip calls happened during the drag.
  commitTransaction: () => {
    set((state) => {
      if (!state.pendingSnapshot) return {};
      return {
        past: pushWithLimit(state.past, state.pendingSnapshot),
        future: [],
        pendingSnapshot: null,
      };
    });
  },

  // Call instead of commitTransaction() when a gesture turned out to
  // be just a click (no movement) - discards the pending snapshot
  // without creating a history entry.
  cancelTransaction: () => {
    set({ pendingSnapshot: null });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const currentState = currentSnapshot();
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [currentState, ...state.future],
    }));
    useProjectStore.getState().hydrate(previous);
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0];
    const currentState = currentSnapshot();
    set((state) => ({
      past: pushWithLimit(state.past, currentState),
      future: state.future.slice(1),
    }));
    useProjectStore.getState().hydrate(next);
  },

  // Used by "Clear Project" - a true reset is a history BOUNDARY, not
  // an undoable edit, so this wipes the stacks entirely rather than
  // checkpointing. Without this, Undo could resurrect a project the
  // user explicitly asked to destroy.
  clearHistory: () => set({ past: [], future: [], pendingSnapshot: null }),
}));
