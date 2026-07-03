import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import FormInput from '../../components/forms/FormInput/FormInput';
import Button from '../../components/common/Button/Button';

  const ConfirmEmail = () => {
  const { confirmEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState({ type: null, message: '' }); // 'error' | 'success'
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async (e) => 
    {
    e.preventDefault();
    if (!email || code.length !== 6) 
      {
        return;
      }
    
    setIsLoading(true);
    setStatus({ type: null, message: '' });
    
    try 
    {
      await confirmEmail(email, code);
      setStatus({ type: 'success', message: 'Email verified. Redirecting...' });
      setTimeout(() => navigate(ROUTES.LOGIN), 1500);
    } 
      catch (err) 
    {
      setStatus({ type: 'error', message: err.message || 'Invalid code. Please try again.' });
      setCode('');
    } 
      finally 
    {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 shadow-[var(--shadow-card)]">
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Verify email
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              6-digit code to <span className="text-[var(--text-primary)] font-medium">{email || 'your email'}</span>. 
              Enter it below to activate account.
            </p>
          </div>

          {status.type && (
            <div 
              className={`mb-6 p-3 rounded-lg text-sm border ${
                status.type === 'success' 
                  ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)] text-[var(--color-success)]' 
                  : 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.2)] text-[var(--color-danger)]'
              }`}
            >
              {status.message}
            </div>
          )}

          <form onSubmit={handleConfirm} noValidate>
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
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
              />
              
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
                disabled={status.type === 'success' || code.length !== 6}
              >
                {status.type === 'success' ? 'Verified!' : 'Verify Email'}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
            Already verified?{' '}
            <Link to={ROUTES.LOGIN} className="text-[var(--accent-primary)] hover:underline font-medium transition-colors">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default ConfirmEmail;