// How many horizontal pixels represent one second on the timeline.
// A fixed constant for now; becomes a store value once zoom controls
// are added.
export const PIXELS_PER_SECOND = 60;

// Images have no intrinsic duration - this is how long a new image
// clip is given on the timeline by default.
export const DEFAULT_IMAGE_DURATION = 5;

// A clip can never be trimmed/moved smaller than this, in seconds -
// prevents dragging a trim handle past its neighbor and collapsing a
// clip to zero or negative duration.
export const MIN_CLIP_DURATION = 0.1;

// Maximum number of undo steps kept in memory at once. History
// snapshots are cheap (see historyStore.js - no media is ever copied),
// but they're not free, so this bounds worst-case growth from a very
// long editing session.
export const MAX_HISTORY = 50;
