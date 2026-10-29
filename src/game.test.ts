import { describe, expect, it } from 'vitest';
import { bounds, CHOICE_COUNT, choicesFor, createDeck, isLevel, ROUND_LENGTH, seededRandom, shuffle, type Level } from './game';

const levels: Level[] = ['1', '2', '3'];

describe('seededRandom', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('returns a permutation without changing the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = shuffle(input, seededRandom(3));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.toSorted((a, b) => a - b)).toEqual(input);
  });
});

describe('bounds', () => {
  it('maps levels to ranges', () => {
    expect(bounds('1')).toEqual([1, 10]);
    expect(bounds('2')).toEqual([10, 100]);
    expect(bounds('3')).toEqual([100, 999]);
  });

  it('recognizes levels', () => {
    expect(levels.every(isLevel)).toBe(true);
    expect(isLevel('4')).toBe(false);
    expect(isLevel(1)).toBe(false);
  });
});

describe('choicesFor', () => {
  it.each(levels)('gives distinct in-range choices including the answer (level %s)', (level) => {
    const rng = seededRandom(7);
    const [lo, hi] = bounds(level);
    for (let n = lo; n <= hi; n++) {
      const choices = choicesFor(n, level, rng);
      expect(choices).toHaveLength(CHOICE_COUNT);
      expect(new Set(choices).size).toBe(CHOICE_COUNT);
      expect(choices).toContain(n);
      for (const c of choices) {
        expect(c).toBeGreaterThanOrEqual(lo);
        expect(c).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('prefers look-alike numbers', () => {
    const choices = choicesFor(345, '3', seededRandom(1));
    const similar = new Set([344, 346, 335, 355, 245, 445, 84]);
    expect(choices.filter((c) => similar.has(c))).toHaveLength(CHOICE_COUNT - 1);
  });
});

describe('createDeck', () => {
  it.each(levels)('has ten distinct questions from the range (level %s)', (level) => {
    const deck = createDeck(level, seededRandom(11));
    const [lo, hi] = bounds(level);
    expect(deck).toHaveLength(ROUND_LENGTH);
    expect(new Set(deck.map((q) => q.n)).size).toBe(ROUND_LENGTH);
    for (const q of deck) {
      expect(q.n).toBeGreaterThanOrEqual(lo);
      expect(q.n).toBeLessThanOrEqual(hi);
      expect(q).toMatchObject({ hint: false, correct: false, draft: '' });
      expect(q.choices).toContain(q.n);
    }
  });
});
