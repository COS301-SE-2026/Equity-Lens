import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Newspaper,
  Briefcase,
  X, 
  Sparkles
} from 'lucide-react';
import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  { label: 'Portfolio', icon: Briefcase, to: ROUTES.PORTFOLIO },
  { label: 'News', icon: Newspaper, to: ROUTES.NEWS },
  { label: 'AI Assistant', icon: Sparkles, to: ROUTES.AI_CHAT}
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
          background: 'var(--surface-raised)',
          borderRight: '1px solid var(--border-subtle)',
        }}
        aria-label="Sidebar navigation"
      >
        <div style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-primary)',
            whiteSpace: 'nowrap',
          }}>
            EQUITY<span style={{ color: 'var(--signal-gold)' }}>LENS</span>
          </span>
          <button
            onClick={onClose}
            className="lg:hidden"
            style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          <p style={{
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-ghost)',
            padding: '0 16px 8px',
            fontFamily: 'var(--font-primary)',
          }}>
          </p>

          {navItems.map(({ label, icon: Icon, to, badge }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: 'var(--font-primary)',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(212,160,23,0.06)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--signal-gold)' : '2px solid transparent',
                textDecoration: 'none',
                transition: 'all 120ms ease-out',
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={14} />
                {label}
              </div>
              {badge && (
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: 'var(--signal-gold)',
                  color: '#000',
                  fontFamily: 'var(--font-primary)',
                }}>
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: '9px', color: 'var(--text-ghost)', fontFamily: 'var(--font-primary)' }}>
            COS 301 Capstone 2026
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
