import { Menu, Sun, Moon, Bell, ChevronDown } from 'lucide-react';
import useAuth from '../../../hooks/useAuth';
import useTheme from '../../../hooks/useTheme';

const Topbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';
 return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-[var(--border-default)] bg-[var(--bg-primary)] sticky top-0 z-10">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg px-3 py-2 w-64">
          <svg
            className="text-[var(--text-secondary)] w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search or type command..."
            className="bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none w-full"
            aria-label="Search"
          />
          <span className="text-xs text-[var(--text-secondary)] border border-[var(--border-default)] rounded px-1">
</span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--accent-primary)] rounded-full" />
        </button>

        {/* User menu */}
        <button
          onClick={logout}
          className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-all"
          aria-label="User menu"
 >
          <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-[var(--text-primary)]">
            {user?.full_name?.split(' ')[0] || 'User'}
          </span>
          <ChevronDown size={14} className="text-[var(--text-secondary)]" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
