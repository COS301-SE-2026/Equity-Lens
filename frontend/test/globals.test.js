import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

const css = readFileSync('src/styles/globals.css', 'utf-8');

// prettier may write the attribute selector with either quote, so find whichever is there
const blockStart = (theme) =>
  [`[data-theme="${theme}"] {`, `[data-theme='${theme}'] {`]
    .map((selector) => css.indexOf(selector))
    .find((index) => index !== -1) ?? -1;

const lightBlock = css.slice(blockStart('light'), blockStart('dark'));

const requiredTokens = [
  '--text-primary',
  '--text-secondary',
  '--text-ghost',
  '--glass-bg',
  '--glass-border',
  '--border-subtle',
  '--surface-card',
  '--surface-raised',
  '--accent-primary',
  '--signal-positive',
  '--signal-negative',
  '--chart-tooltip-bg',
];

describe('light theme palette', () => {
  it.each(requiredTokens)('overrides %s', (token) => {
    expect(lightBlock).toContain(`${token}:`);
  });
});
