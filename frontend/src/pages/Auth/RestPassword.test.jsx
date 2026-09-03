import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from './ResetPassword';

const mockConfirmPasswordReset = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    confirmPasswordReset: mockConfirmPasswordReset,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../utils/validators', () => ({
  validatePassword: (val) => (val?.length < 8 ? 'Password must be at least 8 characters' : null),
  validateConfirmPassword: (pass, confirm) => (pass !== confirm ? 'Passwords do not match' : null),
}));

describe('ResetPassword', () => {
  const renderComponent = (initialState = { email: 'user@example.com' }) => {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/reset-password', state: initialState }]}>
        <ResetPassword />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders correctly with pre-filled email from location state', () => {
    renderComponent({ email: 'test@domain.com' });

    expect(screen.getByRole('heading', { level: 1, name: /reset your password/i })).toBeInTheDocument();
    expect(screen.getByText('test@domain.com')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
  });

  it('shows manual email input when location state does not provide email', () => {
    renderComponent(null);

    expect(screen.getByText('your email')).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('sanitizes verification code input to numbers only and restricts submit button', async () => {
    const user = userEvent.setup();
    renderComponent();

    const codeInput = screen.getByLabelText(/verification code/i);
    const submitBtn = screen.getByRole('button', { name: /reset password/i });

    expect(submitBtn).toBeDisabled();

    await user.type(codeInput, 'a1b2c3d');
    expect(codeInput).toHaveValue('123');
    expect(submitBtn).toBeDisabled();

    await user.type(codeInput, '456');
    expect(codeInput).toHaveValue('123456');
    expect(submitBtn).not.toBeDisabled();
  });

  it('displays validation errors when fields lose focus with invalid data', async () => {
    const user = userEvent.setup();
    renderComponent();

    const passInput = screen.getByLabelText(/^new password/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);

    await user.type(passInput, 'short');
    await user.tab();

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();

    await user.type(confirmInput, 'differentpass');
    await user.tab();

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('submits successfully and redirects after delay', async () => {
  const user = userEvent.setup();
  mockConfirmPasswordReset.mockResolvedValueOnce();

  renderComponent({ email: 'user@example.com' });

  await user.type(screen.getByLabelText(/verification code/i), '123456');
  await user.type(screen.getByLabelText(/^new password/i), 'Password123!');
  await user.type(screen.getByLabelText(/confirm new password/i), 'Password123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
    'user@example.com',
    '123456',
    'Password123!'
  );

  const statusAlert = await screen.findByRole('status');
  expect(statusAlert).toHaveTextContent(/password reset\. redirecting to sign in/i);

  await waitFor(
    () => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    },
    { timeout: 2000 }
  );
});

  it('displays an error alert when API call fails', async () => {
    const user = userEvent.setup();
    mockConfirmPasswordReset.mockReset();
    mockConfirmPasswordReset.mockRejectedValueOnce(new Error('Invalid or expired code'));

    renderComponent({ email: 'user@example.com' });

    await user.type(screen.getByLabelText(/verification code/i), '654321');
    await user.type(screen.getByLabelText(/^new password/i), 'ValidPass123');
    await user.type(screen.getByLabelText(/confirm new password/i), 'ValidPass123');

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Invalid or expired code');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('allows manual email entry when missing and passes it to confirmPasswordReset', async () => {
    const user = userEvent.setup();
    mockConfirmPasswordReset.mockResolvedValueOnce();

    renderComponent(null);

    await user.type(screen.getByLabelText(/email address/i), 'manual@domain.com');
    await user.type(screen.getByLabelText(/verification code/i), '112233');
    await user.type(screen.getByLabelText(/^new password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm new password/i), 'Password123!');

    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
        'manual@domain.com',
        '112233',
        'Password123!'
      );
    });
  });
});