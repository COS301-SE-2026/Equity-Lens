import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

import Button from '../../components/common/Button/Button';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import { ROUTES } from '../../utils/constants';
import { validatePassword, validateConfirmPassword } from '../../utils/validators';

const validate = (values) => {
  const errors = {};
  if (!values.code || values.code.length !== 6) errors.code = 'Enter the 6-digit code';
  const passwordError = validatePassword(values.newPassword);
  const confirmError = validateConfirmPassword(values.newPassword, values.confirmPassword);
  if (passwordError) errors.newPassword = passwordError;
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
};

const ResetPassword = () => {
  const { confirmPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [status, setStatus] = useState({ type: null, message: '' }); // 'error' | 'success'

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit } = useForm(
    { code: '', newPassword: '', confirmPassword: '' },
    validate,
  );

  const onSubmit = async (formValues) => {
    if (!email) return;
    setStatus({ type: null, message: '' });
    try {
      await confirmPasswordReset(email, formValues.code, formValues.newPassword);
      setStatus({ type: 'success', message: 'Password reset. Redirecting to sign in...' });
      setTimeout(() => navigate(ROUTES.LOGIN), 1500);
    } catch (err) {
      setStatus({
        type: 'error',
        message: err.message || 'Could not reset your password. Please try again.',
      });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
              Reset your password
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Enter the 6-digit code sent to{' '}
              <span className="font-medium text-[var(--text-primary)]">
                {email || 'your email'}
              </span>{' '}
              along with your new password.
            </p>
          </div>

          {status.type && (
            <div
              className={`mb-6 rounded-lg border p-3 text-sm ${
                status.type === 'success'
                  ? 'border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.1)] text-[var(--color-success)]'
                  : 'border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)]'
              }`}
              role={status.type === 'success' ? 'status' : 'alert'}
              aria-live="polite"
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Reset password form">
            <div className="flex flex-col gap-5">
              {!location.state?.email && (
                <FormInput
                  label="Email Address"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              )}

              <FormInput
                label="Verification code"
                name="code"
                type="text"
                inputMode="numeric"
                value={values.code}
                onChange={(e) =>
                  handleChange({
                    target: { name: 'code', value: e.target.value.replace(/\D/g, '') },
                  })
                }
                onBlur={handleBlur}
                error={touched.code ? errors.code : undefined}
                placeholder="000000"
                autoFocus
                required
              />

              <PasswordInput
                label="New Password"
                name="newPassword"
                value={values.newPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.newPassword ? errors.newPassword : undefined}
                placeholder="Min 8 characters"
                required
              />

              <PasswordInput
                label="Confirm New Password"
                name="confirmPassword"
                value={values.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.confirmPassword ? errors.confirmPassword : undefined}
                placeholder="Repeat your new password"
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={status.type === 'success' || values.code.length !== 6}
              >
                {status.type === 'success' ? 'Password reset!' : 'Reset Password'}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Remembered your password?{' '}
            <Link
              to={ROUTES.LOGIN}
              className="font-medium text-[var(--accent-primary)] transition-colors hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;