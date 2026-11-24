import { handAngles } from './clock';

// Drawn in a 200×200 box around the centre; each hand and tick is a vertical line turned around it.
const C = 100;
const NUMERAL_RADIUS = 72;

const turned = (angle: number) => `transform="rotate(${angle} ${C} ${C})"`;

/** SVG markup of an analog clock showing the time; the label names it for screen readers. */
export function clockFace(time: number, label: string): string {
  const { hour, minute } = handAngles(time);
  const ticks = Array.from({ length: 60 }, (_, i) =>
    i % 5
      ? `<line class="tick" x1="${C}" y1="8" x2="${C}" y2="13" ${turned(i * 6)}/>`
      : `<line class="tick major" x1="${C}" y1="8" x2="${C}" y2="18" ${turned(i * 6)}/>`,
  ).join('');
  const numerals = Array.from({ length: 12 }, (_, i) => {
    const angle = ((i + 1) * Math.PI) / 6;
    const x = C + NUMERAL_RADIUS * Math.sin(angle);
    const y = C - NUMERAL_RADIUS * Math.cos(angle);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${i + 1}</text>`;
  }).join('');
  return (
    `<svg class="clock-face" viewBox="0 0 200 200" role="img" aria-label="${label}">` +
    `<circle class="dial" cx="${C}" cy="${C}" r="96"/>${ticks}${numerals}` +
    `<line class="hand hour-hand" x1="${C}" y1="${C + 10}" x2="${C}" y2="50" ${turned(hour)}/>` +
    `<line class="hand minute-hand" x1="${C}" y1="${C + 14}" x2="${C}" y2="20" ${turned(minute)}/>` +
    `<circle class="pin" cx="${C}" cy="${C}" r="5"/></svg>`
  );
}
