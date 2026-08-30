import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormInput from './FormInput';

describe('FormInput', () => {
  it('renders label correctly', () => {
    render(<FormInput label="Email" name="email" value="" onChange={() => {}} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders error message when error is provided', () => {
    render(
      <FormInput
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        error="Invalid email"
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('calls onChange when input changes', () => {
    const handleChange = vi.fn();
    render(<FormInput name="email" value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@test.com' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('calls onBlur when input loses focus', () => {
    const handleBlur = vi.fn();
    render(<FormInput name="email" value="" onChange={() => {}} onBlur={handleBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(handleBlur).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<FormInput name="email" value="" onChange={() => {}} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows required asterisk when required is true', () => {
    render(<FormInput label="Email" name="email" value="" onChange={() => {}} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});