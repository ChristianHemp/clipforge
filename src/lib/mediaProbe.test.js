import { describe, it, expect } from 'vitest';
import { detectAssetType } from './mediaProbe';

describe('detectAssetType', () => {
  it('detects video/* mime types', () => {
    expect(detectAssetType('video/mp4')).toBe('video');
  });

  it('detects audio/* mime types', () => {
    expect(detectAssetType('audio/mpeg')).toBe('audio');
  });

  it('detects image/* mime types', () => {
    expect(detectAssetType('image/png')).toBe('image');
  });

  it('returns null for an unsupported mime type', () => {
    expect(detectAssetType('application/pdf')).toBeNull();
  });
});
