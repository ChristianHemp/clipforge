// Pure geometry/formatting helpers shared by Preview's CSS-based text
// rendering (TextOverlayLayer.jsx) and export's Canvas-based text
// rendering (export/renderTextOverlays.js), so the two never implement
// inconsistent positioning or font rules independently.

// Converts a normalized (0-1) position into pixel coordinates within a
// `width`x`height` box. Export needs this explicitly (Canvas has no
// percentage-based positioning); Preview achieves the equivalent
// effect natively via CSS percentages (`left: ${x * 100}%`) and so
// doesn't call this directly, but the underlying mapping - a fraction
// of a fixed composition size - is the same concept in both places.
export function normalizedToPixels(x, y, width, height) {
  return { x: x * width, y: y * height };
}

// Builds a Canvas/CSS-compatible font shorthand string. ctx.font and
// the CSS `font` shorthand accept the same "weight size family"
// syntax, so one function serves both call sites.
export function buildFontString(overlay, fontSizePixels) {
  return `${overlay.fontWeight ?? DEFAULT_OVERLAY_STYLE.fontWeight} ${fontSizePixels}px ${overlay.fontFamily ?? DEFAULT_OVERLAY_STYLE.fontFamily}`;
}

// Single source of truth for style defaults, used both when a new
// overlay is created (Toolbar's "Add Text") and when reading an
// overlay that predates a field being added (backward compatibility -
// see projectPersistence.js's existing "old saved projects must still
// load" guarantee, extended here to old *overlays* within a project).
export const DEFAULT_OVERLAY_STYLE = {
  fontSize: 48,
  color: '#ffffff',
  fontFamily: 'sans-serif',
  fontWeight: 'normal',
  textAlign: 'center',
};
