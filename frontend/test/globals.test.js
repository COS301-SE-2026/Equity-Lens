import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

const css = readFileSync('src/styles/globals.css', 'utf-8');

const lightBlock = css.slice(
  css.indexOf('[data-theme="light"] {'),
  css.indexOf("[data-theme='dark'] {")
);

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
