import { isolateHebrew } from './bidi';
import { createDeck, isLevel, ROUND_LENGTH, type Direction, type Level, type Method, type Question, type Random } from './game';
import { detectLocale, LOCALES, messages, staticText, type Locale, type Messages } from './i18n';
import { accepts, words, type Gender } from './numbers';
import { findHebrewVoice, type Speech } from './speech';
import { loadSettings, saveSettings, type KeyValueStorage, type Settings } from './storage';

export interface AppOptions {
  random?: Random;
  speech?: Speech | null;
  storage?: KeyValueStorage | null;
  /** Preferred browser languages, most preferred first. */
  languages?: readonly string[];
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

function hintText(t: Messages, n: number, forward: boolean, gender: Gender): string {
  if (forward) {
    const text = words(n, gender);
    return n <= 10 ? t.hintFirstLetter(text[0] ?? '', gender === 'f') : t.hintStartWith(text.split(' ')[0] ?? '');
  }
  if (n <= 10) return t.hintParity(n % 2 === 1);
  const tens = Math.floor(n / 10) * 10;
  if (n < 100) return t.hintTens(tens, tens + 9);
  return t.hintHundreds(Math.floor(n / 100));
}

/** Translates the static page: texts and labels marked in index.html, title, description and lang. */
function translatePage(locale: Locale, t: Messages) {
  document.documentElement.lang = locale;
  document.title = t.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t.description);
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const text = staticText(t, el.dataset.i18n ?? '');
    if (text === undefined) continue;
    el.textContent = text;
    isolateHebrew(el);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const text = staticText(t, el.dataset.i18nLabel ?? '');
    if (text !== undefined) el.setAttribute('aria-label', text);
  }
  markActive('locale', locale);
}

/** Starts the game on the current page; returns a function that removes global listeners. */
export function startApp({ random = Math.random, speech = null, storage = null, languages = [] }: AppOptions = {}): () => void {
  const game = required('#game', HTMLElement);
  const level = required('#level', HTMLSelectElement);
  const gender = required('#gender', HTMLSelectElement);
  const auto = required('#auto', HTMLInputElement);
  const settingsPanel = required('#settings', HTMLDetailsElement);

  let settings: Settings = loadSettings(storage);
  let locale: Locale = detectLocale(settings.locale, languages);
  let t: Messages = messages[locale];
  let direction: Direction = 'forward';
  let method: Method = 'choice';
  let deck: Question[] = [];
  let index = 0;
  let score = 0;
  let helped = 0;
  let errors: number[] = [];
  let answered = false;
  let paused = false;
  let keyboardOpen = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let voice: SpeechSynthesisVoice | null = null;
  let speechId = 0;

  level.value = settings.level;
  gender.value = settings.gender;
  auto.checked = settings.autoNext;

  const currentLevel = (): Level => (isLevel(level.value) ? level.value : '1');
  const currentGender = (): Gender => (gender.value === 'm' ? 'm' : 'f');
  const isLast = () => index === ROUND_LENGTH - 1;
  const nextLabel = () => (isLast() ? t.result : t.next);
  const statsText = () => [t.ownCount(score), t.hintedCount(helped), t.errorCount(errors.length)].join(' · ');
  const current = (): Question => {
    const q = deck[index];
    if (!q) throw new Error('No current question');
    return q;
  };

  function updateSettings(changes: Partial<Settings>) {
    settings = { ...settings, ...changes };
    saveSettings(storage, settings);
  }

  function setLocale(value: Locale) {
    locale = value;
    t = messages[locale];
    updateSettings({ locale });
    translatePage(locale, t);
    render();
  }

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
    keyboardOpen = false;
    render();
  }

  /** Draws the current screen from the game state, so it can be redrawn in another language. */
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
      `<form id="answer-form"><label class="answer-label" for="answer">${forward ? t.inputForward : t.inputReverse}</label>` +
      `<div class="input-row"><input id="answer" type="text" ${forward ? 'lang="he" dir="rtl" class="he"' : 'inputmode="numeric" dir="ltr"'} autocomplete="off" spellcheck="false" maxlength="100" enterkeyhint="done" aria-describedby="input-error">` +
      `<button type="submit" class="primary">${t.check}</button></div><p id="input-error" class="error" aria-live="polite"></p></form>` +
      (forward
        ? `<button class="keyboard-toggle" id="keyboard-toggle" aria-expanded="false" aria-controls="keyboard">${t.keyboard}</button><div class="keyboard" id="keyboard" hidden></div>`
        : '');
    game.innerHTML =
      `<div class="round"><span>${t.question(index + 1, ROUND_LENGTH)}</span><span class="tag">${g === 'f' ? t.feminineForm : t.masculineForm}</span></div>` +
      `<div class="stats" id="stats">${statsText()}</div>` +
      `<div class="progress" role="progressbar" aria-label="${t.progressLabel}" aria-valuemin="0" aria-valuemax="${ROUND_LENGTH}" aria-valuenow="${index}"><i style="width:${(index * 100) / ROUND_LENGTH}%"></i></div>` +
      `<h1 class="prompt">${forward ? t.promptForward : t.promptReverse}</h1>` +
      `<div class="stimulus ${forward ? '' : 'he'}" ${forward ? '' : 'lang="he" dir="rtl"'}>${forward ? q.n : text}</div>` +
      (forward
        ? ''
        : `<div class="speech"><button class="sound" id="listen">${t.listen}</button><p class="voice-status" id="voice-status" aria-live="polite"></p></div>`) +
      (method === 'choice' ? choiceHTML : inputHTML) +
      `<div id="feedback" aria-live="polite"></div><button class="hint" id="hint">${t.hint}</button><p class="hinttext" id="hinttext" hidden></p>`;

    for (const b of game.querySelectorAll<HTMLButtonElement>('[data-number]')) b.onclick = () => answer(Number(b.dataset.number));
    if (method === 'input') bindInput(q, forward);
    const hint = required('#hinttext', HTMLElement);
    const showHint = () => {
      hint.hidden = false;
      hint.textContent = hintText(t, q.n, forward, g);
      isolateHebrew(hint);
    };
    required('#hint', HTMLButtonElement).onclick = () => {
      if (answered) return;
      q.hint = true;
      showHint();
    };
    if (q.hint) showHint();
    if (!forward) {
      required('#listen', HTMLButtonElement).onclick = () => speak(q.n);
      refreshVoiceUI();
    }
    if (answered) showAnswer(q);
    isolateHebrew(game);
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
      q.draft = field.value;
      answer(field.value);
    };
    if (!forward) return;
    const keyboard = required('#keyboard', HTMLElement);
    const toggle = required('#keyboard-toggle', HTMLButtonElement);
    const showKeyboard = (open: boolean) => {
      keyboardOpen = open;
      keyboard.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.onclick = () => showKeyboard(!keyboardOpen);
    showKeyboard(keyboardOpen);
    keyboard.innerHTML =
      HEBREW_LETTERS.map((c) => `<button type="button" data-key="${c}" lang="he">${c}</button>`).join('') +
      `<button type="button" class="wide" data-key=" ">רווח · ${t.space}</button><button type="button" class="wide" data-key="back">${t.backspace}</button>`;
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
    let ok: boolean;
    if (method === 'input') {
      const raw = String(value).trim();
      const error = required('#input-error', HTMLElement);
      if (!raw) {
        error.textContent = t.errorEmpty;
        return;
      }
      if (direction === 'reverse' && !/^\d+$/.test(raw)) {
        error.textContent = t.errorDigits;
        return;
      }
      if (direction === 'forward' && !/[א-ת]/.test(raw)) {
        error.textContent = t.errorHebrew;
        return;
      }
      ok = direction === 'forward' ? accepts(q.n, currentGender(), raw) : Number(raw) === q.n;
    } else {
      if (typeof value !== 'number' || !q.choices.includes(value)) return;
      q.picked = value;
      ok = value === q.n;
    }
    answered = true;
    q.correct = ok;
    cancelPending();
    if (ok) {
      if (q.hint) helped++;
      else score++;
    } else errors.push(q.n);
    showAnswer(q);
    configureTimer();
  }

  /** Shows the answered state of the current question: marked answer, feedback and the next/pause buttons. */
  function showAnswer(q: Question) {
    for (const b of game.querySelectorAll<HTMLButtonElement>('[data-number]')) {
      b.disabled = true;
      const n = Number(b.dataset.number);
      if (n === q.n) b.classList.add('correct');
      else if (n === q.picked) b.classList.add('wrong');
    }
    if (method === 'input') {
      const field = required('#answer', HTMLInputElement);
      field.readOnly = true;
      field.classList.add(q.correct ? 'correct' : 'wrong');
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
      `<div class="feedback ${q.correct ? 'good' : 'bad'}"><strong>${q.correct ? (q.hint ? t.correctWithHint : t.correct) : t.rememberAnswer}</strong>` +
      `<div class="correct-answer">${q.n} = ${he(words(q.n, currentGender()))}</div>` +
      `<button class="sound" id="listen">${t.listenAnswer}</button><p class="voice-status" id="voice-status" aria-live="polite"></p>` +
      `<div class="feedback-actions"><button class="primary" id="next"></button><button class="pause" id="pause"></button></div></div>`;
    // Remove the earlier playback controls so every ID remains unique.
    game.querySelector('.speech')?.remove();
    required('#listen', HTMLButtonElement).onclick = () => speak(q.n);
    refreshVoiceUI();
    required('#next', HTMLButtonElement).onclick = next;
    required('#pause', HTMLButtonElement).onclick = pauseAdvance;
    updateAdvanceButtons();
  }

  function updateAdvanceButtons() {
    const nextButton = document.querySelector('#next');
    const pause = document.querySelector<HTMLButtonElement>('#pause');
    if (!nextButton || !pause) return;
    pause.hidden = !auto.checked;
    pause.disabled = paused;
    pause.textContent = paused ? t.paused : t.pause;
    const delay = current().correct ? CORRECT_DELAY : WRONG_DELAY;
    nextButton.textContent = nextLabel() + (timer === undefined ? '' : ` · ${t.seconds(delay / 1000)}`);
  }

  function pauseAdvance() {
    clearTimeout(timer);
    timer = undefined;
    paused = true;
    updateAdvanceButtons();
  }

  function configureTimer() {
    clearTimeout(timer);
    timer = undefined;
    paused = false;
    if (!answered || index >= ROUND_LENGTH) return;
    if (auto.checked) timer = setTimeout(next, current().correct ? CORRECT_DELAY : WRONG_DELAY);
    updateAdvanceButtons();
  }

  function next() {
    if (!answered) return;
    cancelPending();
    index++;
    answered = false;
    keyboardOpen = false;
    render();
  }

  function showResult() {
    const g = currentGender();
    const review = [...new Set([...errors, ...deck.filter((q) => q.hint).map((q) => q.n)])];
    game.innerHTML =
      `<div class="result"><div class="medal">${score >= 8 ? '✦' : '123'}</div><h1>${score === ROUND_LENGTH ? t.perfectRound : t.roundOver}</h1>` +
      `<div class="big">${score}<span style="font-size:20px"> / ${ROUND_LENGTH}</span></div>` +
      `<div class="result-counts"><span>${t.ownCount(score)}</span><span>${t.hintedCount(helped)}</span><span>${t.errorCount(errors.length)}</span></div>` +
      `<button class="primary" id="again">${t.again}</button>` +
      (review.length
        ? `<div class="review"><b>${t.review}</b>${review.map((n) => `<p><b>${n}</b>${he(words(n, g))}</p>`).join('')}</div>`
        : '') +
      '</div>';
    required('#again', HTMLButtonElement).onclick = begin;
    isolateHebrew(game);
  }

  function refreshVoiceUI() {
    const button = document.querySelector<HTMLButtonElement>('#listen');
    const status = document.querySelector('#voice-status');
    if (!button || !status) return;
    button.disabled = !voice;
    status.textContent = voice ? '' : t.noVoice;
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
      if (call === speechId && status) status.textContent = t.speechError;
    };
    speech.speak(utterance);
  }

  const onVoicesChanged = () => {
    voice = findHebrewVoice(speech);
    refreshVoiceUI();
  };

  for (const b of document.querySelectorAll<HTMLElement>('[data-locale]')) {
    b.onclick = () => {
      const picked = LOCALES.find((l) => l === b.dataset.locale);
      if (picked) setLocale(picked);
    };
  }
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
  level.onchange = () => {
    updateSettings({ level: currentLevel() });
    begin();
  };
  gender.onchange = () => {
    updateSettings({ gender: currentGender() });
    begin();
  };
  auto.onchange = () => {
    updateSettings({ autoNext: auto.checked });
    configureTimer();
  };
  if (typeof window.matchMedia === 'function' && window.matchMedia('(min-width:761px)').matches) settingsPanel.open = true;
  translatePage(locale, t);
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
