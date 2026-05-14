import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import Button from '../../components/common/Button/Button';
import { validateEmail } from '../../utils/validators';
import { ROUTES } from '../../utils/constants';

const validate = (values) => {
  const errors = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password) errors.password = 'Password is required';
  return errors;
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useForm({ email: '', password: '' }, validate);

  const onSubmit = async (formValues) => {
    setServerError(null);
    try {
      await login(formValues.email, formValues.password);
      navigate(ROUTES.DASHBOARD);
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Sign in to your EquityLens account
            </p>
          </div>

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
            aria-label="Login form"
          >
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

              <PasswordInput
                label="Password"
                name="password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.password ? errors.password : undefined}
                placeholder="Enter your password"
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
              >
                Sign In
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Don&apos;t have an account?{' '}
            <Link
              to={ROUTES.REGISTER}
              className="text-[var(--accent-primary)] hover:underline font-medium"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
