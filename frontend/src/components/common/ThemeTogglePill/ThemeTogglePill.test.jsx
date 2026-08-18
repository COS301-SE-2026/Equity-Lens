import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeTogglePill from './ThemeTogglePill';

const mockToggleTheme = vi.fn();
let mockTheme = 'dark';

vi.mock('../../../context/ThemeContext.jsx', () => ({
  useThemeContext: () => ({
    theme: mockTheme,
    toggleTheme: mockToggleTheme,
  }),
}));

describe('ThemeTogglePill', () => {
  it('calls toggleTheme on click', () => {
    mockTheme = 'dark';
    render(<ThemeTogglePill />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockToggleTheme).toHaveBeenCalled();});

  it('changes when clicked to show light option', () => {
    mockTheme = 'dark';
    render(<ThemeTogglePill />);

    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');});

  it('changes when clicked to show dark option', () => {
    mockTheme = 'light';
    render(<ThemeTogglePill />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');});});
