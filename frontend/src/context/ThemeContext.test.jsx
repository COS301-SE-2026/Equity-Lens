import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { THEME_KEY } from '../utils/constants';

import { ThemeProvider, useThemeContext } from './ThemeContext';

const ToggleButton = () => {
  const { theme, toggleTheme } = useThemeContext();
  return <button onClick={toggleTheme}>{theme}</button>;
};

const Harness = () => (
  <ThemeProvider>
    <ToggleButton />
  </ThemeProvider>
);

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
  });

  it('falls back to dark when nothing is stored and the OS does not ask for light', () => {
    // the shared setup mocks matchMedia to always report matches: false
    render(<Harness />);

    expect(screen.getByText('dark')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('uses the stored theme', () => {
    localStorage.setItem(THEME_KEY, 'light');
    render(<Harness />);

    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('prefers the theme index.html already painted over the stored one', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    document.documentElement.setAttribute('data-theme', 'light');
    render(<Harness />);

    expect(screen.getByText('light')).toBeInTheDocument();
  });

  it('toggling flips data-theme on <html> and persists', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('dark'));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });
});
