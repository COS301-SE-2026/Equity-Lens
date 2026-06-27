import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';

const ConfirmEmail = () => 
  {
  const { confirmEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [setStatus] = useState({ type: null, message: '' });
  const [setIsLoading] = useState(false);

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
};

export default ConfirmEmail;