import { getActiveTextOverlays } from '../lib/playback';
import { normalizedToPixels, buildFontString, DEFAULT_OVERLAY_STYLE } from '../lib/textGeometry';

// Draws every text overlay active at `time` on top of whatever video/
// black frame renderFrame.js already drew to `ctx` this tick. Pure and
// synchronous - unlike video, there's no source media to seek or wait
// on, so this needs no async handling and simply runs at the end of
// renderFrame.js's per-frame sequence (after the video layer, so text
// draws on top of it, never under it).
//
// fontSize is defined as export-canvas pixels directly (this IS the
// canvas ctx.font size, no scaling) - Preview is the side that scales,
// against this same EXPORT_WIDTH/EXPORT_HEIGHT (see Preview.jsx's
// previewScale), not the other way around.
export function drawTextOverlays(ctx, { canvasWidth, canvasHeight, time, tracks }) {
  const activeOverlays = getActiveTextOverlays(tracks, time);

  for (const overlay of activeOverlays) {
    const { x, y } = normalizedToPixels(overlay.x, overlay.y, canvasWidth, canvasHeight);
    const fontSize = overlay.fontSize ?? DEFAULT_OVERLAY_STYLE.fontSize;

    // Set explicitly every time, not relied on as leftover state from
    // a previous overlay/frame - different overlays can have different
    // styles within the same frame.
    ctx.font = buildFontString(overlay, fontSize);
    ctx.fillStyle = overlay.color ?? DEFAULT_OVERLAY_STYLE.color;
    ctx.textAlign = overlay.textAlign ?? DEFAULT_OVERLAY_STYLE.textAlign;
    // 'middle' matches Preview's CSS translate(-50%,-50%)-style vertical
    // centering on the anchor point (x,y is the text's center, not its
    // baseline) - see TextOverlayLayer's positioning.
    ctx.textBaseline = 'middle';

    ctx.fillText(overlay.text ?? '', x, y);
  }
}
