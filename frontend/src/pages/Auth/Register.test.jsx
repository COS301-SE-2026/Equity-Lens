import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    register: mockRegister,
    isAuthenticated: false,
    loading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderRegister = () =>
  render(<MemoryRouter><Register /></MemoryRouter>);

describe('Register Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration form', () => {
    renderRegister();
    expect(screen.getByRole('form', { name: /registration form/i })).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    renderRegister();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows error for empty fields on submit', async () => {
    renderRegister();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText('Full name is required')).toBeInTheDocument();
    });
  });
  
it('shows error for invalid email', async () => {
  renderRegister();
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: 'Test User', name: 'fullName' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'notanemail', name: 'email' },
  });
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: 'Password1!', name: 'password' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'Password1!', name: 'confirmPassword' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
  });
});

  it('shows error when passwords do not match', async () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password1', name: 'password' },
    });
    const confirmInput = screen.getByLabelText(/confirm password/i);
    fireEvent.change(confirmInput, {
      target: { value: 'Password2', name: 'confirmPassword' },
    });
    fireEvent.blur(confirmInput);
    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('calls register with correct values on valid submit', async () => {
    mockRegister.mockResolvedValue({});
    renderRegister();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Joshua Heath', name: 'fullName' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'josh@test.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password1!', name: 'password' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'Password1!', name: 'confirmPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Joshua Heath', 'josh@test.com', 'Password1!');
    });
  });

  it('shows success message after successful registration', async () => {
    mockRegister.mockResolvedValue({});
    renderRegister();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Joshua Heath', name: 'fullName' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'josh@test.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password1!', name: 'password' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'Password1!', name: 'confirmPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/account created successfully/i);
    });
  });

  it('shows server error message on failed registration', async () => {
    mockRegister.mockRejectedValue(new Error('Email already in use'));
    renderRegister();
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Joshua Heath', name: 'fullName' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'josh@test.com', name: 'email' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'Password1!', name: 'password' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'Password1!', name: 'confirmPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Registration failed. Please try again.');
    });
  });

  it('renders link to login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});