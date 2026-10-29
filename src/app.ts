import { createDeck, isLevel, ROUND_LENGTH, type Direction, type Level, type Method, type Question, type Random } from './game';
import { accepts, words, type Gender } from './numbers';
import { findHebrewVoice, type Speech } from './speech';

export interface AppOptions {
  random?: Random;
  speech?: Speech | null;
}

const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשתךםןףץ'.split('');
const CORRECT_DELAY = 1500;
const WRONG_DELAY = 3000;
const SPEECH_RATE = 0.85;

function required<T extends Element>(selector: string, type: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Element ${selector} not found`);
  return el;
}

function he(text: string, cls = ''): string {
  return `<span lang="he" dir="rtl" class="he ${cls}">${text}</span>`;
}

function markActive(attribute: string, value: string) {
  for (const b of document.querySelectorAll<HTMLElement>(`[data-${attribute}]`)) {
    const active = b.dataset[attribute] === value;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  }
}

function hintText(n: number, forward: boolean, gender: Gender): string {
  if (forward) {
    const text = words(n, gender);
    const first = text.split(' ')[0] ?? '';
    return n <= 10
      ? `Первая буква слова: ${text[0] ?? ''}. Вспомни ${gender === 'f' ? 'женскую' : 'мужскую'} форму.`
      : `Начни с «${first}». Порядок: сотни, десятки, единицы. Перед последней частью — ו («и»).`;
  }
  if (n <= 10) return `Это ${n % 2 ? 'нечётное' : 'чётное'} число из диапазона 1–10.`;
  const tens = Math.floor(n / 10) * 10;
  if (n < 100) return `Число от ${tens} до ${tens + 9}. Союз ו означает «и».`;
  const h = Math.floor(n / 100);
  return `В числе ${h} ${h === 1 ? 'сотня' : h < 5 ? 'сотни' : 'сотен'}. Прочитай оставшуюся часть после сотен.`;
}

/** Starts the game on the current page; returns a function that removes global listeners. */
export function startApp({ random = Math.random, speech = null }: AppOptions = {}): () => void {
  const game = required('#game', HTMLElement);
  const level = required('#level', HTMLSelectElement);
  const gender = required('#gender', HTMLSelectElement);
  const auto = required('#auto', HTMLInputElement);
  const settings = required('#settings', HTMLDetailsElement);

  let direction: Direction = 'forward';
  let method: Method = 'choice';
  let deck: Question[] = [];
  let index = 0;
  let score = 0;
  let helped = 0;
  let errors: number[] = [];
  let answered = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let voice: SpeechSynthesisVoice | null = null;
  let speechId = 0;

  const currentLevel = (): Level => (isLevel(level.value) ? level.value : '1');
  const currentGender = (): Gender => (gender.value === 'm' ? 'm' : 'f');
  const isLast = () => index === ROUND_LENGTH - 1;
  const nextLabel = () => (isLast() ? 'Результат' : 'Далее');
  const statsText = () => `Самостоятельно: ${score} · С подсказкой: ${helped} · Ошибки: ${errors.length}`;
  const current = (): Question => {
    const q = deck[index];
    if (!q) throw new Error('No current question');
    return q;
  };

  /** Cancels the pending auto-advance and any speech in progress. */
  function cancelPending() {
    clearTimeout(timer);
    timer = undefined;
    speechId++;
    speech?.cancel();
  }

  function begin() {
    cancelPending();
    deck = createDeck(currentLevel(), random);
    index = 0;
    score = 0;
    helped = 0;
    errors = [];
    answered = false;
    render();
  }

  function render() {
    markActive('direction', direction);
    markActive('method', method);
    if (index === deck.length) return showResult();
    const q = current();
    const forward = direction === 'forward';
    const g = currentGender();
    const text = words(q.n, g);
    const choiceHTML = `<div class="choices">${q.choices
      .map(
        (n) =>
          `<button class="choice ${forward ? 'he' : ''}" data-number="${n}" ${forward ? 'lang="he" dir="rtl"' : ''}>${forward ? words(n, g) : n}</button>`,
      )
      .join('')}</div>`;
    const inputHTML =
      `<form id="answer-form"><label class="answer-label" for="answer">${forward ? 'Напиши число словами на иврите' : 'Впиши число цифрами'}</label>` +
      `<div class="input-row"><input id="answer" type="text" ${forward ? 'lang="he" dir="rtl" class="he"' : 'inputmode="numeric" dir="ltr"'} autocomplete="off" spellcheck="false" maxlength="100" enterkeyhint="done" aria-describedby="input-error">` +
      `<button type="submit" class="primary">Проверить</button></div><p id="input-error" class="error" aria-live="polite"></p></form>` +
      (forward
        ? '<button class="keyboard-toggle" id="keyboard-toggle" aria-expanded="false" aria-controls="keyboard">Клавиатура א–ת</button><div class="keyboard" id="keyboard" hidden></div>'
        : '');
    game.innerHTML =
      `<div class="round"><span>Вопрос ${index + 1} из ${ROUND_LENGTH}</span><span class="tag">${g === 'f' ? 'Женская форма' : 'Мужская форма'}</span></div>` +
      `<div class="stats" id="stats">${statsText()}</div>` +
      `<div class="progress" role="progressbar" aria-label="Пройдено вопросов" aria-valuemin="0" aria-valuemax="${ROUND_LENGTH}" aria-valuenow="${index}"><i style="width:${(index * 100) / ROUND_LENGTH}%"></i></div>` +
      `<h1 class="prompt">${forward ? 'Как это число пишется на иврите?' : 'Какое это число?'}</h1>` +
      `<div class="stimulus ${forward ? '' : 'he'}" ${forward ? '' : 'lang="he" dir="rtl"'}>${forward ? q.n : text}</div>` +
      (forward
        ? ''
        : '<div class="speech"><button class="sound" id="listen">▶ Послушать</button><p class="voice-status" id="voice-status" aria-live="polite"></p></div>') +
      (method === 'choice' ? choiceHTML : inputHTML) +
      '<div id="feedback" aria-live="polite"></div><button class="hint" id="hint">Подсказка</button><p class="hinttext" id="hinttext" hidden></p>';

    for (const b of game.querySelectorAll<HTMLButtonElement>('[data-number]')) b.onclick = () => answer(Number(b.dataset.number));
    if (method === 'input') bindInput(q, forward);
    required('#hint', HTMLButtonElement).onclick = () => {
      if (answered) return;
      q.hint = true;
      const hint = required('#hinttext', HTMLElement);
      hint.hidden = false;
      hint.textContent = hintText(q.n, forward, g);
    };
    if (!forward) {
      required('#listen', HTMLButtonElement).onclick = () => speak(q.n);
      refreshVoiceUI();
    }
  }

  function bindInput(q: Question, forward: boolean) {
    const field = required('#answer', HTMLInputElement);
    field.value = q.draft;
    field.oninput = () => {
      q.draft = field.value;
      required('#input-error', HTMLElement).textContent = '';
    };
    required('#answer-form', HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      answer(field.value);
    };
    if (!forward) return;
    const keyboard = required('#keyboard', HTMLElement);
    const toggle = required('#keyboard-toggle', HTMLButtonElement);
    toggle.onclick = () => {
      keyboard.hidden = !keyboard.hidden;
      toggle.setAttribute('aria-expanded', String(!keyboard.hidden));
    };
    keyboard.innerHTML =
      HEBREW_LETTERS.map((c) => `<button type="button" data-key="${c}" lang="he">${c}</button>`).join('') +
      '<button type="button" class="wide" data-key=" ">רווח · пробел</button><button type="button" class="wide" data-key="back">Удалить</button>';
    for (const b of keyboard.querySelectorAll<HTMLButtonElement>('[data-key]')) {
      // Keep focus (and the caret) in the text field.
      b.onmousedown = (e) => e.preventDefault();
      b.onclick = () => {
        if (answered) return;
        const start = field.selectionStart ?? field.value.length;
        const end = field.selectionEnd ?? start;
        const back = b.dataset.key === 'back';
        field.setRangeText(back ? '' : (b.dataset.key ?? ''), back && start === end ? Math.max(0, start - 1) : start, end, 'end');
        q.draft = field.value;
        field.focus({ preventScroll: true });
      };
    }
  }

  function answer(value: number | string) {
    if (answered || index >= ROUND_LENGTH) return;
    const q = current();
    const g = currentGender();
    let ok: boolean;
    if (method === 'input') {
      const raw = String(value).trim();
      const error = required('#input-error', HTMLElement);
      if (!raw) {
        error.textContent = 'Сначала введи ответ.';
        return;
      }
      if (direction === 'reverse' && !/^\d+$/.test(raw)) {
        error.textContent = 'Введи целое число цифрами, например 25.';
        return;
      }
      if (direction === 'forward' && !/[א-ת]/.test(raw)) {
        error.textContent = 'Напиши словами на иврите. Можно открыть клавиатуру ниже.';
        return;
      }
      ok = direction === 'forward' ? accepts(q.n, g, raw) : Number(raw) === q.n;
    } else {
      if (typeof value !== 'number' || !q.choices.includes(value)) return;
      ok = value === q.n;
    }
    answered = true;
    q.correct = ok;
    cancelPending();
    if (ok) {
      if (q.hint) helped++;
      else score++;
    } else errors.push(q.n);

    for (const b of game.querySelectorAll<HTMLButtonElement>('[data-number]')) {
      b.disabled = true;
      const n = Number(b.dataset.number);
      if (n === q.n) b.classList.add('correct');
      else if (n === value) b.classList.add('wrong');
    }
    if (method === 'input') {
      const field = required('#answer', HTMLInputElement);
      field.readOnly = true;
      field.classList.add(ok ? 'correct' : 'wrong');
      required('#answer-form button', HTMLButtonElement).disabled = true;
      const keyboard = document.querySelector<HTMLElement>('#keyboard');
      const toggle = document.querySelector<HTMLElement>('#keyboard-toggle');
      if (keyboard) keyboard.hidden = true;
      if (toggle) toggle.hidden = true;
    }
    required('#stats', HTMLElement).textContent = statsText();
    required('#hint', HTMLElement).hidden = true;
    required('#hinttext', HTMLElement).hidden = true;
    required('#feedback', HTMLElement).innerHTML =
      `<div class="feedback ${ok ? 'good' : 'bad'}"><strong>${ok ? (q.hint ? 'Верно, с подсказкой!' : 'Верно!') : 'Запомним правильный ответ:'}</strong>` +
      `<div class="correct-answer">${q.n} = ${he(words(q.n, g))}</div>` +
      '<button class="sound" id="listen">▶ Послушать ответ</button><p class="voice-status" id="voice-status" aria-live="polite"></p>' +
      `<div class="feedback-actions"><button class="primary" id="next">${nextLabel()}</button><button class="pause" id="pause">Пауза</button></div></div>`;
    // Remove the earlier playback controls so every ID remains unique.
    game.querySelector('.speech')?.remove();
    required('#listen', HTMLButtonElement).onclick = () => speak(q.n);
    refreshVoiceUI();
    required('#next', HTMLButtonElement).onclick = next;
    required('#pause', HTMLButtonElement).onclick = pauseAdvance;
    configureTimer();
  }

  function pauseAdvance() {
    clearTimeout(timer);
    timer = undefined;
    required('#next', HTMLElement).textContent = nextLabel();
    const pause = required('#pause', HTMLButtonElement);
    pause.textContent = 'На паузе';
    pause.disabled = true;
  }

  function configureTimer() {
    clearTimeout(timer);
    timer = undefined;
    if (!answered || index >= ROUND_LENGTH) return;
    const q = current();
    const pause = required('#pause', HTMLButtonElement);
    pause.hidden = !auto.checked;
    pause.disabled = false;
    pause.textContent = 'Пауза';
    required('#next', HTMLElement).textContent = nextLabel() + (auto.checked ? ` · ${q.correct ? '1,5' : '3'} с` : '');
    if (auto.checked) timer = setTimeout(next, q.correct ? CORRECT_DELAY : WRONG_DELAY);
  }

  function next() {
    if (!answered) return;
    cancelPending();
    index++;
    answered = false;
    render();
  }

  function showResult() {
    const g = currentGender();
    const review = [...new Set([...errors, ...deck.filter((q) => q.hint).map((q) => q.n)])];
    game.innerHTML =
      `<div class="result"><div class="medal">${score >= 8 ? '✦' : '123'}</div><h1>${score === ROUND_LENGTH ? 'Все десять — самостоятельно!' : 'Раунд завершён'}</h1>` +
      `<div class="big">${score}<span style="font-size:20px"> / ${ROUND_LENGTH}</span></div>` +
      `<div class="result-counts"><span>Самостоятельно: ${score}</span><span>С подсказкой: ${helped}</span><span>Ошибки: ${errors.length}</span></div>` +
      '<button class="primary" id="again">Ещё 10 вопросов</button>' +
      (review.length
        ? `<div class="review"><b>Повтори эти числа</b>${review.map((n) => `<p><b>${n}</b>${he(words(n, g))}</p>`).join('')}</div>`
        : '') +
      '</div>';
    required('#again', HTMLButtonElement).onclick = begin;
  }

  function refreshVoiceUI() {
    const button = document.querySelector<HTMLButtonElement>('#listen');
    const status = document.querySelector('#voice-status');
    if (!button || !status) return;
    button.disabled = !voice;
    status.textContent = voice
      ? ''
      : 'Нет доступного голоса иврита. Добавь его в настройках синтеза речи устройства; поддержка зависит от браузера.';
  }

  function speak(n: number) {
    voice = findHebrewVoice(speech);
    refreshVoiceUI();
    if (!voice || !speech) return;
    // Listening after answering pauses the countdown, leaving time to hear and read.
    if (answered) pauseAdvance();
    const call = ++speechId;
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(words(n, currentGender(), true));
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = SPEECH_RATE;
    utterance.onerror = () => {
      const status = document.querySelector('#voice-status');
      if (call === speechId && status) status.textContent = 'Не удалось озвучить. Попробуй ещё раз или выбери другой браузер.';
    };
    speech.speak(utterance);
  }

  const onVoicesChanged = () => {
    voice = findHebrewVoice(speech);
    refreshVoiceUI();
  };

  for (const b of document.querySelectorAll<HTMLElement>('[data-direction]')) {
    b.onclick = () => {
      direction = b.dataset.direction === 'reverse' ? 'reverse' : 'forward';
      begin();
    };
  }
  for (const b of document.querySelectorAll<HTMLElement>('[data-method]')) {
    b.onclick = () => {
      method = b.dataset.method === 'input' ? 'input' : 'choice';
      begin();
    };
  }
  level.onchange = begin;
  gender.onchange = begin;
  auto.onchange = configureTimer;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width:761px)').matches) settings.open = true;
  voice = findHebrewVoice(speech);
  speech?.addEventListener('voiceschanged', onVoicesChanged);
  window.addEventListener('pagehide', cancelPending);
  begin();

  return () => {
    cancelPending();
    speech?.removeEventListener('voiceschanged', onVoicesChanged);
    window.removeEventListener('pagehide', cancelPending);
  };
}
