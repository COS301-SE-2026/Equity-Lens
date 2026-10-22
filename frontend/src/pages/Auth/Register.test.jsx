import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getGuestModeStatus } from '../../services/authService';

import Register from './Register';

const mockRegister = vi.fn();
const mockStartGuest = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    register: mockRegister,
    startGuest: mockStartGuest,
  }),
}));

vi.mock('../../services/authService', () => ({
  getGuestModeStatus: vi.fn(),
}));

const renderRegister = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/confirm-email" element={<div>Confirm Email Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

/** @param {ReturnType<typeof userEvent.setup>} user */
const fillForm = async (user) => {
  await user.type(screen.getByLabelText(/^full name/i), 'Thabo Nkosi');
  await user.type(screen.getByLabelText(/^email address/i), 'thabo@example.com');
  await user.type(screen.getByLabelText(/^password/i), 'Secret123!');
  await user.type(screen.getByLabelText(/^confirm password/i), 'Secret123!');
};

describe('Register guest option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers Continue as guest next to Create Account when guest mode is on', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    renderRegister();

    expect(await screen.findByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('hides the option when guest mode is off', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(false);
    renderRegister();

    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument();
  });

  it('starts a guest session and lands on the dashboard', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegister();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(mockStartGuest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });

  it('says the demo is busy when the server is at capacity', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockRejectedValue({ response: { status: 503 } });
    const user = userEvent.setup();
    renderRegister();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The demo is busy, try again in a minute.',
    );
  });

  it('hides the option if guest mode was switched off since the page loaded', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockRejectedValue({ response: { status: 404 } });
    const user = userEvent.setup();
    renderRegister();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument(),
    );
  });

  it('disables the guest button once the account is created', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockRegister.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegister();
    const guest = await screen.findByRole('button', { name: /continue as guest/i });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/account created/i);
    expect(guest).toBeDisabled();
    expect(mockStartGuest).not.toHaveBeenCalled();
  });

  it('still shows a registration error in the same alert', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockRegister.mockRejectedValue(new Error('UsernameExistsException: User already exists'));
    const user = userEvent.setup();
    renderRegister();
    await screen.findByRole('button', { name: /continue as guest/i });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists. Sign in instead.',
    );
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeEnabled();
  });
});