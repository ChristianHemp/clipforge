import { describe, it, expect } from 'vitest';
import { generateId } from './id';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('returns a v4 UUID', () => {
    expect(generateId()).toMatch(UUID_V4_RE);
  });

  it('returns a unique value on successive calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
