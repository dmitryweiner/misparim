// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp } from './app';
import { seededRandom } from './game';
import { words } from './numbers';
import type { Speech } from './speech';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

function $<T extends Element = HTMLElement>(selector: string, type?: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof (type ?? HTMLElement))) throw new Error(`missing ${selector}`);
  return el as T;
}
const click = (selector: string) => $(selector).click();
const textOf = (selector: string) => $(selector).textContent ?? '';

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

let stop: (() => void) | undefined;
const start = (speech: Speech | null = null) => (stop = startApp({ random: seededRandom(5), speech }));

/** The number asked in the current question. */
function currentNumber(): number {
  const stimulus = $('.stimulus');
  if (!stimulus.classList.contains('he')) return Number(stimulus.textContent);
  for (let n = 1; n <= 999; n++) if (words(n, 'f') === stimulus.textContent) return n;
  throw new Error('unknown stimulus');
}

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
  document.body.innerHTML = body;
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
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
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
    chooseCorrect();
    expect(textOf('.feedback strong')).toBe('Верно!');
    expect(textOf('#stats')).toContain('Самостоятельно: 1');
    expect(textOf('#next')).toBe('Далее · 1,5 с');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Вопрос 2 из 10');
  });

  it('records a mistake and waits longer', () => {
    start();
    chooseWrong();
    expect(document.querySelector('.choice.wrong')).not.toBeNull();
    expect(document.querySelector('.choice.correct')).not.toBeNull();
    expect(textOf('#stats')).toContain('Ошибки: 1');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
    vi.advanceTimersByTime(1500);
    expect(textOf('.round')).toContain('Вопрос 2 из 10');
  });

  it('counts answers with a hint separately', () => {
    start();
    click('#hint');
    expect($('#hinttext').hidden).toBe(false);
    chooseCorrect();
    expect(textOf('.feedback strong')).toBe('Верно, с подсказкой!');
    expect(textOf('#stats')).toContain('Самостоятельно: 0 · С подсказкой: 1');
  });

  it('pauses the auto-advance', () => {
    start();
    chooseCorrect();
    click('#pause');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
    expect(textOf('#pause')).toBe('На паузе');
    click('#next');
    expect(textOf('.round')).toContain('Вопрос 2 из 10');
  });

  it('waits for the next button when auto-advance is off', () => {
    start();
    $('#auto', HTMLInputElement).click();
    chooseCorrect();
    expect($('#pause').hidden).toBe(true);
    expect(textOf('#next')).toBe('Далее');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
  });

  it('shows the result with numbers to review after ten questions', () => {
    start();
    chooseWrong();
    vi.advanceTimersByTime(3000);
    for (let i = 1; i < 10; i++) {
      chooseCorrect();
      vi.advanceTimersByTime(1500);
    }
    expect(textOf('.result h1')).toBe('Раунд завершён');
    expect(textOf('.big')).toContain('9');
    expect(document.querySelectorAll('.review p')).toHaveLength(1);
    click('#again');
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
  });
});

describe('settings', () => {
  it('starts a new round with numbers from the selected range', () => {
    start();
    chooseCorrect();
    const level = $('#level', HTMLSelectElement);
    level.value = '3';
    level.dispatchEvent(new Event('change'));
    expect(textOf('#stats')).toContain('Самостоятельно: 0');
    expect(currentNumber()).toBeGreaterThanOrEqual(100);
  });

  it('uses the masculine form', () => {
    start();
    const gender = $('#gender', HTMLSelectElement);
    gender.value = 'm';
    gender.dispatchEvent(new Event('change'));
    expect(textOf('.tag')).toBe('Мужская форма');
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
    expect(textOf('#voice-status')).toContain('Нет доступного голоса иврита');
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
    chooseCorrect();
    click('#listen');
    vi.advanceTimersByTime(5000);
    expect(textOf('.round')).toContain('Вопрос 1 из 10');
  });
});

describe('input mode', () => {
  beforeEach(() => {
    start();
    click('[data-method="input"]');
  });

  it('accepts the number written in Hebrew', () => {
    typeAnswer(words(currentNumber(), 'f'));
    expect(textOf('.feedback strong')).toBe('Верно!');
    expect($('#answer', HTMLInputElement).classList.contains('correct')).toBe(true);
  });

  it('validates the answer before checking', () => {
    typeAnswer('');
    expect(textOf('#input-error')).toBe('Сначала введи ответ.');
    typeAnswer('12');
    expect(textOf('#input-error')).toContain('словами на иврите');
    expect(document.querySelector('.feedback')).toBeNull();
  });

  it('accepts digits in the reverse direction', () => {
    click('[data-direction="reverse"]');
    typeAnswer('abc');
    expect(textOf('#input-error')).toContain('цифрами');
    typeAnswer(String(currentNumber()));
    expect(textOf('.feedback strong')).toBe('Верно!');
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
