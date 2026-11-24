import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, STORAGE_KEY, type KeyValueStorage } from './storage';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const broken: KeyValueStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
};

describe('settings storage', () => {
  it('returns defaults when nothing is saved or storage is unavailable', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps auto-advance off by default', () => {
    expect(DEFAULT_SETTINGS.autoNext).toBe(false);
  });

  it('saves and loads settings', () => {
    const storage = new MemoryStorage();
    const settings = { locale: 'uk', level: '3', gender: 'm', clockLevel: 'five', autoNext: false } as const;
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('ignores write errors', () => {
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
    expect(() => saveSettings(null, DEFAULT_SETTINGS)).not.toThrow();
  });

  it.each(['not json', '[]', '{"version":2,"settings":{"locale":"ru"}}', '{"version":1}'])('resets unreadable data: %s', (raw) => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces only invalid fields with defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, settings: { locale: 'de', level: '2', gender: 'x', clockLevel: 'minutes', autoNext: 'yes' } }),
    );
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, level: '2' });
  });

  it('starts the clock with quarters, also for settings saved before the clock', () => {
    expect(DEFAULT_SETTINGS.clockLevel).toBe('quarters');
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: { locale: 'ru', level: '3', gender: 'm', autoNext: true } }));
    expect(loadSettings(storage)).toEqual({ locale: 'ru', level: '3', gender: 'm', clockLevel: 'quarters', autoNext: true });
  });

  it('replaces the removed whole-hours precision with quarters', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: { locale: 'uk', clockLevel: 'hours', autoNext: true } }));
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, locale: 'uk', clockLevel: 'quarters', autoNext: true });
  });
});
