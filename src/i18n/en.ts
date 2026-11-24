import { plural } from './plural';

// English is the default locale and defines the shape of every message set.
// Plain string messages can be used in index.html via data-i18n / data-i18n-label.
export const en = {
  title: 'Misparim · Hebrew numbers',
  description: 'Hebrew numbers trainer: digits and words, picking or typing the answer, speech. From 1 to 999, and the time on a clock.',
  brand: 'misparím',
  tagline: 'HEBREW NUMBERS',
  headerNote: 'From digits to words. And back.',
  languageLabel: 'Language',
  directionLabel: 'Direction',
  forwardHint: 'Digits → words',
  reverseHint: 'Words → digits',
  clockHint: 'Clock → words',
  settingsTitle: 'Practice settings',
  rangeLabel: 'Range',
  level1: '1–10 · first numbers',
  level2: '10–100 · tens',
  level3: '100–999 · hundreds',
  genderLabel: 'Number form',
  genderF: 'Feminine · plain counting',
  genderM: 'Masculine',
  clockLevelLabel: 'Precision',
  clockQuarters: 'Quarters and halves',
  clockFive: 'Every 5 minutes',
  autoLabel: 'Move on automatically',
  settingNote: 'Changing the range or the form starts a new round.',
  genderNote:
    'Without a noun, numbers are said in the feminine form. Masculine forms are practiced separately. Forms used before a noun, such as שני / שתי, are not used here.',
  clockSettingNote: 'Changing the precision starts a new round.',
  clockNote:
    'Hours are said in the feminine form, as שעה (“hour”) is feminine. Minutes are said in the masculine form, as in everyday speech. After the half hour, the minutes are counted to the next hour: רבע לארבע is 3:45.',
  guideTitle: 'Recognize first, then recall',
  guideChoice: 'Pick the answer from four options or type it yourself. 10 questions per round.',
  guidePause: 'Hints are counted separately. To read an explanation, pause the automatic advance.',
  methodLabel: 'Answer method',
  methodChoice: 'Pick an answer',
  methodInput: 'Type an answer',
  footerNumbers: 'Numbers 1–999',
  footerFont: 'Noto Sans Hebrew font / OFL',
  checkingTitle: 'How answers are checked',
  checkingText:
    'Words are typed in Hebrew. Niqqud and extra spaces do not affect the check. Common full and short spellings are accepted. The form must match the selected setting. In compound numbers, keep the conjunction ו (“and”).',
  checkingClock:
    'Time: hours in the feminine form, minutes in the masculine, or in the feminine with דקות (“minutes”). You may start with השעה (“the time is”) and add בדיוק (“exactly”) after a whole hour.',
  rulesLabel: 'Rules:',
  rulesOrt: 'ORT study materials (in Russian)',
  rulesHundreds: 'hundreds and compound numbers (in Russian)',
  speechNote: 'The synthesizer may pronounce numbers inaccurately; quality depends on the device voice.',

  question: (n: number, total: number) => `Question ${n} of ${total}`,
  feminineForm: 'Feminine form',
  masculineForm: 'Masculine form',
  ownCount: (n: number) => `On your own: ${n}`,
  hintedCount: (n: number) => `With a hint: ${n}`,
  errorCount: (n: number) => `Mistakes: ${n}`,
  progressLabel: 'Questions completed',
  promptForward: 'How is this number written in Hebrew?',
  promptReverse: 'What number is this?',
  promptClock: 'What time does the clock show?',
  clockLabel: (time: string) => `Clock showing ${time}`,
  listen: '▶ Listen',
  listenAnswer: '▶ Listen to the answer',
  inputForward: 'Write the number in Hebrew words',
  inputReverse: 'Enter the number in digits',
  inputClock: 'Write the time in Hebrew words',
  check: 'Check',
  keyboard: 'Keyboard א–ת',
  space: 'space',
  backspace: 'Delete',
  hint: 'Hint',
  hintFirstLetter: (letter: string, feminine: boolean) =>
    `The word starts with ${letter}. Recall the ${feminine ? 'feminine' : 'masculine'} form.`,
  hintStartWith: (word: string) => `Start with “${word}”. Order: hundreds, tens, units. Put ו (“and”) before the last part.`,
  hintParity: (odd: boolean) => `It is an ${odd ? 'odd' : 'even'} number from 1–10.`,
  hintTens: (from: number, to: number) => `A number from ${from} to ${to}. The conjunction ו means “and”.`,
  hintHundreds: (h: number) =>
    `The number has ${h} ${plural('en', h, { one: 'hundred', other: 'hundreds' })}. Read the part after the hundreds.`,
  hintClock: (time: string, minutes: number) =>
    `It is ${time}. ` +
    (minutes === 0
      ? 'A whole hour is just its number, in the feminine form.'
      : minutes <= 30
        ? 'Say the hour, then add the minutes with ו (“and”).'
        : 'Count the minutes left to the next hour and put ל (“to”) before it.'),
  errorEmpty: 'Enter an answer first.',
  errorDigits: 'Enter a whole number in digits, for example 25.',
  errorHebrew: 'Write it in Hebrew words. You can open the keyboard below.',
  correct: 'Correct!',
  correctWithHint: 'Correct, with a hint!',
  rememberAnswer: 'Remember the right answer:',
  next: 'Next',
  result: 'Results',
  seconds: (s: number) => `${new Intl.NumberFormat('en').format(s)} s`,
  pause: 'Pause',
  paused: 'Paused',
  perfectRound: 'All ten on your own!',
  roundOver: 'Round complete',
  again: '10 more questions',
  review: 'Review these numbers',
  noVoice: 'No Hebrew voice is available. Add one in your device’s speech settings; support depends on the browser.',
  speechError: 'Could not play the speech. Try again or use another browser.',
};

export type Messages = typeof en;
