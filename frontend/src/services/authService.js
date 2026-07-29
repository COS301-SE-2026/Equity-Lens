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
} from "aws-amplify/auth";

/**
 * 
 * @param {*} fullName 
 * @param {*} email 
 * @param {*} password 
 * @returns 
 */
export async function register(fullName, email, password) {
  const result = await signUp({
    username: email,
    password: password,
    options: {
      userAttributes: { email: email, name: fullName, },
    },
  });
  return { userId: result.userId, email: email };
}

/**
 * 
 * @param {*} email 
 * @param {*} code 
 * @returns 
 */
export const confirmRegistration = (email, code) => confirmSignUp({ username: email, confirmationCode: code });
/**
 * 
 * @param {*} email 
 * @param {*} password 
 * @returns 
 */
export const login = (email, password) => signIn({ username: email, password });
/**
 * 
 * @param {*} totpCode 
 * @returns 
 */
export const respondToMFA = (totpCode) => confirmSignIn({ challengeResponse: totpCode });
export const initTOTPSetup = () => setUpTOTP();
export const logout = () => signOut();

/**
 * 
 * @param {*} totpCode 
 * @returns 
 */
export async function confirmTOTPSetup(totpCode) {
  await verifyTOTPSetup({ code: totpCode });
  await updateMFAPreference({ totp: "PREFERRED" });
}

export async function getToken() {
  try {
    const session = await fetchAuthSession();
    if (!session || !session.tokens || !session.tokens.accessToken) {
      return null;
    }
    return session.tokens.accessToken.toString();
  } catch (err) {
    console.warn("getToken failed:", err);
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
  } catch (err) {
    return false;
  }
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  const session = await fetchAuthSession();

  let email = "";
  let fullName = "";
  if (session.tokens && session.tokens.idToken) {
    const payload = session.tokens.idToken.payload;
    email = String(payload.email || "");
    fullName = String(payload.name || "");
  }

  return {
    sub: user.userId,
    email: email,
    full_name: fullName,
  };
}