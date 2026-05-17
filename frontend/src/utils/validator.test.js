import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateName,
} from './validators';

describe('validateEmail', () => {
  it('returns error for empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
  });
  it('returns error for invalid email format', () => {
    expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
  });
  it('returns null for valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('Password is required');
  });
  it('returns error for short password', () => {
    expect(validatePassword('Ab1')).toMatch(/at least 8 characters/);
  });
  it('returns error for missing uppercase', () => {
    expect(validatePassword('password1!')).toMatch(/uppercase/);
  });
  it('returns error for missing lowercase', () => {
    expect(validatePassword('PASSWORD1!')).toMatch(/lowercase/);
  });
  it('returns error for missing number', () => {
    expect(validatePassword('Password!')).toMatch(/number/);
  });
  it('returns error for missing special character', () => {
    expect(validatePassword('Password1')).toMatch(/special character/);
  });
  it('returns null for valid password', () => {
    expect(validatePassword('Password1!')).toBeNull();
  });
});

describe('validateConfirmPassword', () => {
  it('returns error when confirm is empty', () => {
    expect(validateConfirmPassword('Password1', '')).toBe('Please confirm your password');
  });
  it('returns error when passwords do not match', () => {
    expect(validateConfirmPassword('Password1', 'Password2')).toBe('Passwords do not match');
  });
  it('returns null when passwords match', () => {
    expect(validateConfirmPassword('Password1', 'Password1')).toBeNull();
  });
});

describe('validateName', () => {
  it('returns error for empty name', () => {
    expect(validateName('')).toBe('Full name is required');
  });
  it('returns error for name too short', () => {
    expect(validateName('J')).toMatch(/at least 2 characters/);
  });
  it('returns null for valid name', () => {
    expect(validateName('Joshua Heath')).toBeNull();
  });
});