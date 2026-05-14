import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  BarChart2,
  Newspaper,
  Bot,
  Briefcase,
  X,
} from 'lucide-react';
import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  { label: 'Portfolio', icon: Briefcase, to: ROUTES.PORTFOLIO },
  { label: 'Analytics', icon: BarChart2, to: ROUTES.ANALYTICS },
  { label: 'News', icon: Newspaper, to: ROUTES.NEWS },
  { label: 'AI Assistant', icon: Bot, to: ROUTES.AI_CHAT, badge: 'NEW' },
];
const Sidebar = ({ open, onClose }) => {
  return (
    <>
      {/* Mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-60 z-30
          bg-[var(--bg-primary)] border-r border-[var(--border-default)]
          flex flex-col
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.svg" alt="EquityLens" className="h-8 w-8" />
            <span className="font-bold text-base text-[var(--text-primary)]">
              EquityLens
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
         <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest px-3 mb-2">
            Menu
          </p>
          {navItems.map(({ label, icon: Icon, to, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `
                flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} />
                {label}
              </div>
              {badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-primary)] text-black">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-default)]">
          <p className="text-[11px] text-[var(--text-secondary)]">
            COS 301 Capstone 2026
          </p>
          <p className="text-[11px] text-[var(--text-secondary)]">
            The Big Five (TB5)
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
