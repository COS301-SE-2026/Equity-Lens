import Button from '../../common/Button/Button';

import useGuestStart from './useGuestStart';

/**
 * shared by Login and Register, errors go to the page's own alert
 * @param {{
 *   onError: (message: string | null) => void,
 *   disabled?: boolean,
 * }} props
 */
const GuestStart = ({ onError, disabled = false }) => {
  const { available, loading, start } = useGuestStart(onError);

  if (!available) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4" aria-hidden="true">
        <span className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-xs text-[var(--text-secondary)]">or</span>
        <span className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>
      <Button variant="secondary" fullWidth loading={loading} disabled={disabled} onClick={start}>
        Continue as guest
      </Button>
    </div>
  );
};

export default GuestStart;
