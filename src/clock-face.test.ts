// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { clockFace } from './clock-face';

function render(time: number, label = 'Clock showing 3:45'): SVGSVGElement {
  const root = document.createElement('div');
  root.innerHTML = clockFace(time, label);
  const svg = root.querySelector('svg');
  if (!svg) throw new Error('no svg');
  return svg;
}

const rotation = (svg: SVGSVGElement, selector: string) => svg.querySelector(selector)?.getAttribute('transform');

describe('clockFace', () => {
  it('is an image labelled for screen readers', () => {
    const svg = render(225);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Clock showing 3:45');
  });

  it('has the numerals 1–12 and a tick for every minute', () => {
    const svg = render(0);
    expect([...svg.querySelectorAll('text')].map((t) => t.textContent)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    expect(svg.querySelectorAll('.tick')).toHaveLength(60);
    expect(svg.querySelectorAll('.tick.major')).toHaveLength(12);
  });

  it('turns the hands to the time', () => {
    const svg = render(225);
    expect(rotation(svg, '.hour-hand')).toBe('rotate(112.5 100 100)');
    expect(rotation(svg, '.minute-hand')).toBe('rotate(270 100 100)');
  });
});
