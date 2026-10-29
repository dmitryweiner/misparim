import { describe, expect, it } from 'vitest';
import golden from './fixtures/words.golden.json';
import { accepts, normalize, words, type Gender } from './numbers';

// Generated from the original numbers.js before the TypeScript migration.
const goldenLists: Record<string, string[]> = golden;
const variants: [key: string, gender: Gender, vocalized: boolean][] = [
  ['f', 'f', false],
  ['m', 'm', false],
  ['fv', 'f', true],
  ['mv', 'm', true],
];

describe('words', () => {
  it.each(variants)('matches the original implementation for every number (%s)', (key, gender, vocalized) => {
    const actual = Array.from({ length: 999 }, (_, i) => words(i + 1, gender, vocalized));
    expect(actual).toEqual(goldenLists[key]);
  });

  it.each([
    [1, 'אחת', 'אחד'],
    [2, 'שתיים', 'שניים'],
    [10, 'עשר', 'עשרה'],
    [11, 'אחת עשרה', 'אחד עשר'],
    [12, 'שתים עשרה', 'שנים עשר'],
    [20, 'עשרים', 'עשרים'],
    [21, 'עשרים ואחת', 'עשרים ואחד'],
    [100, 'מאה', 'מאה'],
    [101, 'מאה ואחת', 'מאה ואחד'],
    [120, 'מאה ועשרים', 'מאה ועשרים'],
    [121, 'מאה עשרים ואחת', 'מאה עשרים ואחד'],
    [200, 'מאתיים', 'מאתיים'],
    [345, 'שלוש מאות ארבעים וחמש', 'שלוש מאות ארבעים וחמישה'],
    [999, 'תשע מאות תשעים ותשע', 'תשע מאות תשעים ותשעה'],
  ])('spells %i', (n, f, m) => {
    expect(words(n, 'f')).toBe(f);
    expect(words(n, 'm')).toBe(m);
  });

  it('vocalizes the conjunction before a shva', () => {
    expect(words(23, 'f', true)).toBe('עֶשְׂרִים וְשָׁלוֹשׁ');
    expect(words(23, 'm', true)).toBe('עֶשְׂרִים וּשְׁלוֹשָׁה');
  });

  it.each([0, 1000, 1.5, NaN])('rejects %s', (n) => {
    expect(() => words(n)).toThrow();
  });

  it('rejects an unknown gender', () => {
    expect(() => words(1, 'x' as Gender)).toThrow();
  });
});

describe('normalize', () => {
  it('removes niqqud, direction marks, hyphens and extra spaces', () => {
    expect(normalize('  ‏עֶשְׂרִים־וְאַחַת  ')).toBe('עשרים ואחת');
  });

  it('unifies spelling variants, also after ו', () => {
    expect(normalize('שלשים ושלש')).toBe('שלושים ושלוש');
    expect(normalize('מאתים')).toBe('מאתיים');
  });
});

describe('accepts', () => {
  it.each(variants)('accepts every golden spelling (%s)', (key, gender) => {
    const list = goldenLists[key] ?? [];
    list.forEach((form, i) => expect(accepts(i + 1, gender, form)).toBe(true));
  });

  it('accepts short spellings', () => {
    expect(accepts(12, 'f', 'שתיים עשרה')).toBe(true);
    expect(accepts(35, 'm', 'שלשים וחמשה')).toBe(true);
  });

  it('accepts ו before the tens in compound hundreds', () => {
    expect(accepts(121, 'f', 'מאה ועשרים ואחת')).toBe(true);
    expect(accepts(120, 'f', 'מאה ועשרים')).toBe(true);
  });

  it('rejects the wrong gender and wrong numbers', () => {
    expect(accepts(3, 'f', 'שלושה')).toBe(false);
    expect(accepts(3, 'm', 'שלוש')).toBe(false);
    expect(accepts(21, 'f', 'עשרים אחת')).toBe(false);
    expect(accepts(4, 'f', 'שלוש')).toBe(false);
  });
});
