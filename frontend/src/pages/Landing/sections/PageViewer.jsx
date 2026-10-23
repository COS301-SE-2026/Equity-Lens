import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { ROUTES } from '../../../utils/constants';
import { PAGES, fullImage } from '../landingData';
import { EASE, MICRO, SECTION } from '../motion';

import PageDrawing from './PageDrawing';

const NAV_BUTTON =
  'inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--border-mid)] px-3 text-[14px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-hover)]';
const CTA =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-5 text-[15px] font-semibold text-[var(--text-on-accent)] transition-colors duration-150 hover:bg-[var(--accent-hover)] disabled:opacity-60';

/**
 * @param {{
 *   index: number,
 *   onIndex: (index: number) => void,
 *   onClose: () => void,
 *   cta: { guest: { available: boolean, loading: boolean }, error: string | null, onTry: () => void },
 * }} props
 */
const PageViewer = ({ index, onIndex, onClose, cta }) => {
  const reduce = useReducedMotion();
  const { isAuthenticated } = useAuth();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const page = PAGES[index];
  const last = PAGES.length - 1;
  const previous = index === 0 ? last : index - 1;
  const next = index === last ? 0 : index + 1;

  useEffect(() => {
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      root.style.overflow = overflow;
    };
  }, []);

  /** @param {import('react').KeyboardEvent} e */
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowRight') {
      onIndex(next);
    } else if (e.key === 'ArrowLeft') {
      onIndex(previous);
    } else if (e.key === 'Tab' && panelRef.current) {
      // keep tab inside the dialog
      const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])');
      const first = /** @type {HTMLElement} */ (focusable[0]);
      const end = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && active === end) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  let action;
  if (isAuthenticated) {
    action = (
      <Link to={page.route} className={CTA}>
        Open {page.name}
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </Link>
    );
  } else if (cta.guest.available) {
    action = (
      <button type="button" className={CTA} onClick={cta.onTry} disabled={cta.guest.loading}>
        {cta.guest.loading ? 'Starting your session...' : 'Try it with your own statement'}
      </button>
    );
  } else {
    action = (
      <Link to={ROUTES.REGISTER} className={CTA}>
        Get started
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </Link>
    );
  }

  const fade = reduce
    ? { initial: false }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: SECTION, ease: EASE },
      };
  const grow = reduce
    ? { initial: false }
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: SECTION, ease: EASE },
      };

  return createPortal(
    <div
      data-theme="light"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
    >
      <motion.div
        {...fade}
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--scrim)]"
        onClick={onClose}
      />
      <motion.div
        {...grow}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewer-title"
        aria-describedby="viewer-line"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative max-h-full w-full max-w-6xl overflow-y-auto rounded-2xl bg-[var(--surface-base)] p-5 text-[var(--text-primary)] shadow-[var(--shadow-modal)] outline-none focus-visible:outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--accent-primary)]">
              <span className="tabular-nums">
                {index + 1} / {PAGES.length}
              </span>
            </p>
            <h2
              id="viewer-title"
              className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]"
            >
              {page.name}
            </h2>
            <p id="viewer-line" className="mt-1 text-[16px] text-[var(--text-secondary)]">
              {page.line}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border-mid)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
          <figure>
            <div className="overflow-hidden rounded-xl border border-[var(--border-mid)] bg-[var(--surface-raised)]">
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
                <span aria-hidden="true" className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-strong)]" />
                </span>
                <span className="min-w-0 flex-1 truncate rounded-md bg-[var(--surface-base)] px-3 py-1 font-mono text-[12px] text-[var(--text-secondary)]">
                  equitylens.co.za{page.route}
                </span>
              </div>
              <div className="relative aspect-[16/10] bg-[var(--text-primary)]">
                {page.shot ? (
                  <img
                    {...fullImage(page.id)}
                    width={1440}
                    height={900}
                    alt={page.alt}
                    decoding="async"
                    className="block h-full w-full"
                  />
                ) : (
                  <PageDrawing id={page.id} />
                )}
                {page.callouts.map((callout, i) => (
                  <motion.span
                    key={`${page.id}-${i}`}
                    aria-hidden="true"
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: MICRO, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.15 }}
                    className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--accent-primary)] font-mono text-[13px] font-semibold text-[var(--text-on-accent)] ring-4 ring-[rgba(var(--accent-primary-rgb),0.3)]"
                    style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
                  >
                    {i + 1}
                  </motion.span>
                ))}
              </div>
            </div>
            <figcaption className="mt-3 text-[13px] text-[var(--text-dim)]">
              {page.shot
                ? 'Real EquityLens screen, shown with a sample portfolio and sample market data.'
                : 'A simple drawing of this page, not a screenshot.'}
              {page.note && ` ${page.note}`}
            </figcaption>
          </figure>

          <div className="flex flex-col">
            <ol className="grid gap-4">
              {page.callouts.map((callout, i) => (
                <li key={`${page.id}-${i}`} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--accent-primary)] font-mono text-[13px] text-[var(--accent-primary)]"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-[15px] leading-snug text-[var(--text-secondary)]">
                    {callout.text}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-8 lg:mt-auto">
              {action}
              <div role="alert" className="text-[14px] text-[var(--signal-negative)]">
                {cta.error && <p className="mt-3">{cta.error}</p>}
              </div>
              <div className="mt-4 flex justify-between gap-3">
                <button type="button" className={NAV_BUTTON} onClick={() => onIndex(previous)}>
                  <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
                  Previous
                </button>
                <button type="button" className={NAV_BUTTON} onClick={() => onIndex(next)}>
                  Next
                  <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
};

export default PageViewer;