import { create } from 'zustand';

// UI-only state, kept separate from project data on purpose: selecting
// a clip doesn't change the project, so it shouldn't live in the same
// store as assets/tracks. Playback position, zoom level, etc. will join
// this store in later phases once there's a Preview that needs them.
export const useEditorStore = create((set) => ({
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
}));
