// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { isolateHebrew } from './bidi';

const root = () => document.body;
const hebrewSpans = () => [...document.querySelectorAll('span[lang="he"]')];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isolateHebrew', () => {
  it('wraps each Hebrew fragment in its own right-to-left span with the Hebrew font', () => {
    root().innerHTML = '<p>Forms such as שני / שתי are not used.</p>';
    isolateHebrew(root());
    expect(hebrewSpans().map((s) => s.textContent)).toEqual(['שני', 'שתי']);
    for (const span of hebrewSpans()) {
      expect(span.getAttribute('dir')).toBe('rtl');
      expect(span.classList.contains('he')).toBe(true);
    }
  });

  it('keeps the text unchanged', () => {
    const text = 'Keep the conjunction ו (“and”). Start with “שלוש מאות”.';
    root().innerHTML = `<p>${text}</p>`;
    isolateHebrew(root());
    expect(root().textContent).toBe(text);
  });

  it('keeps a Hebrew phrase with spaces, niqqud and maqaf in one span', () => {
    root().innerHTML = '<p>Say עֶשְׂרִים־וְאַחַת or מאה ועשרים here.</p>';
    isolateHebrew(root());
    expect(hebrewSpans().map((s) => s.textContent)).toEqual(['עֶשְׂרִים־וְאַחַת', 'מאה ועשרים']);
  });

  it('leaves text that is already marked as Hebrew alone', () => {
    root().innerHTML = '<button lang="he">אחת</button><span lang="he"><b>שתיים</b></span>';
    isolateHebrew(root());
    expect(hebrewSpans()).toHaveLength(1);
    expect(document.querySelector('button')?.innerHTML).toBe('אחת');
  });

  it('can run again on the same element', () => {
    root().innerHTML = '<p>שני / שתי</p>';
    isolateHebrew(root());
    isolateHebrew(root());
    expect(hebrewSpans()).toHaveLength(2);
  });

  it('does not touch text without Hebrew', () => {
    root().innerHTML = '<p>Question 1 of 10</p>';
    isolateHebrew(root());
    expect(root().innerHTML).toBe('<p>Question 1 of 10</p>');
  });
});
