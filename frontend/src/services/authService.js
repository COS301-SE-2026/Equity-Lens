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
} from 'aws-amplify/auth';

export const register = async (fullName, email, password) => {
  const { userId } = await signUp({
    username: email,
    password,
    options: { 
      userAttributes: { email, name: fullName } 
    },
  });
  
  return { userId, email };
};

export const confirmRegistration = (email, code) => confirmSignUp({ username: email, confirmationCode: code });
export const login = (email, password) => signIn({ username: email, password });
export const respondToMFA = (totpCode) => confirmSignIn({ challengeResponse: totpCode });
export const initTOTPSetup = () => setUpTOTP();
export const logout = () => signOut();

export const confirmTOTPSetup = async (totpCode) => {
  await verifyTOTPSetup({ code: totpCode });
  await updateMFAPreference({ totp: 'PREFERRED' });
};

export const getToken = async () => {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() || null;
};

export const isAuthenticated = async () => {
  const token = await getToken();
  return !!token;
};

export const getCurrentUserProfile = async () => {
  const [user, session] = await Promise.all([
    getCurrentUser(),
    fetchAuthSession()
  ]);
  
  const payload = session.tokens?.idToken?.payload;
  
  return {
    sub: user.userId,
    email: payload?.email || '',
    full_name: payload?.name || '',
  };
};