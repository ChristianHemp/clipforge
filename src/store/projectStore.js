import { create } from 'zustand';
import { generateId } from '../lib/id';

// The whole editable project. Deliberately NOT wrapped in a versioned
// "ProjectSpec" envelope (no `metadata`/`canvas` block) yet - nothing
// in this app reads canvas dimensions or fps until Preview/Export need
// them, so that structure isn't added until a real use for it shows up.
//
// Shape:
//   asset = { id, name, type: 'video'|'audio'|'image', src, duration, width?, height? }
//   track = { id, type: 'video'|'audio', clips: [] }
//   clip  = { id, assetId, startTime, duration, trimStart, trimEnd }
//
// Every mutator below changes only the part of the tree it's responsible
// for (one asset, one track, one clip) and rebuilds the surrounding
// arrays/objects immutably. There is intentionally no "replace the whole
// project" action - that full-overwrite pattern is what an AI-generation
// step would need, and this app has no AI generation step.
export const useProjectStore = create((set, get) => ({
  assets: [],
  tracks: [],

  addAsset: (asset) => {
    set((state) => ({ assets: [...state.assets, asset] }));
  },

  removeAsset: (assetId) => {
    set((state) => {
      const asset = state.assets.find((a) => a.id === assetId);
      if (asset?.src) URL.revokeObjectURL(asset.src);
      return { assets: state.assets.filter((a) => a.id !== assetId) };
    });
  },

  // Finds the first track of the given type, or creates one.
  // Returns the track id either way, so callers can immediately use it
  // in addClip() without a second render/read cycle.
  getOrCreateTrack: (type) => {
    const existing = get().tracks.find((track) => track.type === type);
    if (existing) return existing.id;

    const track = { id: generateId(), type, clips: [] };
    set((state) => ({ tracks: [...state.tracks, track] }));
    return track.id;
  },

  addClip: (trackId, clip) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, clip] }
          : track
      ),
    }));
  },

  removeClip: (clipId) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      })),
    }));
  },

  // Not used by any UI yet in Phase 1, but included now because
  // moveClip/trimClip in Phase 2 are really just updateClip calls with
  // different fields - this is the one general-purpose clip mutator.
  updateClip: (clipId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId ? { ...clip, ...updates } : clip
        ),
      })),
    }));
  },
}));

// Finds a clip and the track it lives on together, since clips aren't
// stored with a back-reference to their track (mirrors how the
// reference app nests clips inside tracks rather than flattening them).
export function findClip(tracks, clipId) {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { clip, track };
  }
  return { clip: null, track: null };
}
