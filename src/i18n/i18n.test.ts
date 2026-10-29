// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectLocale, isLocale, LOCALES, messages, staticText } from './index';
import { plural } from './plural';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const keysIn = (attribute: string) => [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((m) => m[1] ?? '');

describe('detectLocale', () => {
  it('prefers the saved locale', () => {
    expect(detectLocale('uk', ['ru-RU'])).toBe('uk');
  });

  it('takes the first supported browser language', () => {
    expect(detectLocale(null, ['ru-RU', 'en'])).toBe('ru');
    expect(detectLocale(null, ['de-DE', 'uk-UA', 'ru'])).toBe('uk');
    expect(detectLocale(null, ['en-GB', 'ru'])).toBe('en');
    expect(detectLocale(null, ['RU'])).toBe('ru');
  });

  it('falls back to English', () => {
    expect(detectLocale(null, [])).toBe('en');
    expect(detectLocale(null, ['de-DE', 'he-IL'])).toBe('en');
    expect(detectLocale('xx', ['de'])).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(LOCALES.every(isLocale)).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('messages', () => {
  it('have the same keys in every locale', () => {
    const keys = Object.keys(messages.en).toSorted();
    for (const locale of LOCALES) expect(Object.keys(messages[locale]).toSorted()).toEqual(keys);
  });

  it.each(LOCALES)('cover every text in index.html (%s)', (locale) => {
    const keys = [...keysIn('data-i18n'), ...keysIn('data-i18n-label')];
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect({ key, text: staticText(messages[locale], key) }).toEqual({ key, text: expect.any(String) });
  });

  it('do not have static texts for unknown keys or functions', () => {
    expect(staticText(messages.en, 'missing')).toBeUndefined();
    expect(staticText(messages.en, 'question')).toBeUndefined();
  });

  it('match the English defaults in index.html', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const el of doc.querySelectorAll<HTMLElement>('[data-i18n]')) {
      // Prettier may wrap long texts in index.html.
      expect(el.textContent.replace(/\s+/g, ' ').trim()).toBe(staticText(messages.en, el.dataset.i18n ?? ''));
    }
  });

  it('format plural forms', () => {
    expect(messages.en.hintHundreds(1)).toContain('1 hundred.');
    expect(messages.en.hintHundreds(3)).toContain('3 hundreds.');
    expect(messages.ru.hintHundreds(1)).toContain('1 сотня');
    expect(messages.ru.hintHundreds(3)).toContain('3 сотни');
    expect(messages.ru.hintHundreds(5)).toContain('5 сотен');
    expect(messages.uk.hintHundreds(4)).toContain('4 сотні');
    expect(messages.uk.hintHundreds(9)).toContain('9 сотень');
  });

  it('format seconds with the locale decimal separator', () => {
    expect(messages.en.seconds(1.5)).toBe('1.5 s');
    expect(messages.ru.seconds(1.5)).toBe('1,5 с');
    expect(messages.uk.seconds(3)).toBe('3 с');
  });
});

describe('plural', () => {
  it('picks the form by the locale rules', () => {
    const forms = { one: 'one', few: 'few', many: 'many', other: 'other' };
    expect(plural('ru', 1, forms)).toBe('one');
    expect(plural('ru', 21, forms)).toBe('one');
    expect(plural('ru', 2, forms)).toBe('few');
    expect(plural('ru', 11, forms)).toBe('many');
    expect(plural('en', 2, forms)).toBe('other');
  });

  it('falls back to the other form', () => {
    expect(plural('ru', 5, { one: 'one', other: 'other' })).toBe('other');
  });
});
