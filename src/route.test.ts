import { describe, expect, it } from 'vitest';
import { directionFromHash, hashForDirection } from './route';

describe('direction in the URL hash', () => {
  it('names each direction', () => {
    expect(hashForDirection('forward')).toBe('#number-first');
    expect(hashForDirection('reverse')).toBe('#word-first');
    expect(hashForDirection('clock')).toBe('#clock');
  });

  it('reads the direction back', () => {
    expect(directionFromHash('#number-first')).toBe('forward');
    expect(directionFromHash('#word-first')).toBe('reverse');
    expect(directionFromHash('#clock')).toBe('clock');
  });

  it.each(['', '#', '#unknown', 'word-first', '#WORD-FIRST', '#Clock'])('falls back to digits first for %j', (hash) => {
    expect(directionFromHash(hash)).toBe('forward');
  });
});
