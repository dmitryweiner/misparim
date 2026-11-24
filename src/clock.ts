import { CHOICE_COUNT, ROUND_LENGTH, shuffle, type Question, type Random } from './game';
import { normalize, withAnd, words } from './numbers';

// A time is the number of minutes past twelve on a twelve-hour face: 0–719, in steps of five.
export type ClockLevel = 'quarters' | 'five';

export const CLOCK_LEVELS: readonly ClockLevel[] = ['quarters', 'five'];
const STEPS: Record<ClockLevel, number> = { quarters: 15, five: 5 };
const DAY = 720;

export function isClockLevel(value: unknown): value is ClockLevel {
  return CLOCK_LEVELS.some((level) => level === value);
}

/** Every time on the face at the level's step. */
export function clockTimes(level: ClockLevel): number[] {
  const step = STEPS[level];
  return Array.from({ length: DAY / step }, (_, i) => i * step);
}

function check(time: number) {
  if (!Number.isInteger(time) || time < 0 || time >= DAY || time % 5) throw new Error('Invalid time');
}

const minuteOf = (time: number) => time % 60;
/** The hour on the face, 1–12; time + 60 gives the next one. */
const hourOf = (time: number) => Math.floor((time % DAY) / 60) || 12;

/** The time as a digital clock shows it: 3:05, 12:00. */
export function digitalTime(time: number): string {
  return `${hourOf(time)}:${String(minuteOf(time)).padStart(2, '0')}`;
}

/** Angles of the hands in degrees clockwise from 12; the hour hand moves with the minutes. */
export function handAngles(time: number): { hour: number; minute: number } {
  return { hour: time / 2, minute: minuteOf(time) * 6 };
}

/** Prefixes ל ("to"); vocalized as לִ before a shva, otherwise לְ. */
function withTo(word: string, vocalized: boolean): string {
  if (!vocalized) return 'ל' + word;
  return (word.startsWith('שְׁ') ? 'לִ' : 'לְ') + word;
}

/** Minutes in everyday speech: masculine numbers, a quarter and a half. */
function minutes(m: number, vocalized: boolean): string {
  if (m === 15) return vocalized ? 'רֶבַע' : 'רבע';
  if (m === 30) return vocalized ? 'חֵצִי' : 'חצי';
  return words(m, 'm', vocalized);
}

/**
 * How the time is said: the hour in the feminine form (שעה is feminine), minutes in the masculine,
 * as in everyday speech. Up to the half hour the minutes follow the hour with ו: שלוש ורבע;
 * after it they are counted to the next hour with ל: רבע לארבע.
 */
export function timeWords(time: number, vocalized = false): string {
  check(time);
  const m = minuteOf(time);
  const hour = words(hourOf(time), 'f', vocalized);
  if (!m) return hour;
  if (m <= 30) return hour + ' ' + withAnd(minutes(m, vocalized), vocalized);
  return minutes(60 - m, vocalized) + ' ' + withTo(words(hourOf(time + 60), 'f', vocalized), vocalized);
}

/** Whether the input says the time: the phrase above or one of its common variants. */
export function acceptsTime(time: number, input: string): boolean {
  const value = normalize(input).replace(/^השעה /, '');
  const m = minuteOf(time);
  const hour = words(hourOf(time), 'f');
  const forms = [timeWords(time)];
  if (!m) forms.push(hour + ' בדיוק');
  // The book form: feminine minutes with דקות, "minutes".
  if (m % 15) {
    forms.push(m < 30 ? `${hour} ו${words(m, 'f')} דקות` : `${words(60 - m, 'f')} דקות ל${words(hourOf(time + 60), 'f')}`);
  }
  // Read as on a digital clock: שלוש ארבעים.
  if (m >= 20) forms.push(`${hour} ${words(m, 'm')}`, `${hour} ו${words(m, 'm')}`);
  return forms.some((form) => normalize(form) === value);
}

const wrap = (time: number) => ((time % DAY) + DAY) % DAY;

/** Answer choices for a time: the time itself plus look-alike times of the same level. */
export function clockChoices(time: number, level: ClockLevel, rng: Random): number[] {
  const m = minuteOf(time);
  const similar = shuffle(
    [
      // The hour off by one, the usual slip with ל.
      time - 60,
      time + 60,
      // The minutes mirrored around the half hour: שלוש ורבע and רבע לארבע.
      time + 60 - 2 * m,
      // The mirrored minutes with the same hour word: שלוש ורבע and רבע לשלוש.
      m <= 30 ? time - 2 * m : time + 120 - 2 * m,
      // The hands swapped.
      (m / 5) * 60 + Math.floor(time / 60) * 5,
      time - 5,
      time + 5,
    ].map(wrap),
    rng,
  ).filter((t) => t !== time && t % STEPS[level] === 0);
  const set = new Set([time]);
  for (const t of similar) if (set.size < CHOICE_COUNT) set.add(t);
  const times = clockTimes(level);
  while (set.size < CHOICE_COUNT) set.add(times[Math.floor(rng() * times.length)] ?? 0);
  return shuffle([...set], rng);
}

/** Ten distinct times of the level with their answer choices. */
export function createClockDeck(level: ClockLevel, rng: Random): Question[] {
  return shuffle(clockTimes(level), rng)
    .slice(0, ROUND_LENGTH)
    .map((n) => ({ n, choices: clockChoices(n, level, rng), hint: false, correct: false, draft: '', picked: null }));
}
