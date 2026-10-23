import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { ROUTES } from '../../../utils/constants';

const PRIMARY =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-6 text-[15px] font-semibold text-[var(--text-on-accent)] transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-60';
const SECONDARY =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--border-mid)] px-6 text-[15px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-hover)]';

const ON_ACCENT_PRIMARY =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--surface-base)] px-6 text-[15px] font-semibold text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-elevated)] disabled:opacity-60';
const ON_ACCENT_SECONDARY =
  'inline-flex min-h-12 items-center justify-center rounded-lg border border-[var(--text-on-accent)] px-6 text-[15px] font-medium text-[var(--text-on-accent)] transition-colors duration-150 hover:bg-[var(--accent-hover)]';

/**
 * @param {{
 *   guest: { available: boolean, loading: boolean },
 *   error: string | null,
 *   onTry: () => void,
 *   onAccent?: boolean,
 * }} props
 */
const StartButtons = ({ guest, error, onTry, onAccent = false }) => {
  const { isAuthenticated } = useAuth();
  const primary = onAccent ? ON_ACCENT_PRIMARY : PRIMARY;
  const secondary = onAccent ? ON_ACCENT_SECONDARY : SECONDARY;

  if (isAuthenticated) {
    return (
      <Link to={ROUTES.DASHBOARD} className={primary}>
        Go to dashboard
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {guest.available ? (
          <button type="button" className={primary} onClick={onTry} disabled={guest.loading}>
            {guest.loading ? 'Starting your session...' : 'Try it now, no sign-up'}
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : (
          <Link to={ROUTES.REGISTER} className={primary}>
            Get started
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
        {guest.available ? (
          <Link to={ROUTES.REGISTER} className={secondary}>
            Create an account
          </Link>
        ) : (
          <Link to={ROUTES.LOGIN} className={secondary}>
            Log in
          </Link>
        )}
      </div>
      <div
        role="alert"
        className={`text-[14px] ${onAccent ? 'text-[var(--text-on-accent)]' : 'text-[var(--signal-negative)]'}`}
      >
        {error && <p className="mt-3">{error}</p>}
      </div>
    </div>
  );
};

export default StartButtons;