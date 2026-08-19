import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

export default function HelpTooltip({ text }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const buttonRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!visible) { return; }
    function syncPosition() {
      if (!buttonRef.current) { return; }
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 208;
      let left = rect.left + rect.width / 2 - width / 2;
      if (left < 8) { left = 8; }
      if (left + width > window.innerWidth - 8) { left = window.innerWidth - width - 8; }
      setPos({ left, bottom: window.innerHeight - rect.top + 8, });}

    syncPosition();

    const handleKeyDown = (e) => {
    if (e.key === 'Escape') setVisible(false); };
    window.addEventListener('scroll', syncPosition, true);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', syncPosition, true);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('keydown', handleKeyDown);};
    }, [visible]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center focus-visible:outline-none"
        style={{ color: 'var(--text-ghost)' }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="What does this mean?" >
        <HelpCircle size={12} />
      </button>
      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.span
              role="tooltip"
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 4, scale: shouldReduceMotion ? 1 : 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: shouldReduceMotion ? 0 : 4, scale: shouldReduceMotion ? 1 : 0.95 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none fixed rounded-lg px-3 py-2 text-[11px] leading-snug"
              style={{
                left: pos.left,
                bottom: pos.bottom,
                width: 208,
                zIndex: 9999,
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-mid)',
                color: 'var(--text-secondary)',
                boxShadow: 'var(--shadow-elevated)',
              }} >
              {text}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}