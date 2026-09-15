import { describe, it, expect } from 'vitest';
import {
  calculateClipMove,
  calculateRightTrim,
  calculateLeftTrim,
  calculateOverlayLeftTrim,
  calculateOverlayRightTrim,
} from './clipEditing';

describe('calculateClipMove', () => {
  it('moves the clip forward by the delta', () => {
    expect(calculateClipMove(10, 5)).toBe(15);
  });

  it('clamps at startTime 0', () => {
    expect(calculateClipMove(2, -10)).toBe(0);
  });
});

describe('calculateRightTrim', () => {
  it('extends trimEnd and re-derives duration within the source bound', () => {
    expect(calculateRightTrim({ trimStart: 1, trimEnd: 5, deltaSeconds: 2, sourceDuration: 10 })).toEqual({
      trimEnd: 7,
      duration: 6,
    });
  });

  it('clamps trimEnd at sourceDuration', () => {
    expect(calculateRightTrim({ trimStart: 1, trimEnd: 5, deltaSeconds: 100, sourceDuration: 10 })).toEqual({
      trimEnd: 10,
      duration: 9,
    });
  });

  it('treats a NaN sourceDuration as unbounded instead of clamping to NaN', () => {
    expect(calculateRightTrim({ trimStart: 1, trimEnd: 5, deltaSeconds: 100, sourceDuration: NaN })).toEqual({
      trimEnd: 105,
      duration: 104,
    });
  });
});

describe('calculateLeftTrim', () => {
  it('clamps the delta at the trimStart 0 boundary, keeping fields consistent', () => {
    expect(calculateLeftTrim({ startTime: 5, duration: 10, trimStart: 2, deltaSeconds: -3 })).toEqual({
      startTime: 3,
      trimStart: 0,
      duration: 12,
    });
  });
});

describe('calculateOverlayLeftTrim', () => {
  it('shrinks from the left while keeping the timeline end point fixed', () => {
    expect(calculateOverlayLeftTrim({ startTime: 5, duration: 4, deltaSeconds: 2 })).toEqual({
      startTime: 7,
      duration: 2,
    });
  });
});

describe('calculateOverlayRightTrim', () => {
  it('grows duration with no upper bound (no source media to cap it)', () => {
    expect(calculateOverlayRightTrim({ duration: 5, deltaSeconds: 10000 })).toEqual({ duration: 10005 });
  });

  it('clamps at MIN_CLIP_DURATION', () => {
    expect(calculateOverlayRightTrim({ duration: 0.15, deltaSeconds: -100 })).toEqual({ duration: 0.1 });
  });
});
