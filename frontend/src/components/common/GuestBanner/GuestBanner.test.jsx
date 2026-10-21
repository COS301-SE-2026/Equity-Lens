import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveGuestSession } from '../../../services/guestSession';

import GuestBanner, { formatRemaining } from './GuestBanner';

const mockLogout = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  default: () => ({ logout: mockLogout }),
}));

const MINUTE_MS = 60 * 1000;

/** @param {number} msLeft */
const saveSessionEnding = (msLeft) =>
  saveGuestSession({
    access_token: 'guest-token',
    expires_at: new Date(Date.now() + msLeft).toISOString(),
    user: { id: 'guest-1', full_name: 'Guest', is_guest: true },
  });

const renderBanner = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<GuestBanner />} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('formatRemaining', () => {
  it('rounds up to the next minute and shows hours when there are some', () => {
    expect(formatRemaining((3 * 60 + 11) * MINUTE_MS + 1000)).toBe('3h 12m');
    expect(formatRemaining(45 * MINUTE_MS)).toBe('45m');
    expect(formatRemaining(-5000)).toBe('0m');
  });
});

describe('GuestBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockLogout.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('shows how long the session has left', () => {
    saveSessionEnding((3 * 60 + 12) * MINUTE_MS);
    renderBanner();

    expect(
      screen.getByText(/guest session - your data is deleted when you end the session - ends in 3h 12m/i),
    ).toBeInTheDocument();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('ends the session straight away once it has expired', () => {
    saveSessionEnding(-1000);
    renderBanner();

    expect(mockLogout).toHaveBeenCalled();
  });

  it('ends the session from the banner', async () => {
    saveSessionEnding(60 * MINUTE_MS);
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: /end session/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('ends the session and goes to sign-up from Create account', async () => {
    saveSessionEnding(60 * MINUTE_MS);
    const user = userEvent.setup();
    renderBanner();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Register Page')).toBeInTheDocument();
  });

  it('ends the session after 30 idle minutes', () => {
    vi.useFakeTimers();
    saveSessionEnding(4 * 60 * MINUTE_MS);
    renderBanner();

    act(() => {
      vi.advanceTimersByTime(29 * MINUTE_MS);
    });
    expect(mockLogout).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS);
    });
    expect(mockLogout).toHaveBeenCalled();
  });

  it('keeps an active visitor signed in', () => {
    vi.useFakeTimers();
    saveSessionEnding(4 * 60 * MINUTE_MS);
    renderBanner();

    for (let minute = 0; minute < 60; minute += 10) {
      act(() => {
        vi.advanceTimersByTime(10 * MINUTE_MS);
      });
      fireEvent.pointerDown(window);
    }

    expect(mockLogout).not.toHaveBeenCalled();
  });
});
