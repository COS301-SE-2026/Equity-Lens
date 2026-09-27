import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../utils/constants', () => ({
  API_BASE_URL: 'http://localhost:8000/api',
}));

import api from './api';

// the interceptors are read out of axios's handler list so they can be called directly
const requestFulfilled = /** @type {(config: any) => Promise<any>} */ (
  api.interceptors.request.handlers?.[0].fulfilled
);
const responseRejected = /** @type {(error: any) => Promise<any>} */ (
  api.interceptors.response.handlers?.[0].rejected
);

describe('api request interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('attaches a bearer token to the request when a session exists', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue(
      /** @type {any} */ ({ tokens: { accessToken: { toString: () => 'live-token' } } }),
    );

    const config = await requestFulfilled({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer live-token');
  });

  it('leaves the request unauthenticated when there is no session', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValue({});

    const config = await requestFulfilled({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('lets the request through unmodified if fetchAuthSession throws', async () => {
    vi.mocked(fetchAuthSession).mockRejectedValue(new Error('network error'));

    const config = await requestFulfilled({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('api response interceptor', () => {
  const originalLocation = window.location;
  // location is swapped for a plain object so the redirect can be read back
  const win = /** @type {any} */ (window);

  beforeEach(() => {
    vi.clearAllMocks();
    delete win.location;
    win.location = { ...originalLocation, href: '', pathname: '/dashboard' };
  });

  afterEach(() => {
    win.location = originalLocation;
  });

  it('signs out and redirects to /login on a rejected token', async () => {
    vi.mocked(signOut).mockResolvedValue(undefined);
    const error = { response: { status: 401, data: { error_code: 'TOKEN_EXPIRED' } } };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(signOut).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('still redirects to /login even if signOut itself fails', async () => {
    vi.mocked(signOut).mockRejectedValue(new Error('signOut failed'));
    const error = { response: { status: 401, data: { error_code: 'TOKEN_EXPIRED' } } };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(window.location.href).toBe('/login');
  });

  it('does not sign out or redirect on a non-401 error', async () => {
    const error = { response: { status: 500 } };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('does not sign out on a 503 - our auth check being down is not an expired session', async () => {
    const error = { response: { status: 503, data: { error_code: 'AUTH_UNAVAILABLE' } } };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('does not sign out on a 403, which means the header was missing, not expired', async () => {
    const error = { response: { status: 403, data: { detail: 'Not authenticated' } } };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('does not sign out or redirect when there is no response at all (e.g. network error)', async () => {
    const error = { message: 'Network Error' };

    await expect(responseRejected(error)).rejects.toBe(error);

    expect(signOut).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });
});
