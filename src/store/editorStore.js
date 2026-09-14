import { create } from 'zustand';

// UI/editing-only state, kept separate from project data (projectStore)
// on purpose: none of this describes the video being edited, only how
// it's currently being viewed or interacted with.
//
// currentTime/isPlaying were added in Phase 2. The actual clock that
// advances currentTime during playback (a requestAnimationFrame loop)
// lives in hooks/usePlaybackClock.js, not here - this store only holds
// the resulting values plus simple, targeted setters. Note that
// `selectedClipId` (an editing concern) and `currentTime`/`isPlaying`
// (a playback concern) are intentionally independent: selecting a clip
// never changes what's playing, and playback never changes selection.
export const useEditorStore = create((set) => ({
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  // Phase 4: whether startup hydration from IndexedDB has finished.
  // Lives here (not projectStore) because it describes the state of
  // the APP, not the project - "hydration concerns separate from the
  // persistent project model" per the Phase 4 brief. App.jsx renders a
  // brief loading placeholder instead of the editor while this is
  // false, and useProjectPersistence.js refuses to autosave until
  // it's true - otherwise the initial empty store would get written
  // over a real saved project before that project has even loaded.
  isHydrated: false,
  setHydrated: (value) => set({ isHydrated: value }),

  // A single human-readable message for the one thing Phase 4 needs
  // to surface to the user: "something about saving/loading failed".
  // Not a notification queue - just the latest status, shown inline in
  // the Toolbar, cleared on the next successful operation.
  persistenceError: null,
  setPersistenceError: (message) => set({ persistenceError: message }),

  currentTime: 0,
  isPlaying: false,

  // Number.isFinite guards against NaN/Infinity ever reaching
  // currentTime - Math.max(0, time) alone does NOT catch either
  // (Math.max(0, NaN) is NaN; Math.max(0, Infinity) is Infinity), and
  // once currentTime is non-finite, seeking back to a normal position
  // silently fails: usePlaybackClock's drift-detection check
  // (`Math.abs(currentTime - lastWritten) > 0.001`) is also always
  // false for NaN, so the clock ignores the bad value and just keeps
  // extrapolating from wherever it already was.
  setCurrentTime: (time) => set({ currentTime: Number.isFinite(time) ? Math.max(0, time) : 0 }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

  // Used by "Clear Project" - resets everything in THIS store back to
  // its defaults. Deliberately does not touch isHydrated/persistenceError.
  resetTransientState: () => set({ selectedClipId: null, currentTime: 0, isPlaying: false }),
}));
