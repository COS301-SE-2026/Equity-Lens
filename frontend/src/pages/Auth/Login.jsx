import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import useForm from '../../hooks/useForm';
import FormInput from '../../components/forms/FormInput/FormInput';
import PasswordInput from '../../components/forms/PasswordInput/PasswordInput';
import Button from '../../components/common/Button/Button';
import { validateEmail } from '../../utils/validators';
import { ROUTES } from '../../utils/constants';
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
  
  const [setView] = useState('login'); 
  const [setServerError] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [ setIsMfaLoading] = useState(false);
  const [setTotpData] = useState({ secret: null, uri: null });
  const [setEmail] = useState('');

  useEffect(() => 
    {
    const storedErr = sessionStorage.getItem('login_error');
    if (storedErr) 
      {
      setServerError(storedErr);
      sessionStorage.removeItem('login_error');
    }
  }, []);

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
};

export default Login;