export type Gender = 'f' | 'm';

export const MIN_NUMBER = 1;
export const MAX_NUMBER = 999;

// Index = number; index 0 is unused.
const feminine = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
const masculine = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];
const feminineVocalized = ['', 'אַחַת', 'שְׁתַּיִם', 'שָׁלוֹשׁ', 'אַרְבַּע', 'חָמֵשׁ', 'שֵׁשׁ', 'שֶׁבַע', 'שְׁמוֹנֶה', 'תֵּשַׁע', 'עֶשֶׂר'];
const masculineVocalized = [
  '',
  'אֶחָד',
  'שְׁנַיִם',
  'שְׁלוֹשָׁה',
  'אַרְבָּעָה',
  'חֲמִשָּׁה',
  'שִׁשָּׁה',
  'שִׁבְעָה',
  'שְׁמוֹנָה',
  'תִּשְׁעָה',
  'עֲשָׂרָה',
];
// Units in 11–19 take a different vocalization than standalone units.
const feminineTeenUnits = ['', 'אַחַת', 'שְׁתֵּים', 'שְׁלוֹשׁ', 'אַרְבַּע', 'חֲמֵשׁ', 'שֵׁשׁ', 'שְׁבַע', 'שְׁמוֹנֶה', 'תְּשַׁע'];
const masculineTeenUnits = ['', 'אַחַד', 'שְׁנֵים', ...masculineVocalized.slice(3, 10)];
const tens = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const tensVocalized = [
  '',
  '',
  'עֶשְׂרִים',
  'שְׁלוֹשִׁים',
  'אַרְבָּעִים',
  'חֲמִשִּׁים',
  'שִׁשִּׁים',
  'שִׁבְעִים',
  'שְׁמוֹנִים',
  'תִּשְׁעִים',
];
const hundredsVocalized = [
  '',
  'מֵאָה',
  'מָאתַיִם',
  'שְׁלוֹשׁ מֵאוֹת',
  'אַרְבַּע מֵאוֹת',
  'חֲמֵשׁ מֵאוֹת',
  'שֵׁשׁ מֵאוֹת',
  'שְׁבַע מֵאוֹת',
  'שְׁמוֹנֶה מֵאוֹת',
  'תְּשַׁע מֵאוֹת',
];

// Common spelling variants mapped to the forms used by words().
const spellingVariants: Record<string, string> = {
  שתים: 'שתיים',
  שנים: 'שניים',
  שלש: 'שלוש',
  שלשה: 'שלושה',
  חמשה: 'חמישה',
  ששה: 'שישה',
  שמנה: 'שמונה',
  מאתים: 'מאתיים',
  שלשים: 'שלושים',
  חמשים: 'חמישים',
  ששים: 'שישים',
  שמנים: 'שמונים',
};

function at(list: readonly string[], i: number): string {
  const word = list[i];
  if (word === undefined) throw new Error(`No word at index ${i}`);
  return word;
}

/** Prefixes the conjunction ו ("and"); vocalized as וּ before a shva, otherwise וְ. */
function withAnd(word: string, vocalized: boolean): string {
  if (!vocalized) return 'ו' + word;
  return (word.startsWith('שְׁ') ? 'וּ' : 'וְ') + word;
}

/** Hebrew spelling of a number from 1 to 999, optionally with niqqud. */
export function words(n: number, gender: Gender = 'f', vocalized = false): string {
  if (!Number.isInteger(n) || n < MIN_NUMBER || n > MAX_NUMBER || !['f', 'm'].includes(gender)) {
    throw new Error('Invalid number or gender');
  }
  const units = gender === 'f' ? (vocalized ? feminineVocalized : feminine) : vocalized ? masculineVocalized : masculine;
  if (n <= 10) return at(units, n);
  if (n < 20) {
    const k = n - 10;
    const first = vocalized
      ? at(gender === 'f' ? feminineTeenUnits : masculineTeenUnits, k)
      : k === 2
        ? gender === 'f'
          ? 'שתים'
          : 'שנים'
        : at(units, k);
    const ten = gender === 'f' ? (vocalized ? 'עֶשְׂרֵה' : 'עשרה') : vocalized ? 'עָשָׂר' : 'עשר';
    return first + ' ' + ten;
  }
  if (n < 100) {
    const ten = at(vocalized ? tensVocalized : tens, Math.floor(n / 10));
    return ten + (n % 10 ? ' ' + withAnd(at(units, n % 10), vocalized) : '');
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  // Hundreds are always feminine: שלוש מאות.
  const head = vocalized ? at(hundredsVocalized, h) : h === 1 ? 'מאה' : h === 2 ? 'מאתיים' : at(feminine, h) + ' מאות';
  if (!rest) return head;
  const tail = words(rest, gender, vocalized);
  return head + ' ' + (rest < 20 || rest % 10 === 0 ? withAnd(tail, vocalized) : tail);
}

/** Strips niqqud, direction marks and extra spaces; unifies spelling variants. */
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[֑-ֽֿ-ׇ]/g, '')
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/[-־–—]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((token) => {
      const prefix = token.startsWith('ו') ? 'ו' : '';
      const word = prefix ? token.slice(1) : token;
      return prefix + (spellingVariants[word] ?? word);
    })
    .join(' ');
}

/** Whether the input is an accepted spelling of n in the given gender. */
export function accepts(n: number, gender: Gender, input: string): boolean {
  const value = normalize(input);
  const forms = [words(n, gender), words(n, gender, true)];
  const rest = n % 100;
  // Also accept ו before the tens: מאה ועשרים ואחת for 121.
  if (n > 100 && rest >= 20 && rest % 10 !== 0) forms.push(words(n - rest, gender) + ' ו' + words(rest, gender));
  return forms.some((form) => normalize(form) === value);
}
