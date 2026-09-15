import { describe, it, expect } from 'vitest';
import { computeAspectFitRect } from './aspectFit';

describe('computeAspectFitRect', () => {
  it('fills the target exactly when the aspect ratio already matches', () => {
    expect(computeAspectFitRect(1920, 1080, 1280, 720)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });

  it('pillarboxes a portrait source within a landscape target', () => {
    expect(computeAspectFitRect(1080, 1920, 1280, 720)).toEqual({ x: 437.5, y: 0, width: 405, height: 720 });
  });

  it('falls back to the full target box when source dimensions are 0', () => {
    expect(computeAspectFitRect(0, 0, 1280, 720)).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });
});
