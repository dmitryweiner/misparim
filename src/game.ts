export type Random = () => number;
export type Level = '1' | '2' | '3';
export type Direction = 'forward' | 'reverse';
export type Method = 'choice' | 'input';

export const ROUND_LENGTH = 10;
export const CHOICE_COUNT = 4;

export interface Question {
  n: number;
  choices: number[];
  hint: boolean;
  correct: boolean;
  draft: string;
}

/** Small deterministic PRNG (mulberry32) for tests. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

export function bounds(level: Level): [number, number] {
  return level === '1' ? [1, 10] : level === '2' ? [10, 100] : [100, 999];
}

export function isLevel(value: unknown): value is Level {
  return value === '1' || value === '2' || value === '3';
}

/** Answer choices for n: the number itself plus look-alike numbers from the same range. */
export function choicesFor(n: number, level: Level, rng: Random): number[] {
  const [lo, hi] = bounds(level);
  // Neighbours, numbers off by ten or a hundred and, for two-digit numbers, swapped digits are easy to confuse.
  const similar = shuffle([n - 1, n + 1, n - 10, n + 10, n - 100, n + 100, (n % 10) * 10 + Math.floor(n / 10)], rng).filter(
    (x) => x >= lo && x <= hi && x !== n,
  );
  const set = new Set([n]);
  for (const x of similar) if (set.size < CHOICE_COUNT) set.add(x);
  while (set.size < CHOICE_COUNT) set.add(lo + Math.floor(rng() * (hi - lo + 1)));
  return shuffle([...set], rng);
}

/** Ten distinct numbers from the level's range with their answer choices. */
export function createDeck(level: Level, rng: Random): Question[] {
  const [lo, hi] = bounds(level);
  const numbers = shuffle(
    Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
    rng,
  ).slice(0, ROUND_LENGTH);
  return numbers.map((n) => ({ n, choices: choicesFor(n, level, rng), hint: false, correct: false, draft: '' }));
}
