import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { getGuestModeStatus } from '../../../services/authService';
import { ROUTES } from '../../../utils/constants';

/**
 * @param {(message: string | null) => void} onError
 */
const useGuestStart = (onError) => {
  const { startGuest } = useAuth();
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const checkGuestMode = async () => {
      const enabled = await getGuestModeStatus();
      if (active) setAvailable(enabled);
    };
    checkGuestMode();
    return () => {
      active = false;
    };
  }, []);

  const start = async () => {
    onError(null);
    setLoading(true);
    try {
      await startGuest();
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      const status = /** @type {any} */ (err)?.response?.status;
      if (status === 404) {
        setAvailable(false);
      } else if (status === 429) {
        onError('Too many guest sessions from this network, wait a few minutes.');
      } else if (status === 503) {
        onError('The demo is busy, try again in a minute.');
      } else {
        onError('Could not start a guest session, try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return { available, loading, start };
};

export default useGuestStart;
