import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with correct aria label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies correct size class for sm', () => {
    render(<LoadingSpinner size="sm" />);
    expect(screen.getByRole('status').className).toContain('h-4');
  });

  it('applies correct size class for lg', () => {
    render(<LoadingSpinner size="lg" />);
    expect(screen.getByRole('status').className).toContain('h-12');
  });
});