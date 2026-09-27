import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

import api from './api';

/**
 * @param {any} fullName
 * @param {any} email
 * @param {any} password
 */
export async function register(fullName, email, password) {
  const result = await signUp({
    username: email,
    password,
    options: {
      userAttributes: { email, name: fullName },
    },
  });
  return { userId: result.userId, email };
}

/**
 * @param {any} email
 * @param {any} code
 */
export const confirmRegistration = (email, code) =>
  confirmSignUp({ username: email, confirmationCode: code });
/**
 * @param {any} email
 * @param {any} password
 */
export const login = (email, password) => signIn({ username: email, password });
/**
 * @param {any} totpCode
 */
export const respondToMFA = (totpCode) => confirmSignIn({ challengeResponse: totpCode });
export const initTOTPSetup = () => setUpTOTP();
export const logout = () => signOut();
/**
 * @param {any} email
 */
export const requestPasswordReset = (email) => resetPassword({ username: email });
/**
 * @param {any} email
 * @param {any} code
 * @param {any} newPassword
 */
export const confirmPasswordReset = (email, code, newPassword) =>
  confirmResetPassword({ username: email, confirmationCode: code, newPassword });

/**
 * @param {any} totpCode
 */
export async function confirmTOTPSetup(totpCode) {
  await verifyTOTPSetup({ code: totpCode });
  await updateMFAPreference({ totp: 'PREFERRED' });
}

export async function getToken() {
  try {
    const session = await fetchAuthSession();
    if (!session || !session.tokens || !session.tokens.accessToken) {
      return null;
    }
    return session.tokens.accessToken.toString();
  } catch (err) {
    console.warn('getToken failed:', err);
    return null;
  }
}

export async function isAuthenticated() {
  try {
    const session = await fetchAuthSession();
    if (session && session.tokens && session.tokens.accessToken) {
      return true;
    }
    return false;
  } catch  {
    return false;
  }
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  const session = await fetchAuthSession();

  let email = '';
  let fullName = '';
  if (session.tokens && session.tokens.idToken) {
    /** @type {any} */
    const payload = session.tokens.idToken.payload;
    email = payload.email || '';
    fullName = payload.name || '';
  }

  return {
    sub: user.userId,
    email,
    full_name: fullName,
  };
}

/**
 * @param {any} email
 */
export async function deleteAccount(email) {
  try {
    const response = await api.delete('/auth/me', { data: { email } });
    return response.data;
  } catch (err) {
     /** @type {any} */
     const error = err;
    const detail = error.response?.data?.detail || 'Account deletion failed';
    throw new Error(detail);
  }
}
