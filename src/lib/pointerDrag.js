// Wires up a single pointer-drag gesture starting from a `pointerdown`
// event, using Pointer Capture so the element that started the drag
// keeps receiving pointermove/pointerup even once the cursor moves
// outside its bounds. This is what lets the drag logic live entirely
// on one element instead of attaching (and remembering to remove)
// listeners on `document`.
//
// `onMove(deltaPixels)` fires on every pointermove with the total
// horizontal distance moved since pointerdown - callers convert that
// to seconds themselves using PIXELS_PER_SECOND, so this module has no
// timeline-specific knowledge at all. `onEnd()` fires once, whether
// the gesture finished normally (pointerup) or was interrupted
// (pointercancel - e.g. the browser takes over for a system gesture).
export function beginPointerDrag(event, { onMove, onEnd }) {
  const element = event.currentTarget;
  const startClientX = event.clientX;
  element.setPointerCapture(event.pointerId);

  function handleMove(moveEvent) {
    onMove(moveEvent.clientX - startClientX);
  }

  function stopDragging() {
    element.releasePointerCapture(event.pointerId);
    element.removeEventListener('pointermove', handleMove);
    element.removeEventListener('pointerup', stopDragging);
    element.removeEventListener('pointercancel', stopDragging);
    onEnd?.();
  }

  element.addEventListener('pointermove', handleMove);
  element.addEventListener('pointerup', stopDragging);
  element.addEventListener('pointercancel', stopDragging);
}
