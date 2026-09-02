import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD },
  { label: 'Portfolio', to: ROUTES.PORTFOLIO },
  { label: 'Analytics', to: ROUTES.ANALYTICS },
  { label: 'News', to: ROUTES.NEWS },
  { label: 'AI Assistant', to: ROUTES.AI_CHAT },
  { label: 'Settings', to: ROUTES.SETTINGS},
  { label: 'Help', to: ROUTES.HELP },
];

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
const Sidebar = ({ open, onClose }) => {
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const wrapperRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;

    /** @param {MouseEvent} e */
    const handleClick = (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (wrapperRef.current && !wrapperRef.current.contains(target) && !target.closest('[data-nav-trigger]')) {
        onClose();
      }
    };
    /** @param {KeyboardEvent} e */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();};

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={wrapperRef}>
      <AnimatePresence>
        {open && (
          <nav
            aria-label="Main navigation"
            className="fixed z-30 flex flex-col gap-2.5"
            style={{ top: '84px', left: '24px' }}>
            {navItems.map(({ label, to }, i) => (
              <motion.div
                key={to}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -18, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -18, scale: 0.9 }}
                transition={{
                  duration: 0.22,
                  delay: shouldReduceMotion ? 0 : i * 0.045,
                  ease: [0.16, 1, 0.3, 1],}}>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className="pressable glass-surface glass-control flex items-center rounded-full"
                  style={({ isActive }) => ({
                    padding: '11px 22px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    boxShadow: isActive
                      ? 'var(--shadow-card), inset 0 1px 0 var(--glass-highlight), inset 0 0 0 1.5px var(--accent-primary)'
                      : undefined,
                  })}
                >
                  {label}
                </NavLink>
              </motion.div>
            ))}
          </nav>)}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
