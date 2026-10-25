import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { readGuestSession } from '../../../services/guestSession';
import { ROUTES } from '../../../utils/constants';

const MINUTE_MS = 60 * 1000;
const IDLE_LIMIT_MS = 30 * MINUTE_MS;
const ACTIVITY_THROTTLE_MS = 5000;

/** @param {number} ms */
export const formatRemaining = (ms) => {
  const minutes = Math.max(0, Math.ceil(ms / MINUTE_MS));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--accent-primary)',
  fontWeight: 600,
  cursor: 'pointer',
};

const GuestBanner = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [expiresAt] = useState(() => Date.parse(readGuestSession()?.expires_at ?? '') || 0);
  const [now, setNow] = useState(() => Date.now());
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let lastSeen = 0;
    const markActive = () => {
      const time = Date.now();
      if (time - lastSeen < ACTIVITY_THROTTLE_MS) return;
      lastSeen = time;
      lastActivity.current = time;
    };
    window.addEventListener('pointerdown', markActive);
    window.addEventListener('keydown', markActive);
    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
    };
  }, []);

  useEffect(() => {
    if (now >= expiresAt || now - lastActivity.current >= IDLE_LIMIT_MS) {
      logout();
    }
  }, [now, expiresAt, logout]);

  const handleCreateAccount = async () => {
    await logout();
    navigate(ROUTES.REGISTER);
  };

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-xs"
      style={{
        background: 'var(--signal-info-bg)',
        borderBottom: '1px solid var(--signal-info-border)',
        color: 'var(--text-primary)',
        flexShrink: 0,
      }}
    >
      <span>
        Guest session - your data is deleted when you end the session - ends in{' '}
        {formatRemaining(expiresAt - now)}
      </span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={handleCreateAccount} style={linkStyle}>
        Create account
      </button>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={logout} style={linkStyle}>
        End session
      </button>
    </div>
  );
};

export default GuestBanner;
