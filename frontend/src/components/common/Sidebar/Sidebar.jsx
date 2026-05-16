import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Newspaper,
  Briefcase,
  X,
} from 'lucide-react';
import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  { label: 'Portfolio', icon: Briefcase, to: ROUTES.PORTFOLIO },
  { label: 'News', icon: Newspaper, to: ROUTES.NEWS },
];

const Sidebar = ({ open, onClose }) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-52 z-30
          flex flex-col
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
        style={{
          background: 'var(--surface-base)',
          borderRight: '1px solid var(--border-subtle)',
        }}
        aria-label="Sidebar navigation"
      >
        <div
          className="h-9 flex items-center justify-between px-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.12em' }}
          >
            EQUITY<span style={{ color: 'var(--signal-gold)' }}>LENS</span>
          </span>
          <button
            onClick={onClose}
            className="lg:hidden"
            style={{ color: 'var(--text-dim)' }}
            aria-label="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>

        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto">
          <p
            className="text-[9px] font-semibold uppercase px-4 pb-2"
            style={{ color: 'var(--text-ghost)', letterSpacing: '0.12em' }}
          >
            Workspace
          </p>

          {navItems.map(({ label, icon: Icon, to, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center justify-between px-4 py-2 text-xs transition-all duration-150"
              style={({ isActive }) => ({
                color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                background: isActive ? 'rgba(212, 160, 23, 0.06)' : 'transparent',
                borderLeft: isActive
                  ? '2px solid var(--signal-gold)'
                  : '2px solid transparent',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              <div className="flex items-center gap-2.5">
                <Icon size={14} />
                {label}
              </div>
              {badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                  style={{
                    background: 'var(--signal-gold)',
                    color: '#080A0C',
                    letterSpacing: '0.04em',
                  }}
                >
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--signal-positive)' }}
            />
            <span
              className="text-[9px] font-terminal uppercase tracking-wider"
              style={{ color: 'var(--text-ghost)' }}
            >
              JSE · LIVE · POPI
            </span>
          </div>
          <p className="text-[9px]" style={{ color: 'var(--text-ghost)' }}>
            COS 301 Capstone 2026
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;