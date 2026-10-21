import { fetchAuthSession } from 'aws-amplify/auth';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  clearGuestSession,
  getAccessToken,
  readGuestSession,
  saveGuestSession,
} from './guestSession';

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

const HOUR_MS = 60 * 60 * 1000;

/** @param {number} offsetMs */
const guestSession = (offsetMs) => ({
  access_token: 'guest-token',
  expires_at: new Date(Date.now() + offsetMs).toISOString(),
  user: { id: 'guest-1', full_name: 'Guest', is_guest: /** @type {true} */ (true) },
});

describe('guest session storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('reads back a saved session that has not expired', () => {
    const session = guestSession(HOUR_MS);
    saveGuestSession(session);

    expect(readGuestSession()).toEqual(session);
  });

  it('returns nothing when no session was saved', () => {
    expect(readGuestSession()).toBeNull();
  });

  it('drops a session whose expiry has passed', () => {
    saveGuestSession(guestSession(-1000));

    expect(readGuestSession()).toBeNull();
    expect(sessionStorage.getItem('equitylens.guest')).toBeNull();
  });

  it('drops a corrupt entry instead of throwing', () => {
    sessionStorage.setItem('equitylens.guest', '{not json');

    expect(readGuestSession()).toBeNull();
    expect(sessionStorage.getItem('equitylens.guest')).toBeNull();
  });

  it('drops an entry with no token', () => {
    sessionStorage.setItem(
      'equitylens.guest',
      JSON.stringify({ ...guestSession(HOUR_MS), access_token: '' }),
    );

    expect(readGuestSession()).toBeNull();
  });

  it('clears a saved session', () => {
    saveGuestSession(guestSession(HOUR_MS));
    clearGuestSession();

    expect(readGuestSession()).toBeNull();
  });

  it('keeps working when storage itself throws', () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(readGuestSession()).toBeNull();
    blocked.mockRestore();
  });
});

describe('getAccessToken', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('prefers a live guest token over the cognito session', async () => {
    saveGuestSession(guestSession(HOUR_MS));
    vi.mocked(fetchAuthSession).mockResolvedValue(
      /** @type {any} */ ({ tokens: { accessToken: { toString: () => 'cognito-token' } } }),
    );

    expect(await getAccessToken()).toBe('guest-token');
    expect(fetchAuthSession).not.toHaveBeenCalled();
  });

  it('falls back to the cognito access token', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(
      /** @type {any} */ ({ tokens: { accessToken: { toString: () => 'cognito-token' } } }),
    );

    expect(await getAccessToken()).toBe('cognito-token');
  });

  it('uses cognito once the guest session has expired', async () => {
    saveGuestSession(guestSession(-1000));
    vi.mocked(fetchAuthSession).mockResolvedValue(
      /** @type {any} */ ({ tokens: { accessToken: { toString: () => 'cognito-token' } } }),
    );

    expect(await getAccessToken()).toBe('cognito-token');
  });

  it('returns null when there is neither', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({});
    expect(await getAccessToken()).toBeNull();

    vi.mocked(fetchAuthSession).mockRejectedValue(new Error('no session'));
    expect(await getAccessToken()).toBeNull();
  });
});