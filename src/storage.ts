import { isClockLevel, type ClockLevel } from './clock';
import { isLevel, type Level } from './game';
import { isLocale, type Locale } from './i18n';
import { isGender, type Gender } from './numbers';

export interface Settings {
  /** The language picked in the switcher; null means detect from the browser. */
  locale: Locale | null;
  level: Level;
  gender: Gender;
  clockLevel: ClockLevel;
  autoNext: boolean;
}

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const STORAGE_KEY = 'misparim';
// A new field falls back to its default on older data, so it needs no new version.
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = { locale: null, level: '1', gender: 'f', clockLevel: 'quarters', autoNext: false };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Saved settings; unreadable data is replaced with defaults, field by field. */
export function loadSettings(storage: KeyValueStorage | null): Settings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== VERSION || !isRecord(data.settings)) return { ...DEFAULT_SETTINGS };
    const { locale, level, gender, clockLevel, autoNext } = data.settings;
    return {
      locale: isLocale(locale) ? locale : DEFAULT_SETTINGS.locale,
      level: isLevel(level) ? level : DEFAULT_SETTINGS.level,
      gender: isGender(gender) ? gender : DEFAULT_SETTINGS.gender,
      clockLevel: isClockLevel(clockLevel) ? clockLevel : DEFAULT_SETTINGS.clockLevel,
      autoNext: typeof autoNext === 'boolean' ? autoNext : DEFAULT_SETTINGS.autoNext,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: KeyValueStorage | null, settings: Settings): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, settings }));
  } catch {
    // Private mode or full storage: the game keeps working without saving.
  }
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
