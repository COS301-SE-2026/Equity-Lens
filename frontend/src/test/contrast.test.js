/**
 * WCAG contrast evidence for the text tokens, in both themes.
 *
 * This reads globals.css rather than a copy of the values, so it keeps telling the truth after
 * someone edits a token. It is an NFR artefact as much as a test: run it with
 * `npx vitest run src/test/contrast.test.js` and the table it prints is the measurement.
 *
 * The maths is WCAG 2.1's own: sRGB -> linear -> relative luminance L, then
 * (Llighter + 0.05) / (Ldarker + 0.05). Text tokens are rgba, so each one is first composited
 * over --surface-card, which is opaque in both themes (#0A0A0A and #FFFFFF).
 */
// node:fs rather than an `import ... from '*.css?raw'`: vite's css pipeline short-circuits raw
// css imports under vitest and hands back an empty string, which measures nothing
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

// comments are stripped before anything is parsed: a comment that mentions a token by name,
// as the --cta-emphasis one does, otherwise reads as a declaration running to the next
// semicolon and swallows the real declaration underneath it
const CSS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../styles/globals.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const AA_NORMAL_TEXT = 4.5;
// WCAG 1.4.11: a graphic that carries meaning has to clear 3:1 against what is behind it
const AA_NON_TEXT = 3;
const DISABLED = '--text-disabled';
const NOT_ON_CARDS = ['--text-on-accent', '--text-page', '--text-page-secondary'];

/** @param {string} selector the block to read, e.g. ':root' */
function tokensIn(selector) {
  // prettier writes attribute selectors with single quotes, so accept either spelling
  const variants = [selector, selector.replaceAll('"', "'")];
  const start = variants.map((v) => CSS.indexOf(`${v} {`)).find((i) => i !== -1) ?? -1;
  if (start === -1) throw new Error(`no ${selector} block in globals.css`);
  const block = CSS.slice(start, CSS.indexOf('}', start));

  /** @type {Record<string, string>} */
  const found = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found[name] = value.trim();
  }
  return found;
}

/**
 * @param {string} value a hex, rgba() or one-level var() reference
 * @param {Record<string, string>} tokens
 * @returns {[number, number, number, number]}
 */
function parseColour(value, tokens = {}) {
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return parseColour(tokens[alias[1]], tokens);

  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = value.match(/rgba?\(([^)]+)\)/);
  if (!parts) throw new Error(`cannot parse colour: ${value}`);
  const [r, g, b, a = '1'] = parts[1].split(',').map((p) => p.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
}

/** @param {number[]} fg @param {number[]} bg */
const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);

/** @param {number[]} rgb */
function luminance([r, g, b]) {
  const channel = (/** @type {number} */ v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** @param {number[]} a @param {number[]} b */
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = [
  { name: 'dark', selector: ':root' },
  { name: 'light', selector: '[data-theme="light"]' },
];

describe.each(THEMES)('$name theme text on --surface-card', ({ name, selector }) => {
  const tokens = tokensIn(selector);
  const card = parseColour(tokens['--surface-card'], tokens);
  const textTokens = Object.keys(tokens).filter(
    (k) => k.startsWith('--text-') && !NOT_ON_CARDS.includes(k),
  );

  /** @param {string} token */
  const contrastOf = (token) => ratio(over(parseColour(tokens[token], tokens), card), card);

  it('prints the measured ratios', () => {
    const rows = textTokens.map(
      (token) => `  ${token.padEnd(18)} ${contrastOf(token).toFixed(2)}:1`,
    );
    console.log(`\n${name} on ${tokens['--surface-card']}\n${rows.join('\n')}`);
    expect(textTokens.length).toBeGreaterThan(0);
  });

  it.each(textTokens.filter((t) => t !== DISABLED))('%s clears AA for normal text', (token) => {
    expect(contrastOf(token)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('keeps --text-disabled visibly disabled', () => {
    expect(contrastOf(DISABLED)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it('--cta-emphasis-text is readable on --cta-emphasis', () => {
    const fill = parseColour(tokens['--cta-emphasis'], tokens);
    const label = parseColour(tokens['--cta-emphasis-text'], tokens);
    const measured = ratio(over(label, fill), fill);

    console.log(`\n${name} --cta-emphasis-text on --cta-emphasis  ${measured.toFixed(2)}:1`);
    expect(measured).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('--icon-on-accent is visible on --accent-deep', () => {
    const fill = parseColour(tokens['--accent-deep'], tokens);
    const glyph = parseColour(tokens['--icon-on-accent'], tokens);
    const measured = ratio(over(glyph, fill), fill);

    console.log(`\n${name} --icon-on-accent on --accent-deep  ${measured.toFixed(2)}:1`);
    expect(measured).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
