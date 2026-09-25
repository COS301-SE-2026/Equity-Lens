import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard,
  Briefcase,
  BarChart2,
  Newspaper,
  Sparkles,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';

import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, Icon: LayoutDashboard },
  { label: 'Portfolio', to: ROUTES.PORTFOLIO, Icon: Briefcase },
  { label: 'Analytics', to: ROUTES.ANALYTICS, Icon: BarChart2 },
  { label: 'News', to: ROUTES.NEWS, Icon: Newspaper },
  { label: 'AI Assistant', to: ROUTES.AI_CHAT, Icon: Sparkles },
  { label: 'Settings', to: ROUTES.SETTINGS, Icon: Settings },
  { label: 'Help', to: ROUTES.HELP, Icon: HelpCircle },
];

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
const Sidebar = ({ open, onClose }) => {
  /** @type {React.MutableRefObject<HTMLElement | null>} */
  const drawerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;

    /** @param {MouseEvent} e */
    const handleClick = (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (
        drawerRef.current &&
        !drawerRef.current.contains(target) &&
        !target.closest('[data-nav-trigger]')
      ) {
        onClose();
      }
    };
    /** @param {KeyboardEvent} e */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            data-testid="nav-overlay"
            className="fixed inset-0 z-30"
            style={{ background: 'var(--scrim)', backdropFilter: 'blur(2px)' }}
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          />

          <motion.nav
            ref={drawerRef}
            aria-label="Main navigation"
            className="fixed left-0 z-40 flex flex-col gap-1 overflow-y-auto px-3 py-4"
            style={{
              top: '72px',
              bottom: 0,
              width: 'min(84vw, 268px)',
              background: 'var(--surface-raised)',
              borderRight: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: '-100%' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: '-100%' }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            {navItems.map(({ label, to, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `sidebar-nav-item pressable flex items-center gap-3 rounded-lg${isActive ? ' is-active' : ''}`
                }
                style={({ isActive }) => ({
                  padding: '12px 14px',
                  minHeight: '48px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: 'none',
                  // accent rail marks the current page without reshaping the row into a pill
                  boxShadow: isActive ? 'inset 3px 0 0 var(--accent-primary)' : undefined,
                })}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
