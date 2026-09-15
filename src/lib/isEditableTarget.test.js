import { describe, it, expect } from 'vitest';
import { isEditableTarget } from './isEditableTarget';

describe('isEditableTarget', () => {
  it('treats INPUT elements as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
  });

  it('treats TEXTAREA elements as editable', () => {
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
  });

  it('treats a contenteditable element as editable', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('treats a plain element as not editable', () => {
    expect(isEditableTarget({ tagName: 'DIV' })).toBe(false);
  });

  it('guards a null target', () => {
    expect(isEditableTarget(null)).toBe(false);
  });
});
