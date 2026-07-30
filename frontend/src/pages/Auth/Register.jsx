import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import Button from '../../components/common/Button/Button';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateName,
} from '../../utils/validators';
import { ROUTES } from '../../utils/constants';

const validate = (values) => {
  const errors = {};
  const nameError = validateName(values.fullName);
  const emailError = validateEmail(values.email);
  const passwordError = validatePassword(values.password);
  const confirmError = validateConfirmPassword(values.password, values.confirmPassword);
  if (nameError) errors.fullName = nameError;
  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
};

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useForm(
    { fullName: '', email: '', password: '', confirmPassword: '' },
    validate
  );

  const onSubmit = async (formValues) => {
    setServerError(null);
    try {
      await register(formValues.fullName, formValues.email, formValues.password);
      setRegisteredEmail(formValues.email);
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.CONFIRM_EMAIL, { state: { email: formValues.email }}), 1500);
    } catch (err) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('already exists') || msg.includes('already registered') || msg.includes('usernameexists')) {
        setServerError('An account with this email already exists. Sign in instead.');
      } else {
        setServerError(err.message || 'Registration failed.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              Create your account
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Join EquityLens to start analysing your portfolio
            </p>
          </div>

          {success && (
            <div
              className="mb-6 p-3 rounded-lg bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.2)] text-[var(--color-success)] text-sm"
              role="status"
              aria-live="polite"
            >
              Account created. Check your email ({registeredEmail}) for a verification code.
            </div>
          )}

          {serverError && (
            <div
              className="mb-6 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-danger)] text-sm"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            aria-label="Registration form"
          >
            <div className="flex flex-col gap-5">
              <FormInput
                label="Full Name"
                name="fullName"
                type="text"
                value={values.fullName}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.fullName ? errors.fullName : undefined}
                placeholder="Your Name Here"
                required
              />
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
              <PasswordInput
                label="Password"
                name="password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.password ? errors.password : undefined}
                placeholder="Min 8 characters"
                required
              />
              <PasswordInput
                label="Confirm Password"
                name="confirmPassword"
                value={values.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.confirmPassword ? errors.confirmPassword : undefined}
                placeholder="Repeat your password"
                required
              />
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
                disabled={success}
              >
                Create Account
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Already have an account?{' '}
            <Link
              to={ROUTES.LOGIN}
              className="text-[var(--accent-primary)] hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;