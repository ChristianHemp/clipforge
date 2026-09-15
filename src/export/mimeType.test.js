import { describe, it, expect } from 'vitest';
import { getSupportedExportMimeType, isExportSupported } from './mimeType';

// Runs in Vitest's default Node environment, which has no MediaRecorder,
// HTMLCanvasElement, or AudioContext globals - the same "unsupported
// environment" branch these functions guard against for real browsers
// that lack export support, so this is genuine behavior, not a mock.
describe('getSupportedExportMimeType', () => {
  it('returns null when no MediaRecorder global is present', () => {
    expect(getSupportedExportMimeType()).toBeNull();
  });
});

describe('isExportSupported', () => {
  it('returns false outside a browser environment', () => {
    expect(isExportSupported()).toBe(false);
  });
});
