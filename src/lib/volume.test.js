import { describe, it, expect } from 'vitest';
import { getClipVolume } from './volume';

describe('getClipVolume', () => {
  it('passes through a valid value', () => {
    expect(getClipVolume({ volume: 0.5 })).toBe(0.5);
  });

  it('defaults to 1 when the field is missing', () => {
    expect(getClipVolume({})).toBe(1);
  });

  it('falls back to the default for a NaN value', () => {
    expect(getClipVolume({ volume: NaN })).toBe(1);
  });

  it('clamps above the max to 1', () => {
    expect(getClipVolume({ volume: 5 })).toBe(1);
  });

  it('clamps below the min to 0', () => {
    expect(getClipVolume({ volume: -2 })).toBe(0);
  });
});
