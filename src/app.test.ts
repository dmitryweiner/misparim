// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from './app';
import { digitalTime, timeWords } from './clock';
import { seededRandom } from './game';
import { LOCALE_NAMES, LOCALES } from './i18n';
import { words } from './numbers';
import type { Speech } from './speech';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type KeyValueStorage } from './storage';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>')).replace(/<script[^>]*><\/script>/g, '');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

function $<T extends Element = HTMLElement>(selector: string, type?: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof (type ?? HTMLElement))) throw new Error(`missing ${selector}`);
  return el as T;
}
const click = (selector: string) => $(selector).click();
function selectLocale(locale: string) {
  const select = $('#locale', HTMLSelectElement);
  select.value = locale;
  select.dispatchEvent(new Event('change'));
}
const textOf = (selector: string) => $(selector).textContent ?? '';
const setHash = (hash: string) => history.replaceState(null, '', hash);

class FakeUtterance {
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function fakeSpeech(voices: Partial<SpeechSynthesisVoice>[]) {
  return {
    getVoices: () => voices as SpeechSynthesisVoice[],
    speak: vi.fn<Speech['speak']>(),
    cancel: vi.fn<Speech['cancel']>(),
    addEventListener: vi.fn<Speech['addEventListener']>(),
    removeEventListener: vi.fn<Speech['removeEventListener']>(),
  } satisfies Speech;
}

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

let stop: (() => void) | undefined;
let storage: MemoryStorage;
const start = (speech: Speech | null = null, languages: readonly string[] = []) =>
  (stop = startApp({ random: seededRandom(5), speech, storage, languages }));

/** The number asked in the current question. */
function currentNumber(): number {
  const stimulus = $('.stimulus');
  if (!stimulus.classList.contains('he')) return Number(stimulus.textContent);
  for (let n = 1; n <= 999; n++) if (words(n, 'f') === stimulus.textContent) return n;
  throw new Error('unknown stimulus');
}

/** The time on the clock face: the hour hand turns half a degree a minute. */
function currentTime(): number {
  const transform = $('.hour-hand', SVGElement).getAttribute('transform') ?? '';
  return Number(/^rotate\(([\d.]+) /.exec(transform)?.[1]) * 2;
}

/** Turns on the auto-advance, which is off by default. */
const turnOnAutoNext = () => $('#auto', HTMLInputElement).click();

function chooseCorrect() {
  click(`[data-number="${currentNumber()}"]`);
}

function chooseWrong() {
  const n = currentNumber();
  $(`[data-number]:not([data-number="${n}"])`).click();
}

function typeAnswer(value: string) {
  const field = $('#answer', HTMLInputElement);
  field.value = value;
  field.dispatchEvent(new Event('input'));
  $('#answer-form', HTMLFormElement).requestSubmit();
}

beforeEach(() => {
  document.head.innerHTML = head;
  document.body.innerHTML = body;
  document.documentElement.lang = 'en';
  storage = new MemoryStorage();
  history.replaceState(null, '', '/');
  vi.useFakeTimers();
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('choice mode', () => {
  it('starts with the first of ten questions and four choices', () => {
    start();
    expect(textOf('.round')).toContain('Question 1 of 10');
    expect(document.querySelectorAll('[data-number]')).toHaveLength(4);
    expect($('[data-direction="forward"]').classList.contains('active')).toBe(true);
  });

  it('shows Hebrew words as choices in the forward direction', () => {
    start();
    const n = currentNumber();
    expect(textOf(`[data-number="${n}"]`)).toBe(words(n, 'f'));
  });

  it('counts a correct answer and advances automatically', () => {
    start();
    turnOnAutoNext();
    chooseCorrect();
    expect(textOf('.feedback strong')).toBe('Correct!');
    expect(textOf('#stats')).toContain('On your own: 1');
    expect(textOf('#next')).toBe('Next · 1.5 s');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Question 2 of 10');
  });

  it('records a mistake and waits longer', () => {
    start();
    turnOnAutoNext();
    chooseWrong();
    expect(document.querySelector('.choice.wrong')).not.toBeNull();
    expect(document.querySelector('.choice.correct')).not.toBeNull();
    expect(textOf('#stats')).toContain('Mistakes: 1');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Question 1 of 10');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Question 2 of 10');
  });

  it('counts answers with a hint separately', () => {
    start();
    click('#hint');
    expect($('#hinttext').hidden).toBe(false);
    chooseCorrect();
    expect(textOf('.feedback strong')).toBe('Correct, with a hint!');
    expect(textOf('#stats')).toContain('On your own: 0 · With a hint: 1');
  });

  it('pauses the auto-advance', () => {
    start();
    turnOnAutoNext();
    chooseCorrect();
    click('#pause');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Question 1 of 10');
    expect(textOf('#pause')).toBe('Paused');
    click('#next');
    expect(textOf('.round')).toContain('Question 2 of 10');
  });

  it('waits for the next button by default', () => {
    start();
    expect($('#auto', HTMLInputElement).checked).toBe(false);
    chooseCorrect();
    expect($('#pause').hidden).toBe(true);
    expect(textOf('#next')).toBe('Next');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Question 1 of 10');
  });

  it('shows the result with numbers to review after ten questions', () => {
    start();
    chooseWrong();
    click('#next');
    for (let i = 1; i < 10; i++) {
      chooseCorrect();
      click('#next');
    }
    expect(textOf('.result h1')).toBe('Round complete');
    expect(textOf('.big')).toContain('9');
    expect(document.querySelectorAll('.review p')).toHaveLength(1);
    click('#again');
    expect(textOf('.round')).toContain('Question 1 of 10');
  });
});

describe('settings', () => {
  it('starts a new round with numbers from the selected range', () => {
    start();
    chooseCorrect();
    const level = $('#level', HTMLSelectElement);
    level.value = '3';
    level.dispatchEvent(new Event('change'));
    expect(textOf('#stats')).toContain('On your own: 0');
    expect(currentNumber()).toBeGreaterThanOrEqual(100);
  });

  it('uses the masculine form', () => {
    start();
    const gender = $('#gender', HTMLSelectElement);
    gender.value = 'm';
    gender.dispatchEvent(new Event('change'));
    expect(textOf('.tag')).toBe('Masculine form');
    const n = currentNumber();
    expect(textOf(`[data-number="${n}"]`)).toBe(words(n, 'm'));
  });
});

describe('reverse direction', () => {
  it('shows the number in Hebrew and digits as choices', () => {
    start();
    click('[data-direction="reverse"]');
    expect($('.stimulus').getAttribute('lang')).toBe('he');
    for (const b of document.querySelectorAll('[data-number]')) expect(b.textContent).toMatch(/^\d+$/);
  });

  it('disables listening without a Hebrew voice', () => {
    start(fakeSpeech([{ lang: 'en-US' }]));
    click('[data-direction="reverse"]');
    expect($('#listen', HTMLButtonElement).disabled).toBe(true);
    expect(textOf('#voice-status')).toContain('No Hebrew voice is available');
  });

  it('speaks the vocalized number with a Hebrew voice', () => {
    const speech = fakeSpeech([{ lang: 'he-IL' }]);
    start(speech);
    click('[data-direction="reverse"]');
    const n = currentNumber();
    click('#listen');
    const utterance = speech.speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    expect(utterance.text).toBe(words(n, 'f', true));
    expect(utterance.lang).toBe('he-IL');
  });

  it('pauses the auto-advance when listening to the answer', () => {
    start(fakeSpeech([{ lang: 'he-IL' }]));
    turnOnAutoNext();
    chooseCorrect();
    click('#listen');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Question 1 of 10');
  });
});

describe('direction in the URL', () => {
  it('opens the direction named in the hash', () => {
    setHash('#word-first');
    start();
    expect($('[data-direction="reverse"]').classList.contains('active')).toBe(true);
    expect($('.stimulus').classList.contains('he')).toBe(true);
  });

  it('starts with digits first for an unknown hash', () => {
    setHash('#unknown');
    start();
    expect($('[data-direction="forward"]').classList.contains('active')).toBe(true);
  });

  it('writes the chosen direction into the hash without adding history entries', () => {
    start();
    const entries = history.length;
    click('[data-direction="reverse"]');
    expect(location.hash).toBe('#word-first');
    click('[data-direction="forward"]');
    expect(location.hash).toBe('#number-first');
    expect(history.length).toBe(entries);
  });

  it('switches the direction and starts a new round when the hash changes', () => {
    start();
    chooseCorrect();
    setHash('#word-first');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect($('[data-direction="reverse"]').classList.contains('active')).toBe(true);
    expect(textOf('.round')).toContain('Question 1 of 10');
    expect(document.querySelector('.feedback')).toBeNull();
  });

  it('keeps the round when the hash changes to the same direction', () => {
    setHash('#word-first');
    start();
    chooseCorrect();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(document.querySelector('.feedback')).not.toBeNull();
  });

  it('stops listening to the hash after the app is stopped', () => {
    start();
    stop?.();
    stop = undefined;
    setHash('#word-first');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect($('[data-direction="forward"]').classList.contains('active')).toBe(true);
  });
});

function openClock(speech: Speech | null = null) {
  start(speech);
  click('[data-direction="clock"]');
}

/** The settings shown for one kind of game: numbers or clock. */
const settingsFor = (game: string) => [...document.querySelectorAll<HTMLElement>(`[data-settings="${game}"]`)];

describe('clock', () => {
  it('shows a clock face and the time in Hebrew words as choices', () => {
    openClock();
    expect(location.hash).toBe('#clock');
    expect($('[data-direction="clock"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.stimulus .clock-face')).not.toBeNull();
    expect(textOf('.prompt')).toBe('What time does the clock show?');
    expect(textOf('.tag')).toBe('Quarters and halves');
    expect([...$('#clock-level', HTMLSelectElement).options].map((o) => o.value)).toEqual(['quarters', 'five']);
    const time = currentTime();
    expect(time % 15).toBe(0);
    expect(textOf(`[data-number="${time}"]`)).toBe(timeWords(time));
    for (const b of document.querySelectorAll('[data-number]')) expect(b.getAttribute('lang')).toBe('he');
  });

  it('opens from the hash', () => {
    setHash('#clock');
    start();
    expect($('[data-direction="clock"]').classList.contains('active')).toBe(true);
    expect(document.querySelector('.clock-face')).not.toBeNull();
  });

  it('labels the clock face with the time for screen readers', () => {
    openClock();
    expect($('.clock-face', SVGElement).getAttribute('aria-label')).toBe(`Clock showing ${digitalTime(currentTime())}`);
  });

  it('shows the right answer with the time in digits', () => {
    openClock();
    const time = currentTime();
    click(`[data-number="${time}"]`);
    expect(textOf('.feedback strong')).toBe('Correct!');
    expect(textOf('.correct-answer')).toBe(`${digitalTime(time)} = ${timeWords(time)}`);
  });

  it('hints with the time in digits', () => {
    openClock();
    click('#hint');
    expect(textOf('#hinttext')).toContain(`It is ${digitalTime(currentTime())}.`);
  });

  it('shows the precision setting instead of the range and the form', () => {
    start();
    expect(settingsFor('clock').every((el) => el.hidden)).toBe(true);
    expect(settingsFor('numbers').some((el) => el.hidden)).toBe(false);
    click('[data-direction="clock"]');
    expect(settingsFor('clock').some((el) => el.hidden)).toBe(false);
    expect(settingsFor('numbers').every((el) => el.hidden)).toBe(true);
    click('[data-direction="reverse"]');
    expect(settingsFor('clock').every((el) => el.hidden)).toBe(true);
  });

  it('starts a new round with the chosen precision and remembers it', () => {
    openClock();
    click(`[data-number="${currentTime()}"]`);
    const precision = $('#clock-level', HTMLSelectElement);
    precision.value = 'five';
    precision.dispatchEvent(new Event('change'));
    expect(textOf('.tag')).toBe('Every 5 minutes');
    expect(textOf('#stats')).toContain('On your own: 0');
    expect(loadSettings(storage).clockLevel).toBe('five');
  });

  it('restores the saved precision', () => {
    saveSettings(storage, { ...DEFAULT_SETTINGS, clockLevel: 'five' });
    openClock();
    expect($('#clock-level', HTMLSelectElement).value).toBe('five');
    expect(textOf('.tag')).toBe('Every 5 minutes');
  });

  it('accepts the time typed in Hebrew words', () => {
    openClock();
    click('[data-method="input"]');
    expect(textOf('.answer-label')).toBe('Write the time in Hebrew words');
    expect(document.querySelector('#keyboard-toggle')).not.toBeNull();
    typeAnswer('3:00');
    expect(textOf('#input-error')).toContain('in Hebrew words');
    typeAnswer('השעה ' + timeWords(currentTime()));
    expect(textOf('.feedback strong')).toBe('Correct!');
  });

  it('speaks the vocalized time after answering', () => {
    const speech = fakeSpeech([{ lang: 'he-IL' }]);
    openClock(speech);
    expect(document.querySelector('#listen')).toBeNull();
    const time = currentTime();
    click(`[data-number="${time}"]`);
    click('#listen');
    const utterance = speech.speak.mock.calls[0]?.[0] as unknown as FakeUtterance;
    expect(utterance.text).toBe(timeWords(time, true));
  });

  it('reviews the missed times on the result screen', () => {
    openClock();
    const missed = currentTime();
    click(`[data-number]:not([data-number="${missed}"])`);
    click('#next');
    for (let i = 1; i < 10; i++) {
      click(`[data-number="${currentTime()}"]`);
      click('#next');
    }
    expect([...document.querySelectorAll('.review p')].map((p) => p.textContent)).toEqual([digitalTime(missed) + timeWords(missed)]);
  });

  it('keeps the clock when the language changes', () => {
    openClock();
    const time = currentTime();
    selectLocale('ru');
    expect(currentTime()).toBe(time);
    expect(textOf('.prompt')).toBe('Сколько времени показывают часы?');
    expect(textOf('.tag')).toBe('Четверти и половины');
  });
});

describe('input mode', () => {
  beforeEach(() => {
    start();
    click('[data-method="input"]');
  });

  it('accepts the number written in Hebrew', () => {
    typeAnswer(words(currentNumber(), 'f'));
    expect(textOf('.feedback strong')).toBe('Correct!');
    expect($('#answer', HTMLInputElement).classList.contains('correct')).toBe(true);
  });

  it('validates the answer before checking', () => {
    typeAnswer('');
    expect(textOf('#input-error')).toBe('Enter an answer first.');
    typeAnswer('12');
    expect(textOf('#input-error')).toContain('in Hebrew words');
    expect(document.querySelector('.feedback')).toBeNull();
  });

  it('accepts digits in the reverse direction', () => {
    click('[data-direction="reverse"]');
    typeAnswer('abc');
    expect(textOf('#input-error')).toContain('in digits');
    typeAnswer(String(currentNumber()));
    expect(textOf('.feedback strong')).toBe('Correct!');
  });

  it('types with the on-screen keyboard', () => {
    click('#keyboard-toggle');
    expect($('#keyboard').hidden).toBe(false);
    click('[data-key="ש"]');
    click('[data-key="ל"]');
    click('[data-key="back"]');
    click('[data-key=" "]');
    expect($('#answer', HTMLInputElement).value).toBe('ש ');
  });
});

describe('settings storage', () => {
  it('restores saved settings', () => {
    saveSettings(storage, { ...DEFAULT_SETTINGS, level: '3', gender: 'm' });
    start();
    expect($('#level', HTMLSelectElement).value).toBe('3');
    expect($('#gender', HTMLSelectElement).value).toBe('m');
    expect($('#auto', HTMLInputElement).checked).toBe(false);
    expect(currentNumber()).toBeGreaterThanOrEqual(100);
    expect(textOf('.tag')).toBe('Masculine form');
  });

  it('saves changed settings', () => {
    start();
    const level = $('#level', HTMLSelectElement);
    level.value = '2';
    level.dispatchEvent(new Event('change'));
    turnOnAutoNext();
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, level: '2', autoNext: true });
  });
});

describe('language', () => {
  it('offers the languages in a dropdown, each named in its own language', () => {
    const options = [...$('#locale', HTMLSelectElement).options].map((o) => [o.value, o.lang, o.textContent]);
    expect(options).toEqual(LOCALES.map((l) => [l, l, LOCALE_NAMES[l]]));
  });

  it('is English by default', () => {
    start();
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Misparim · Hebrew numbers');
    expect($('#locale', HTMLSelectElement).value).toBe('en');
  });

  it('follows the browser language', () => {
    start(null, ['uk-UA', 'en']);
    expect(document.documentElement.lang).toBe('uk');
    expect($('#locale', HTMLSelectElement).value).toBe('uk');
    expect(textOf('.round')).toContain('Запитання 1 з 10');
    expect(textOf('[data-method="choice"]')).toBe('Обрати відповідь');
  });

  it('prefers the saved language over the browser language', () => {
    saveSettings(storage, { ...DEFAULT_SETTINGS, locale: 'ru' });
    start(null, ['uk-UA']);
    expect(document.documentElement.lang).toBe('ru');
  });

  it('switches the page language and remembers it', () => {
    start();
    selectLocale('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(document.title).toBe('Миспарим · Числа на иврите');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('Тренажёр');
    expect(textOf('summary')).toBe('Настройки тренировки');
    expect(textOf('#level option')).toBe('1–10 · первые числа');
    expect($('nav').getAttribute('aria-label')).toBe('Направление');
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
    expect($('#locale', HTMLSelectElement).value).toBe('ru');
    expect($('#locale').getAttribute('aria-label')).toBe('Язык');
    expect(loadSettings(storage).locale).toBe('ru');
  });

  it('keeps the round going when the language changes', () => {
    start();
    chooseCorrect();
    click('#next');
    const n = currentNumber();
    selectLocale('uk');
    expect(textOf('.round')).toContain('Запитання 2 з 10');
    expect(textOf('#stats')).toContain('Самостійно: 1');
    expect(currentNumber()).toBe(n);
  });

  it('keeps the answer, the feedback and the countdown when the language changes', () => {
    start();
    turnOnAutoNext();
    chooseWrong();
    selectLocale('ru');
    expect(textOf('.feedback strong')).toBe('Запомним правильный ответ:');
    expect(textOf('#next')).toBe('Далее · 3 с');
    expect(document.querySelector('.choice.wrong')).not.toBeNull();
    expect(document.querySelectorAll('[data-number]:disabled')).toHaveLength(4);
    vi.advanceTimersByTime(3000);
    expect(textOf('.round')).toContain('Вопрос 2 из 10');
  });

  it('keeps the pause when the language changes', () => {
    start();
    turnOnAutoNext();
    chooseCorrect();
    click('#pause');
    selectLocale('ru');
    expect(textOf('#pause')).toBe('На паузе');
    expect(textOf('#next')).toBe('Далее');
  });

  it('keeps the typed answer and the open hint', () => {
    start();
    click('[data-method="input"]');
    click('#hint');
    const field = $('#answer', HTMLInputElement);
    field.value = 'שלו';
    field.dispatchEvent(new Event('input'));
    selectLocale('ru');
    expect($('#answer', HTMLInputElement).value).toBe('שלו');
    expect($('#hinttext').hidden).toBe(false);
    expect(textOf('#hinttext')).toMatch(/Первая буква|Начни с/);
  });

  it('translates the result screen', () => {
    start();
    for (let i = 0; i < 10; i++) {
      chooseCorrect();
      click('#next');
    }
    expect(textOf('.result h1')).toBe('All ten on your own!');
    selectLocale('ru');
    expect(textOf('.result h1')).toBe('Все десять — самостоятельно!');
    expect(textOf('#again')).toBe('Ещё 10 вопросов');
  });

  it('translates the on-screen keyboard', () => {
    start(null, ['ru']);
    click('[data-method="input"]');
    expect(textOf('[data-key=" "]')).toBe('רווח · пробел');
    expect(textOf('[data-key="back"]')).toBe('Удалить');
  });
});

const hebrewIn = (selector: string) => [...$(selector).querySelectorAll('span[lang="he"][dir="rtl"]')].map((s) => s.textContent);

describe('Hebrew inside interface texts', () => {
  it('marks Hebrew words in static texts so they keep their order and font', () => {
    start();
    expect(hebrewIn('.gender-note')).toEqual(['שני', 'שתי']);
    expect(hebrewIn('[data-i18n="checkingText"]')).toEqual(['ו']);
  });

  it('isolates the letters on the direction buttons, so the arrow keeps pointing from digits to words and back', () => {
    start();
    expect(hebrewIn('[data-direction="forward"]')).toEqual(['אבג']);
    expect(hebrewIn('[data-direction="reverse"]')).toEqual(['אבג']);
    expect(hebrewIn('[data-direction="clock"]')).toEqual(['אבג']);
  });

  it('marks them again after switching the language', () => {
    start();
    selectLocale('ru');
    expect(textOf('.gender-note')).toContain('Без существительного');
    expect(hebrewIn('.gender-note')).toEqual(['שני', 'שתי']);
  });

  it('marks Hebrew in hints and on the keyboard toggle', () => {
    start();
    click('[data-method="input"]');
    click('#hint');
    expect(hebrewIn('#hinttext')).toHaveLength(1);
    expect(hebrewIn('#keyboard-toggle')).toEqual(['א', 'ת']);
  });
});
