import { fetchAuthSession } from 'aws-amplify/auth';

const STORAGE_KEY = 'equitylens.guest';

/**
 * @typedef {{
 *   access_token: string,
 *   expires_at: string,
 *   user: { id: string, full_name: string, is_guest: true },
 * }} GuestSession
 */

export const clearGuestSession = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {//
  }
};

/** @param {GuestSession} session */
export const saveGuestSession = (session) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('could not keep the guest session in this tab:', err);
  }
};

/** @returns {GuestSession | null} */
export const readGuestSession = () => {
  /** @type {GuestSession | null} */
  let session = null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch {
    session = null;
  }

  const expiresAt = Date.parse(session?.expires_at ?? '');
  if (!session?.access_token || !(expiresAt > Date.now())) {
    clearGuestSession();
    return null;
  }
  return session;
};

/** @returns {Promise<string | null>} */
export const getAccessToken = async () => {
  const guest = readGuestSession();
  if (guest) return guest.access_token;

  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
};
