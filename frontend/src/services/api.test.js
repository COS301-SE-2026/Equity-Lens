import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { API_BASE_URL } from "../utils/constants";

vi.mock('aws-amplify/auth', () => ({
    fetchAuthSession: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock('../utils/constants', () => ({
    API_BASE_URL: 'http://localhost:8000/api',
}));

import api from "./api";

const requestFulfilled = api.interceptors.request.handlers[0].fulfilled;
const responseRejected = api.interceptors.response.handlers[0].rejected;

describe('api request interceptor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('attaches a bearer token to the request when a session exists', async () => {
    fetchAuthSession.mockResolvedValue({
      tokens: { accessToken: { toString: () => 'live-token' } },
    });
 
    const config = await requestFulfilled({ headers: {} });
 
    expect(config.headers.Authorization).toBe('Bearer live-token');
  });
 
  it('leaves the request unauthenticated when there is no session', async () => {
    fetchAuthSession.mockResolvedValue({});
 
    const config = await requestFulfilled({ headers: {} });
 
    expect(config.headers.Authorization).toBeUndefined();
  });
 
  it('lets the request through unmodified if fetchAuthSession throws', async () => {
    fetchAuthSession.mockRejectedValue(new Error('network error'));
 
    const config = await requestFulfilled({ headers: {} });
 
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('api response interceptor', () => {
  const originalLocation = window.location;
 
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.location;
    window.location = { ...originalLocation, href: '' };
  });
 
  afterEach(() => {
    window.location = originalLocation;
  });
 
  it('signs out and redirects to /login on a 401', async () => {
    signOut.mockResolvedValue(undefined);
    const error = { response: { status: 401 } };
 
    await expect(responseRejected(error)).rejects.toBe(error);
 
    expect(signOut).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });
 
  it('still redirects to /login even if signOut itself fails', async () => {
    signOut.mockRejectedValue(new Error('signOut failed'));
    const error = { response: { status: 401 } };
 
    await expect(responseRejected(error)).rejects.toBe(error);
 
    expect(window.location.href).toBe('/login');
  });
 
  it('does not sign out or redirect on a non-401 error', async () => {
    const error = { response: { status: 500 } };
 
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