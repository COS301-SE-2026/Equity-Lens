import { Menu, Sun, Moon } from 'lucide-react';
import { useThemeContext } from '../../../context/ThemeContext.jsx';
import useAuth from '../../../hooks/useAuth';

const MARKET_DATA = [
  { label: 'JSE·ALSI', value: '81,204', change: '+0.84%', positive: true },
  { label: 'USD/ZAR', value: '18.42', change: '-0.31%', positive: false },
  { label: 'BRENT', value: '83.14', change: '+1.12%', positive: true },
];

const Topbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeContext();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const timestamp = new Date().toISOString().slice(0, 10);

  return (
    <header
      style={{
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--surface-raised)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onMenuClick}
          className="lg:hidden"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          aria-label="Open menu"
        >
          <Menu size={14} />
        </button>

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

        <span style={{ color: 'var(--border-mid)', fontSize: '14px' }}>|</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="hidden md:flex">
          {MARKET_DATA.map((m) => (
            <div
              key={m.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: 'var(--text-ghost)' }}>{m.label}</span>
              <span style={{ color: 'var(--text-primary)' }}>{m.value}</span>
              <span style={{ color: m.positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                {m.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          className="hidden sm:block"
          style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}
        >
          {user?.full_name?.split(' ')[0] ?? 'there'}
        </span>

        <button
          onClick={toggleTheme}
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>

        <button
          onClick={logout}
          style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-primary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 120ms ease-out',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Sign out
        </button>

        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--accent-subtle)',
          border: '1px solid var(--border-accent)',
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--signal-gold)',
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
