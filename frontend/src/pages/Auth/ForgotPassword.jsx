import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import Button from '../../components/common/Button/Button';
import FormInput from '../../components/forms/FormInput/FormInput';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import { ROUTES } from '../../utils/constants';
import { validateEmail } from '../../utils/validators';

/** @param {{ email: string }} values */
const validate = (values) => {
  const errors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  return errors;
};

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState({ type: null, message: '' }); // 'error' | 'success'

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit } = useForm(
    { email: '' },
    validate,
  );

  /** @param {{ email: string }} formValues */
  const onSubmit = async (formValues) => {
    setStatus({ type: null, message: '' });
    try {
      await requestPasswordReset(formValues.email);
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('limitexceeded') || msg.includes('too many')) {
          setStatus({
            type: 'error',
            message: 'Too many attempts. Please wait a while before trying again.',
          });
          return;
        }
        if (msg.includes('not confirmed') || msg.includes('unconfirmed')) {
          setStatus({
            type: 'error',
            message:
              'This account has not verified its email yet - check your inbox for a verification code, or register again.',
          });
          return;
        }
      }
    setStatus({
      type: 'success',
      message: `If an account exists for ${formValues.email}, a reset code has been sent. Redirecting...`,
    });
    setTimeout(() => navigate(ROUTES.RESET_PASSWORD, { state: { email: formValues.email } }), 1500);
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">
              Forgot your password?
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Enter your email and we&apos;ll send you a reset code.
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Forgot password form">
            <div className="flex flex-col gap-5">
              <FormInput
                label="Email Address"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.email ? errors.email : undefined}
                placeholder="your@email.com"
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={status.type === 'success'}
              >
                {status.type === 'success' ? 'Code sent' : 'Send Reset Code'}
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

export default ForgotPassword;