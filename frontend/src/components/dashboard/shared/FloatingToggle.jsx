import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';

import { GlassPanel } from './GlassPanel';

/**
 * @param {{
 *   label: string,
 *   icon: React.ReactNode,
 *   open: boolean,
 *   onToggle: () => void,
 *   panelMaxHeight: string,
 *   direction?: 'up'|'down',
 *   children: React.ReactNode,
 * }} props
 */
const FloatingToggle = ({
  label,
  icon,
  open,
  onToggle,
  panelMaxHeight,
  direction = 'up',
  children,
}) => { const slowMo = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    /** @param {KeyboardEvent} e */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onToggle();};
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);}, [open, onToggle]);

  return (
    <div
    className={`flex items-end gap-3 ${direction === 'down' ? 'flex-col' : 'flex-col-reverse'}`}>
      <button
        type="button"
        aria-label={open ? `Close ${label}` : `Open ${label}`}
        aria-expanded={open}
        onClick={onToggle}
        className={`pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${open ? '' : 'glass-surface hover:bg-[var(--glass-hover)]'}`}
        style={{
          background: open ? 'var(--accent-primary)' : undefined,
          color: open ? 'var(--text-on-accent)' : 'var(--accent-primary)',
          border: open ? '1px solid var(--accent-hover)' : undefined,
          boxShadow: open ? '0 4px 16px rgba(var(--accent-primary-rgb), 0.35)' : undefined,}}>
        {icon}
      </button>
      {open && (
        <motion.div
          initial={
            slowMo ? { opacity: 0 }
              : { opacity: 0, y: direction === 'down' ? -12 : 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="w-[min(92vw,360px)]"
          role="dialog"
          aria-label={label}
          aria-modal="false">
          <GlassPanel
            blurred
            className="flex flex-col shadow-2xl"
            style={{ maxHeight: panelMaxHeight }}>
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: 'var(--text-ghost)' }}>
                {label}
              </span>
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={onToggle}
                className="rounded-md p-1 transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-ghost)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </GlassPanel>
        </motion.div>)}
    </div>);};

export default FloatingToggle;