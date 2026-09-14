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

  currentTime: 0,
  isPlaying: false,

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (value) => set({ isPlaying: value }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),
}));
