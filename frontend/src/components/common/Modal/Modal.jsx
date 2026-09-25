import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const LAYER = 1000;

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title: string,
 *   children: React.ReactNode,
 *   maxWidth?: string,
 * }} props
 */
const Modal = ({ open, onClose, title, children, maxWidth = '640px' }) => {
  const titleId = useId();
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const panelRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLElement | null>} */
  const returnFocusTo = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    returnFocusTo.current = active instanceof HTMLElement ? active : null;
    panelRef.current?.focus();
    return () => {
      returnFocusTo.current?.focus();
    };
  }, [open]);

  /** @param {React.KeyboardEvent<HTMLDivElement>} e */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;

    const items = /** @type {HTMLElement[]} */ ([
      ...panelRef.current.querySelectorAll(FOCUSABLE),
    ]);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: LAYER }}>
          <motion.div
            role="presentation"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0"
            style={{ background: 'var(--scrim)' }}/>

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="glass-surface-elevated relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-2xl focus-visible:outline-none"
            style={{ maxWidth }}>
            <div
              className="flex shrink-0 items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h2
                id={titleId}
                className="font-mono text-[12px] tracking-widest"
                style={{ color: 'var(--text-primary)' }}>
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="pressable rounded-md p-1 transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );};

export default Modal;
