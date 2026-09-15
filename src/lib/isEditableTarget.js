// True if the given event target is something the browser's own text
// editing - including its native undo/redo, Delete, and Backspace -
// should handle: an <input>, <textarea>, or any contenteditable
// element. Global keyboard shortcuts that would otherwise hijack these
// keys (Cmd/Ctrl+Z, Delete/Backspace) should bail out early when this
// returns true, so typing in a field never fights the editor's own
// shortcuts.
export function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true;
}
