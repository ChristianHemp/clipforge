import { describe, it, expect } from 'vitest';
import {
  getProjectDuration,
  getActiveClip,
  getActiveClips,
  getActiveTextOverlays,
  getClipSourceTime,
  formatTime,
} from './playback';

describe('getProjectDuration', () => {
  it('returns 0 for an empty project', () => {
    expect(getProjectDuration([])).toBe(0);
  });

  it('takes the max end time across overlapping clips', () => {
    const tracks = [{ clips: [{ startTime: 0, duration: 5 }, { startTime: 3, duration: 4 }] }];
    expect(getProjectDuration(tracks)).toBe(7);
  });

  it('skips a clip with an Infinity end instead of propagating it', () => {
    const tracks = [{ clips: [{ startTime: 0, duration: Infinity }, { startTime: 2, duration: 3 }] }];
    expect(getProjectDuration(tracks)).toBe(5);
  });

  it('skips a clip with a NaN end', () => {
    const tracks = [{ clips: [{ startTime: 0, duration: NaN }] }];
    expect(getProjectDuration(tracks)).toBe(0);
  });
});

describe('getActiveClip', () => {
  const videoAsset = { id: 'a1', type: 'video' };
  const audioAsset = { id: 'a2', type: 'audio' };
  const tracks = [
    { clips: [{ id: 'c1', assetId: 'a1', startTime: 0, duration: 5 }] },
    { clips: [{ id: 'c2', assetId: 'a2', startTime: 2, duration: 6 }] },
  ];

  it('matches the first clip of the requested asset type at a given time', () => {
    expect(getActiveClip(tracks, [videoAsset, audioAsset], 1, 'video')?.id).toBe('c1');
  });

  it('returns null when no clip is active at that time', () => {
    expect(getActiveClip(tracks, [videoAsset, audioAsset], 10, 'video')).toBeNull();
  });
});

describe('getActiveClips', () => {
  it('returns every overlapping clip regardless of asset type', () => {
    const videoAsset = { id: 'a1', type: 'video' };
    const audioAsset = { id: 'a2', type: 'audio' };
    const tracks = [
      { clips: [{ id: 'c1', assetId: 'a1', startTime: 0, duration: 5 }] },
      { clips: [{ id: 'c2', assetId: 'a2', startTime: 2, duration: 6 }] },
    ];
    expect(getActiveClips(tracks, [videoAsset, audioAsset], 3).map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('getActiveTextOverlays', () => {
  it('only returns clips of type "text"', () => {
    const tracks = [
      {
        clips: [
          { id: 't1', type: 'text', startTime: 0, duration: 4 },
          { id: 'c1', startTime: 0, duration: 4 },
        ],
      },
    ];
    expect(getActiveTextOverlays(tracks, 1).map((c) => c.id)).toEqual(['t1']);
  });
});

describe('getClipSourceTime', () => {
  it('maps timeline time to source time using trimStart', () => {
    expect(getClipSourceTime({ startTime: 8, trimStart: 2 }, 11)).toBe(5);
  });
});

describe('formatTime', () => {
  it('formats minutes, seconds, and tenths', () => {
    expect(formatTime(65.5)).toBe('01:05.5');
  });

  it('guards non-finite input to zero', () => {
    expect(formatTime(NaN)).toBe('00:00.0');
  });

  it('guards negative input to zero', () => {
    expect(formatTime(-5)).toBe('00:00.0');
  });
});
