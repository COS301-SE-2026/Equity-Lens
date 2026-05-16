import { Menu, Sun, Moon } from 'lucide-react';
import useAuth from '../../../hooks/useAuth';
import useTheme from '../../../hooks/useTheme';

const MARKET_DATA = [
  { label: 'JSE·ALSI', value: '81,204', change: '+0.84%', positive: true },
  { label: 'USD/ZAR', value: '18.42', change: '−0.31%', positive: false },
  { label: 'BRENT', value: '83.14', change: '+1.12%', positive: true },
];

const Topbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10);

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: '36px',
        background: 'var(--surface-base)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Open menu"
        >
          <Menu size={14} />
        </button>

        <span
          className="font-terminal text-[10px] hidden sm:block"
          style={{ color: 'var(--text-ghost)' }}
        >
          {timestamp} · SAST
        </span>

        <span style={{ color: 'var(--border-subtle)' }}>|</span>

        <div className="hidden md:flex items-center gap-4">
          {MARKET_DATA.map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 font-terminal text-[10px]">
              <span style={{ color: 'var(--text-ghost)' }}>{m.label}</span>
              <span style={{ color: 'var(--text-primary)' }}>{m.value}</span>
              <span
                style={{
                  color: m.positive
                    ? 'var(--signal-positive)'
                    : 'var(--signal-negative)',
                }}
              >
                {m.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {user?.full_name?.split(' ')[0] ?? 'there'}
        </span>

        <button
          onClick={toggleTheme}
          className="transition-colors"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Toggle theme"
        >
          {theme === 'dark'
            ? <Sun size={13} />
            : <Moon size={13} />
          }
        </button>

        <button
          onClick={logout}
          className="text-[10px] transition-colors"
          style={{ color: 'var(--text-dim)' }}
        >
          Sign out
        </button>

        <div
          className="w-5 h-5 rounded-full flex items-center justify-center font-terminal text-[9px] font-semibold"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--signal-gold)',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
};

export default Topbar;