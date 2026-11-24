import { describe, expect, it } from 'vitest';
import {
  acceptsTime,
  CLOCK_LEVELS,
  clockChoices,
  clockTimes,
  createClockDeck,
  digitalTime,
  handAngles,
  isClockLevel,
  timeWords,
} from './clock';
import { CHOICE_COUNT, ROUND_LENGTH, seededRandom } from './game';
import { words } from './numbers';

/** Minutes past twelve on a twelve-hour face. */
const at = (h: number, m: number) => (h % 12) * 60 + m;
const everyFiveMinutes = clockTimes('five');

describe('clock levels', () => {
  it('step from whole hours to every five minutes', () => {
    expect(clockTimes('hours')).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660]);
    expect(clockTimes('quarters')).toHaveLength(48);
    expect(clockTimes('quarters').every((t) => t % 15 === 0)).toBe(true);
    expect(everyFiveMinutes).toHaveLength(144);
    expect(everyFiveMinutes.every((t) => t % 5 === 0 && t >= 0 && t < 720)).toBe(true);
  });

  it('are recognized', () => {
    expect(CLOCK_LEVELS.every(isClockLevel)).toBe(true);
    expect(isClockLevel('minutes')).toBe(false);
    expect(isClockLevel('1')).toBe(false);
  });
});

describe('digitalTime', () => {
  it.each([
    [at(12, 0), '12:00'],
    [at(3, 5), '3:05'],
    [at(3, 45), '3:45'],
    [at(11, 55), '11:55'],
  ])('writes %i as %s', (time, text) => {
    expect(digitalTime(time)).toBe(text);
  });
});

describe('handAngles', () => {
  it('turns the hour hand with the minutes', () => {
    expect(handAngles(at(12, 0))).toEqual({ hour: 0, minute: 0 });
    expect(handAngles(at(3, 0))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(at(3, 45))).toEqual({ hour: 112.5, minute: 270 });
    expect(handAngles(at(11, 30))).toEqual({ hour: 345, minute: 180 });
  });
});

describe('timeWords', () => {
  it.each([
    [at(12, 0), 'שתים עשרה'],
    [at(1, 0), 'אחת'],
    [at(2, 0), 'שתיים'],
    [at(11, 0), 'אחת עשרה'],
    [at(3, 0), 'שלוש'],
    [at(3, 5), 'שלוש וחמישה'],
    [at(3, 10), 'שלוש ועשרה'],
    [at(3, 15), 'שלוש ורבע'],
    [at(3, 20), 'שלוש ועשרים'],
    [at(3, 25), 'שלוש ועשרים וחמישה'],
    [at(3, 30), 'שלוש וחצי'],
    [at(3, 35), 'עשרים וחמישה לארבע'],
    [at(3, 40), 'עשרים לארבע'],
    [at(3, 45), 'רבע לארבע'],
    [at(3, 50), 'עשרה לארבע'],
    [at(3, 55), 'חמישה לארבע'],
    [at(12, 45), 'רבע לאחת'],
    [at(11, 45), 'רבע לשתים עשרה'],
  ])('says %i as %s: hours feminine, minutes masculine, after the half hour to the next hour', (time, text) => {
    expect(timeWords(time)).toBe(text);
  });

  it('vocalizes the phrase for speech', () => {
    expect(timeWords(at(3, 0), true)).toBe(words(3, 'f', true));
    expect(timeWords(at(3, 15), true)).toBe(words(3, 'f', true) + ' וְרֶבַע');
    expect(timeWords(at(3, 30), true)).toBe(words(3, 'f', true) + ' וְחֵצִי');
    expect(timeWords(at(3, 20), true)).toBe(words(3, 'f', true) + ' וְ' + words(20, 'm', true));
    expect(timeWords(at(3, 45), true)).toBe('רֶבַע לְ' + words(4, 'f', true));
    expect(timeWords(at(3, 50), true)).toBe(words(10, 'm', true) + ' לְ' + words(4, 'f', true));
  });

  it('vocalizes ל before a shva as לִ', () => {
    expect(timeWords(at(1, 45), true)).toBe('רֶבַע לִ' + words(2, 'f', true));
    expect(timeWords(at(7, 45), true)).toBe('רֶבַע לִ' + words(8, 'f', true));
    expect(timeWords(at(11, 45), true)).toBe('רֶבַע לִ' + words(12, 'f', true));
  });

  it.each([-5, 720, 3, 1.5, NaN])('rejects %s', (time) => {
    expect(() => timeWords(time)).toThrow('Invalid time');
  });
});

describe('acceptsTime', () => {
  it('accepts the phrase for every time, with and without niqqud', () => {
    for (const time of everyFiveMinutes) {
      expect(acceptsTime(time, timeWords(time))).toBe(true);
      expect(acceptsTime(time, timeWords(time, true))).toBe(true);
    }
  });

  it('accepts השעה in front and בדיוק after a whole hour', () => {
    expect(acceptsTime(at(3, 15), 'השעה שלוש ורבע')).toBe(true);
    expect(acceptsTime(at(3, 0), 'שלוש בדיוק')).toBe(true);
    expect(acceptsTime(at(3, 0), 'השעה שלוש בדיוק')).toBe(true);
  });

  it('accepts feminine minutes with דקות', () => {
    expect(acceptsTime(at(3, 5), 'שלוש וחמש דקות')).toBe(true);
    expect(acceptsTime(at(3, 10), 'שלוש ועשר דקות')).toBe(true);
    expect(acceptsTime(at(3, 25), 'שלוש ועשרים וחמש דקות')).toBe(true);
    expect(acceptsTime(at(3, 35), 'עשרים וחמש דקות לארבע')).toBe(true);
    expect(acceptsTime(at(3, 50), 'עשר דקות לארבע')).toBe(true);
  });

  it('accepts minutes read as on a digital clock from twenty on', () => {
    expect(acceptsTime(at(3, 20), 'שלוש עשרים')).toBe(true);
    expect(acceptsTime(at(3, 30), 'שלוש שלושים')).toBe(true);
    expect(acceptsTime(at(3, 40), 'שלוש ארבעים')).toBe(true);
    expect(acceptsTime(at(3, 40), 'שלוש וארבעים')).toBe(true);
    expect(acceptsTime(at(3, 45), 'שלוש ארבעים וחמישה')).toBe(true);
  });

  it('accepts short spellings, also after ל', () => {
    expect(acceptsTime(at(3, 15), 'שלש ורבע')).toBe(true);
    expect(acceptsTime(at(2, 45), 'רבע לשלש')).toBe(true);
    expect(acceptsTime(at(12, 30), 'שתיים עשרה וחצי')).toBe(true);
    expect(acceptsTime(at(3, 5), 'שלוש וחמשה')).toBe(true);
  });

  it.each([
    [at(3, 45), 'רבע לשלוש'],
    [at(3, 45), 'שלוש ורבע'],
    [at(3, 15), 'רבע לשלוש'],
    [at(3, 0), 'שלושה'],
    [at(3, 0), 'ארבע'],
    [at(3, 15), 'שלוש בדיוק'],
    [at(3, 10), 'שלוש ועשר'],
    [at(3, 10), 'שלוש ועשרה דקות'],
    [at(3, 10), 'שלוש עשרה'],
    [at(3, 50), 'עשרה לשלוש'],
  ])('rejects %i written as %s', (time, input) => {
    expect(acceptsTime(time, input)).toBe(false);
  });
});

describe('clockChoices', () => {
  it.each(CLOCK_LEVELS)('gives distinct times of the level including the answer (%s)', (level) => {
    const rng = seededRandom(7);
    const times = new Set(clockTimes(level));
    for (const time of times) {
      const choices = clockChoices(time, level, rng);
      expect(choices).toHaveLength(CHOICE_COUNT);
      expect(new Set(choices).size).toBe(CHOICE_COUNT);
      expect(choices).toContain(time);
      for (const c of choices) expect(times.has(c)).toBe(true);
    }
  });

  it('prefers look-alike times: an hour off, the mirrored quarter, swapped hands', () => {
    // 3:45: 2:45, 4:45, 3:15, 4:15 (ארבע ורבע next to רבע לארבע) and 9:15 with the hands swapped.
    const similar = new Set([at(2, 45), at(4, 45), at(3, 15), at(4, 15), at(9, 15)]);
    for (let seed = 1; seed <= 20; seed++) {
      const choices = clockChoices(at(3, 45), 'quarters', seededRandom(seed));
      expect(choices.filter((c) => similar.has(c))).toHaveLength(CHOICE_COUNT - 1);
    }
  });

  it('offers the hour before for a quarter past', () => {
    // שלוש ורבע and רבע לשלוש share the word שלוש.
    const seen = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) for (const c of clockChoices(at(3, 15), 'quarters', seededRandom(seed))) seen.add(c);
    expect(seen.has(at(2, 45))).toBe(true);
  });
});

describe('createClockDeck', () => {
  it.each(CLOCK_LEVELS)('has ten distinct times of the level (%s)', (level) => {
    const deck = createClockDeck(level, seededRandom(11));
    const times = new Set(clockTimes(level));
    expect(deck).toHaveLength(ROUND_LENGTH);
    expect(new Set(deck.map((q) => q.n)).size).toBe(ROUND_LENGTH);
    for (const q of deck) {
      expect(times.has(q.n)).toBe(true);
      expect(q).toMatchObject({ hint: false, correct: false, draft: '', picked: null });
      expect(q.choices).toContain(q.n);
    }
  });
});
