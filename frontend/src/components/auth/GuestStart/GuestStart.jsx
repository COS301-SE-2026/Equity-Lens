import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { getGuestModeStatus } from '../../../services/authService';
import { ROUTES } from '../../../utils/constants';
import Button from '../../common/Button/Button';

/**
 * @param {{
 *   onError: (message: string | null) => void,
 *   disabled?: boolean,
 * }} props
 */
const GuestStart = ({ onError, disabled = false }) => {
  const { startGuest } = useAuth();
  const navigate = useNavigate();
  const [guestAvailable, setGuestAvailable] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const checkGuestMode = async () => {
      const enabled = await getGuestModeStatus();
      if (active) setGuestAvailable(enabled);
    };
    checkGuestMode();
    return () => {
      active = false;
    };
  }, []);

  const handleGuestStart = async () => {
    onError(null);
    setIsGuestLoading(true);
    try {
      await startGuest();
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      const status = /** @type {any} */ (err)?.response?.status;
      if (status === 404) {
        setGuestAvailable(false);
      } else if (status === 429) {
        onError('Too many guest sessions from this network, wait a few minutes.');
      } else if (status === 503) {
        onError('The demo is busy, try again in a minute.');
      } else {
        onError('Could not start a guest session, try again.');
      }
    } finally {
      setIsGuestLoading(false);
    }
  };

  if (!guestAvailable) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4" aria-hidden="true">
        <span className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-xs text-[var(--text-secondary)]">or</span>
        <span className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>
      <Button
        variant="secondary"
        fullWidth
        loading={isGuestLoading}
        disabled={disabled}
        onClick={handleGuestStart}
      >
        Continue as guest
      </Button>
    </div>
  );
};

export default GuestStart;
