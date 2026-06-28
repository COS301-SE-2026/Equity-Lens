import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import Button from '../../components/common/Button/Button';
import { validateEmail } from '../../utils/validators';
import { ROUTES } from '../../utils/constants';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';

const validate = (values) => 
  {
  const errors = {};
  if (validateEmail(values.email)) errors.email = validateEmail(values.email);
  if (!values.password) errors.password = 'Password required';
  return { errors };
  };

const Card = ({ title, subtitle, serverError, children }) => (
  <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md">
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{title}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        </div>
        
        {serverError && (
          <div className="mb-6 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[var(--color-danger)] text-sm" role="alert">
            {serverError}
          </div>
        )}
        
        {children}
      </div>
    </div>
  </div>
);

const Login = () => 
  {
  const { login, submitMFACode, activateTOTP } = useAuth();
  const navigate = useNavigate();
  
  const [view, setView] = useState('login'); 
  const [serverError, setServerError] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [totpData, setTotpData] = useState({ secret: null, uri: null });
  const [email, setEmail] = useState('');

  useEffect(() => 
    {
    const storedErr = sessionStorage.getItem('login_error');
    if (storedErr) 
      {
      setServerError(storedErr);
      sessionStorage.removeItem('login_error');
    }
  }, []);

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit } = useForm({ email: '', password: '' }, validate);

  const handleLoginSubmit = async (formValues) => 
    {
    sessionStorage.removeItem('login_error');
    setServerError(null);
    setEmail(formValues.email);
    
    try 
    {
      const result = await login(formValues.email, formValues.password);

      if (result?.challenge === 'MFA_SETUP') 
        {
        const secret = result.totpSetupDetails?.sharedSecret;
        setTotpData({ secret, uri: `otpauth://totp/EquityLens:${encodeURIComponent(formValues.email)}?secret=${secret}&issuer=EquityLens` });
        setView('setup-qr');
        return;
      }

      if (result?.challenge === 'SOFTWARE_TOKEN_MFA') {
        setView('mfa');
        return;
      }

      navigate(ROUTES.DASHBOARD, { replace: true });
    } 
      catch 
    {
      const msg = 'Incorrect email or password';
      sessionStorage.setItem('login_error', msg);
      setServerError(msg);
    }
  };

  const handleMfaSubmit = async (actionType) => 
    {
    if (mfaCode.length !== 6) 
      {
        return;
      }
    
    setIsMfaLoading(true);
    setServerError(null);
    
    try 
    {
      if (actionType === 'verify') 
      {
        await submitMFACode(mfaCode);
      }
      else 
      {
        await activateTOTP(mfaCode);
      }
      navigate(ROUTES.DASHBOARD, { replace: true });
    } 
      catch (err)
    {
      setServerError(err.message || 'Code invalid');
      setMfaCode('');
    } 
      finally 
    {
      setIsMfaLoading(false);
    }
  };

  const renderMfaInput = (buttonText, actionType) => (
    <div className="flex flex-col gap-5">
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={mfaCode}
        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        autoFocus
        className="w-full text-center tracking-[0.3em] text-2xl p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
      />
      <Button
        variant="primary"
        fullWidth
        loading={isMfaLoading}
        onClick={() => handleMfaSubmit(actionType)}
        disabled={mfaCode.length !== 6}
      >
        {buttonText}
      </Button>
      
      {view === 'setup-verify' && (
        <button
          onClick={() => { setMfaCode(''); setView('setup-qr'); }}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-center transition-colors"
        >
          Back to QR code
        </button>
      )}
    </div>
  );

  if (view === 'mfa') {
    return (
      <Card title="Two-factor authentication" subtitle="Enter your 6-digit code." serverError={serverError}>
        {renderMfaInput('Verify', 'verify')}
      </Card>
    );
  }

  if (view === 'setup-qr') {
    return (
      <Card title="Set up 2FA" subtitle="Scan the QR code." serverError={serverError}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Open your authenticator app and Scan the QR code.
          </p>

          {totpData.uri && (
            <div className="flex justify-center p-4 bg-white rounded-lg border border-[var(--border-subtle)]">
              <QRCodeSVG value={totpData.uri} size={180} level="M" />
            </div>
          )}

          <details className="group cursor-pointer">
            <summary className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Enter key
            </summary>
            <div className="mt-2 bg-[var(--surface-inset)] border border-[var(--border-subtle)] rounded-md p-3">
              <p className="text-xs text-[var(--text-dim)] mb-1">
                Account: <strong>{email}</strong> &nbsp;·&nbsp; Type: <strong>Time based</strong>
              </p>
              <p className="text-xs font-mono text-[var(--text-primary)] break-all tracking-wide">
                {totpData.secret}
              </p>
            </div>
          </details>

          <Button variant="primary" fullWidth onClick={() => { setMfaCode(''); setView('setup-verify'); }} disabled={!totpData.secret}>
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  if (view === 'setup-verify') {
    return (
      <Card title="Verify your authenticator" subtitle="Enter the 6-digit code your authenticator app is showing." serverError={serverError}>
        {renderMfaInput('Activate MFA', 'setup')}
      </Card>
    );
  }

  return (
    <Card title="Welcome back" subtitle="Sign in to your EquityLens account" serverError={serverError}>
      <form onSubmit={handleSubmit(handleLoginSubmit)} noValidate aria-label="Login form">
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
          <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
            Sign In
          </Button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.REGISTER} className="text-[var(--accent-primary)] hover:underline font-medium transition-all">
          Create one
        </Link>
      </p>
    </Card>
  );
};

export default Login;