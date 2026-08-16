import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock('aws-amplify/auth', () => ({
    fetchAuthSession: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock('../utils/constants', () => ({
    API_BASE_URL: 'https://api.test.example.com',
}));

import api from './api';

const requestFulfilled = () => api.interceptors.request.handlers[0].fulfilled;
const responseFulfilled = () => api.interceptors.response.handlers[0].fulfilled;
const responseRejected = () => api.interceptors.response.handlers[0].rejected;

beforeEach(() => {
    vi.clearAllMocks();
    delete window.location;
    window.location = { href: '' };
});

describe('request interceptor', () => {
    it('attaches Auth header when valid token exists', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: { accessToken: { toString: () => 'my-access-token' } },});
        const config = await requestFulfilled()({ headers: {} });
        expect(config.headers.Authorization).toBe('Bearer my-access-token');
    });
    
    it('leaves the config when no access token present', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: {} });
        const config = await requestFulfilled()({ headers: {} });
        expect(config.headers.Authorization).toBeUndefined();
    });

    it('does not throw when fetch fails, still returns config', async () => {
        fetchAuthSession.mockRejectedValue(new Error('session lookup failed'));
        const config = await requestFulfilled()({ headers: {} });
        expect(config.headers.Authorization).toBeUndefined();
    });
});

describe('response interceptor', () => {
    it('passes successful response', () => {
        const response = { status: 200, data: { ok: true } };
        expect(responseFulfilled()(response)).toBe(response);
    });

    it('401, signs user out and redirects to login', async () => {
        signOut.mockResolvedValue(undefined);
        const error = { response: { status: 401 } };
        await expect(responseRejected()(error)).rejects.toBe(error);
        expect(signOut).toHaveBeenCalled();
        expect(window.location.href).toBe('/login');
    });

    it('still redirects to login, if signOut fails', async () => {
        signOut.mockRejectedValue(new Error('sign out failed'));
        const error = { response: { status: 401 } };
        await expect(responseRejected()(error)).rejects.toBe(error);
        expect(window.location.href).toBe('/login');
    });

    it('does not redirect for non 401', async () => {
        const error = { response: { status: 500 } };
        await expect(responseRejected()(error)).rejects.toBe(error);
        expect(signOut).not.toHaveBeenCalled();
        expect(window.location.href).toBe('');
    });
});