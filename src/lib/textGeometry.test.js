import { describe, it, expect } from 'vitest';
import { normalizedToPixels, buildFontString, DEFAULT_OVERLAY_STYLE } from './textGeometry';

describe('normalizedToPixels', () => {
  it('maps a normalized fraction to pixels within the fixed composition size', () => {
    expect(normalizedToPixels(0.5, 0.25, 1280, 720)).toEqual({ x: 640, y: 180 });
  });
});

describe('buildFontString', () => {
  it('falls back to DEFAULT_OVERLAY_STYLE for missing fields', () => {
    expect(buildFontString({}, 48)).toBe('normal 48px sans-serif');
  });

  it('uses overlay fields when present', () => {
    expect(buildFontString({ fontWeight: 'bold', fontFamily: 'Georgia' }, 32)).toBe('bold 32px Georgia');
  });
});

describe('DEFAULT_OVERLAY_STYLE', () => {
  it('defines the expected default font size', () => {
    expect(DEFAULT_OVERLAY_STYLE.fontSize).toBe(48);
  });
});
