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

const $ = <T extends Element = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
};
const click = (selector: string) => $<HTMLElement>(selector).click();
const text = (selector: string) => $(selector).textContent ?? '';

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
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
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
  $<HTMLButtonElement>(`[data-number]:not([data-number="${n}"])`).click();
}

function typeAnswer(value: string) {
  const field = $<HTMLInputElement>('#answer');
  field.value = value;
  field.dispatchEvent(new Event('input'));
  $<HTMLFormElement>('#answer-form').requestSubmit();
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
    expect(text('.round')).toContain('Вопрос 1 из 10');
    expect(document.querySelectorAll('[data-number]')).toHaveLength(4);
    expect($('[data-direction="forward"]').classList.contains('active')).toBe(true);
  });

  it('shows Hebrew words as choices in the forward direction', () => {
    start();
    const n = currentNumber();
    expect(text(`[data-number="${n}"]`)).toBe(words(n, 'f'));
  });

  it('counts a correct answer and advances automatically', () => {
    start();
    chooseCorrect();
    expect(text('.feedback strong')).toBe('Верно!');
    expect(text('#stats')).toContain('Самостоятельно: 1');
    expect(text('#next')).toBe('Далее · 1,5 с');
    vi.advanceTimersByTime(1500);
    expect(text('.round')).toContain('Вопрос 2 из 10');
  });

  it('records a mistake and waits longer', () => {
    start();
    chooseWrong();
    expect(document.querySelector('.choice.wrong')).not.toBeNull();
    expect(document.querySelector('.choice.correct')).not.toBeNull();
    expect(text('#stats')).toContain('Ошибки: 1');
    vi.advanceTimersByTime(1500);
    expect(text('.round')).toContain('Вопрос 1 из 10');
    vi.advanceTimersByTime(1500);
    expect(text('.round')).toContain('Вопрос 2 из 10');
  });

  it('counts answers with a hint separately', () => {
    start();
    click('#hint');
    expect($('#hinttext').hidden).toBe(false);
    chooseCorrect();
    expect(text('.feedback strong')).toBe('Верно, с подсказкой!');
    expect(text('#stats')).toContain('Самостоятельно: 0 · С подсказкой: 1');
  });

  it('pauses the auto-advance', () => {
    start();
    chooseCorrect();
    click('#pause');
    vi.advanceTimersByTime(5000);
    expect(text('.round')).toContain('Вопрос 1 из 10');
    expect(text('#pause')).toBe('На паузе');
    click('#next');
    expect(text('.round')).toContain('Вопрос 2 из 10');
  });

  it('waits for the next button when auto-advance is off', () => {
    start();
    $<HTMLInputElement>('#auto').click();
    chooseCorrect();
    expect($('#pause').hidden).toBe(true);
    expect(text('#next')).toBe('Далее');
    vi.advanceTimersByTime(5000);
    expect(text('.round')).toContain('Вопрос 1 из 10');
  });

  it('shows the result with numbers to review after ten questions', () => {
    start();
    chooseWrong();
    vi.advanceTimersByTime(3000);
    for (let i = 1; i < 10; i++) {
      chooseCorrect();
      vi.advanceTimersByTime(1500);
    }
    expect(text('.result h1')).toBe('Раунд завершён');
    expect(text('.big')).toContain('9');
    expect(document.querySelectorAll('.review p')).toHaveLength(1);
    click('#again');
    expect(text('.round')).toContain('Вопрос 1 из 10');
  });
});

describe('settings', () => {
  it('starts a new round with numbers from the selected range', () => {
    start();
    chooseCorrect();
    const level = $<HTMLSelectElement>('#level');
    level.value = '3';
    level.dispatchEvent(new Event('change'));
    expect(text('#stats')).toContain('Самостоятельно: 0');
    expect(currentNumber()).toBeGreaterThanOrEqual(100);
  });

  it('uses the masculine form', () => {
    start();
    const gender = $<HTMLSelectElement>('#gender');
    gender.value = 'm';
    gender.dispatchEvent(new Event('change'));
    expect(text('.tag')).toBe('Мужская форма');
    const n = currentNumber();
    expect(text(`[data-number="${n}"]`)).toBe(words(n, 'm'));
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
    expect($<HTMLButtonElement>('#listen').disabled).toBe(true);
    expect(text('#voice-status')).toContain('Нет доступного голоса иврита');
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
    expect(text('.round')).toContain('Вопрос 1 из 10');
  });
});

describe('input mode', () => {
  beforeEach(() => {
    start();
    click('[data-method="input"]');
  });

  it('accepts the number written in Hebrew', () => {
    typeAnswer(words(currentNumber(), 'f'));
    expect(text('.feedback strong')).toBe('Верно!');
    expect($<HTMLInputElement>('#answer').classList.contains('correct')).toBe(true);
  });

  it('validates the answer before checking', () => {
    typeAnswer('');
    expect(text('#input-error')).toBe('Сначала введи ответ.');
    typeAnswer('12');
    expect(text('#input-error')).toContain('словами на иврите');
    expect(document.querySelector('.feedback')).toBeNull();
  });

  it('accepts digits in the reverse direction', () => {
    click('[data-direction="reverse"]');
    typeAnswer('abc');
    expect(text('#input-error')).toContain('цифрами');
    typeAnswer(String(currentNumber()));
    expect(text('.feedback strong')).toBe('Верно!');
  });

  it('types with the on-screen keyboard', () => {
    click('#keyboard-toggle');
    expect($('#keyboard').hidden).toBe(false);
    click('[data-key="ש"]');
    click('[data-key="ל"]');
    click('[data-key="back"]');
    click('[data-key=" "]');
    expect($<HTMLInputElement>('#answer').value).toBe('ש ');
  });
});
