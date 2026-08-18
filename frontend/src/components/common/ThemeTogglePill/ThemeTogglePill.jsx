import { motion, useReducedMotion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useThemeContext } from '../../../context/ThemeContext.jsx';

const ThemeTogglePill = () => {
  const { theme, toggleTheme } = useThemeContext();
  const isDark = theme === 'dark';
  const reduceMotion = useReducedMotion();

  const glowTransition = /** @type {import('framer-motion').Transition} */ (
    reduceMotion
      ? { duration: 0 }
      : { type: 'spring', stiffness: 500, damping: 30 });

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="pressable glass-surface flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3"
    >
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full">
        {!isDark && (
          <motion.span
            layoutId="theme-toggle-glow"
            transition={glowTransition}
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--accent-primary)', boxShadow: '0 0 10px rgba(var(--accent-primary-rgb), 0.55)' }}/>)}
        <Sun size={12} className="relative" style={{ color: !isDark ? 'var(--text-on-accent)' : 'var(--text-ghost)' }} />
      </span>

      <span className="relative flex h-6 w-6 items-center justify-center rounded-full">
        {isDark && (
          <motion.span
            layoutId="theme-toggle-glow"
            transition={glowTransition}
            className="absolute inset-0 rounded-full"
            style={{ background: 'var(--accent-primary)', boxShadow: '0 0 10px rgba(var(--accent-primary-rgb), 0.55)' }}/>)}
        <Moon size={12} className="relative" style={{ color: isDark ? 'var(--text-on-accent)' : 'var(--text-ghost)' }} />
      </span>

      <span className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>);};

export default ThemeTogglePill;
