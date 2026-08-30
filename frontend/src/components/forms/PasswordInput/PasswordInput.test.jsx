import { describe, it, expect} from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  it('renders as password type by default', () => {
  render(<PasswordInput label="Password" value="" onChange={() => {}} />);
  const input = document.querySelector('input[type="password"]');
  expect(input).not.toBeNull();
  expect(input.type).toBe('password');
});

  it('toggles password visibility when eye icon is clicked', () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const toggleButton = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('shows error message when error is provided', () => {
    render(<PasswordInput value="" onChange={() => {}} error="Password too weak" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Password too weak');
  });
});