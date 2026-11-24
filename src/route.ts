import { DIRECTIONS, type Direction } from './game';

const HASHES: Record<Direction, string> = { forward: '#number-first', reverse: '#word-first', clock: '#clock' };

/** The URL hash that opens the game in this direction. */
export function hashForDirection(direction: Direction): string {
  return HASHES[direction];
}

/** The direction named in the URL hash; anything else means digits first. */
export function directionFromHash(hash: string): Direction {
  return DIRECTIONS.find((direction) => HASHES[direction] === hash) ?? 'forward';
}
