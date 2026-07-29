import { PASSWORD_MIN_LENGTH } from './constants';

/**
 * @param {*} email
 */
export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};


/**
 * @param {*} password
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  if (!/[@$!%*?&#.]/.test(password)) return 'Password must contain at least one special character (@$!%*?&#.)';
  return null;
};

/**
 * @param {*} password
 * @param {*} confirmPassword
 */
export const validateConfirmPassword = (password, confirmPassword) => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

/**
 * @param {*} name
 */
export const validateName = (name) => {
  if (!name) return 'Full name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
};