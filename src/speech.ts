export type Speech = Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel' | 'addEventListener' | 'removeEventListener'>;

export function isHebrewVoice(voice: Pick<SpeechSynthesisVoice, 'lang'>): boolean {
  return /^(he|iw)(-|_|$)/i.test(voice.lang);
}

/** First installed Hebrew voice; quality and availability depend on the browser and device. */
export function findHebrewVoice(speech: Speech | null): SpeechSynthesisVoice | null {
  return speech?.getVoices().find(isHebrewVoice) ?? null;
}

/** The browser's speech synthesizer, or null when it is not supported. */
export function browserSpeech(): Speech | null {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;
}
