import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const IDLE_MS = 1800;
const PRESS_MS = 80;

/**
 * @param {{ questions: string[], label?: string, className?: string }} props
 */
const CardMascotTrigger = ({
  questions,
  label = 'Ask AI about this',
  className = 'right-3 top-3',
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const wrapperRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [cardHovered, setCardHovered] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  const isRevealed = cardHovered || buttonFocused;
  const [isIdle, setIsIdle] = useState(false);
  const [idleVariant, setIdleVariant] = useState(0);
  /** @type {React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>} */
  const dwellTimeoutRef = useRef(undefined);
  const [pressed, setPressed] = useState(false);
  /** @type {React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>} */
  const pressTimeoutRef = useRef(undefined);
  const wiggle = isIdle && idleVariant === 0;
  const shine = isIdle && idleVariant === 1;

  useEffect(() => {
    if (!open) return undefined;

    /** @param {MouseEvent} e */
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(/** @type {Node} */ (e.target)))
        setOpen(false);};
    /** @param {KeyboardEvent} e */
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const card = wrapperRef.current?.parentElement;
    if (!card) return undefined;
    const onEnter = () => setCardHovered(true);
    const onLeave = () => setCardHovered(false);
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    return () => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => {
    if (!isRevealed || shouldReduceMotion) {
      setIsIdle(false);
      clearTimeout(dwellTimeoutRef.current);
      return undefined;}
    dwellTimeoutRef.current = setTimeout(() => {
      setIdleVariant((v) => (v === 0 ? 1 : 0));
      setIsIdle(true);
    }, IDLE_MS);
    return () => clearTimeout(dwellTimeoutRef.current);
  }, [isRevealed, shouldReduceMotion]);

  useEffect(() => () => clearTimeout(pressTimeoutRef.current), []);

  if (!questions.length) return null;

  /** @param {string} question */
  const ask = (question) => navigate(`/ai?q=${encodeURIComponent(question)}`);

  const handleTriggerClick = () => {
    setPressed(true);
    clearTimeout(pressTimeoutRef.current);
    pressTimeoutRef.current = setTimeout(() => setPressed(false), PRESS_MS);

    if (questions.length === 1) {
      ask(questions[0]);
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={wrapperRef} className={`absolute z-10 ${className}`}>
      <motion.button
        type="button"
        aria-label={label}
        aria-expanded={questions.length > 1 ? open : undefined}
        onClick={handleTriggerClick}
        onFocus={() => setButtonFocused(true)}
        onBlur={() => setButtonFocused(false)}
        className="flex h-9 items-center gap-1.5 rounded-lg pl-2.5 pr-3 opacity-0 transition-opacity duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-light)] group-hover:opacity-100"
        style={{
          background: 'var(--accent-primary)',

          color: '#FFFFFF',
          boxShadow: '0 6px 18px rgba(var(--accent-primary-rgb), 0.38)',
        }}
        initial={false}
        animate={{ scale: pressed ? 0.94 : 1, y: isRevealed || shouldReduceMotion ? 0 : -3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <motion.svg
          aria-hidden="true"
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={wiggle ? { rotate: [-7, 7] } : { rotate: 0 }}
          transition={
            wiggle
              ? { duration: 2.4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
          }
        >
          <line
            x1="15.9"
            y1="15.9"
            x2="21.9"
            y2="21.9"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="9.9" cy="9.9" r="7.6" fill="rgba(255,255,255,0.16)" />
          <circle cx="9.9" cy="9.9" r="7.6" stroke="currentColor" strokeWidth="1.9" />
          <motion.path
            d="M5.5 6.7 A6 6 0 0 1 11.3 3.8"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.2"
            strokeLinecap="round"
            animate={shine ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.35 }}
            transition={
              shine ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.15 }
            }
          />
        </motion.svg>

        <span
          aria-hidden="true"
          className="whitespace-nowrap text-[11px] font-semibold leading-none tracking-wide"
        >
          EquityLens Insight
        </span>
      </motion.button>

      <AnimatePresence>
        {open && questions.length > 1 && (
          <motion.div
            role="menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-11 z-20 w-64 rounded-xl p-1.5 shadow-lg"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
            }}>
            {questions.map((question) => (
              <button
                key={question}
                type="button"
                role="menuitem"
                onClick={() => ask(question)}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}>
                {question}
              </button>
            ))}
          </motion.div>)}
      </AnimatePresence>
    </div>);};

export default CardMascotTrigger;