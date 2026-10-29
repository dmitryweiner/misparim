import { describe, expect, it } from 'vitest';
import { findHebrewVoice, isHebrewVoice, type Speech } from './speech';

const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;
const speechWith = (voices: SpeechSynthesisVoice[]) => ({ getVoices: () => voices }) as unknown as Speech;

describe('isHebrewVoice', () => {
  it.each(['he', 'he-IL', 'iw_IL', 'HE-il'])('accepts %s', (lang) => {
    expect(isHebrewVoice({ lang })).toBe(true);
  });

  it.each(['en-US', 'hei', 'ru-RU', ''])('rejects %s', (lang) => {
    expect(isHebrewVoice({ lang })).toBe(false);
  });
});

describe('findHebrewVoice', () => {
  it('returns the first Hebrew voice', () => {
    const he = voice('he-IL');
    expect(findHebrewVoice(speechWith([voice('en-US'), he, voice('iw')]))).toBe(he);
  });

  it('returns null without speech support or Hebrew voices', () => {
    expect(findHebrewVoice(null)).toBeNull();
    expect(findHebrewVoice(speechWith([voice('en-US')]))).toBeNull();
  });
});
