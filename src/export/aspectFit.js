// Computes the destination rectangle to draw a `sourceWidth`x
// `sourceHeight` video into a `targetWidth`x`targetHeight` box while
// preserving its aspect ratio - the box is filled as much as possible
// without cropping or stretching, leaving letterbox (top/bottom) or
// pillarbox (left/right) bars on whichever axis doesn't fill exactly.
export function computeAspectFitRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (!sourceWidth || !sourceHeight) {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  }

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}
