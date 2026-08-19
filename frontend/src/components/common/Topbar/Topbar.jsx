import { Menu, X, Eye, EyeOff } from 'lucide-react';
import useBlur from '../../../hooks/useBlur';
import useAuth from '../../../hooks/useAuth';
import useDashboardTicker from '../../../hooks/useDashboardTicker';
import HoldingsTicker from '../../dashboard/HoldingsTicker/HoldingsTicker';
import ThemeTogglePill from '../ThemeTogglePill/ThemeTogglePill';
/*
 * @param {{ onMenuClick: () => void, sidebarOpen: boolean }} props
 */
const Topbar = ({ onMenuClick, sidebarOpen }) => {
  const { user, logout } = useAuth();
  const { blurMoney, toggleBlurMoney } = useBlur();
  const { holdings } = useDashboardTicker();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const timestamp = new Date().toISOString().slice(0, 10);

  return (
    <header
      className="glass-surface"
      style={{
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        flexShrink: 0,
        position: 'relative',
        zIndex: 40,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <button
          onClick={onMenuClick}
          data-nav-trigger="true"
          className="pressable glass-surface glass-control"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: sidebarOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
            flexShrink: 0,
          }}
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <span style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',}}>
            EQUITY
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--accent-primary)',
              fontFamily: 'var(--font-mono)',}}>
            LENS
          </span>
        </span>

        <span style={{
          fontSize: '10px',
          color: 'var(--text-ghost)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          display: 'none',
        }}
          className="sm:block"
        >
          {timestamp} · SAST
        </span>

        <HoldingsTicker holdings={holdings} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={toggleBlurMoney}
          aria-pressed={blurMoney}
          className="pressable glass-surface glass-control"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: blurMoney ? 'var(--accent-primary)' : 'var(--text-secondary)',
            flexShrink: 0,}}
          aria-label={blurMoney ? 'Show monetary values' : 'Blur monetary values'}
          title="Blur rand values - handy while screen-sharing. Blurred text is still selectable, this only hides it visually.">
          {blurMoney ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <ThemeTogglePill />

        <button
          onClick={logout}
          className="pressable glass-surface glass-control"
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-primary)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px 14px',
            borderRadius: '9999px',
          }}
        >
          Sign out
        </button>

        <div className="glass-surface glass-control" style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--accent-primary)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
