import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from './ThemeToggle';

const mockToggleTheme = vi.fn();

vi.mock('../../../context/ThemeContext.jsx', () => ({
  useThemeContext: () => ({
    theme: 'dark',
    toggleTheme: mockToggleTheme,
  }),
}));

describe('ThemeToggle', () => {
  it('calls toggleTheme', () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button'));

    expect(mockToggleTheme).toHaveBeenCalled();
  });
});