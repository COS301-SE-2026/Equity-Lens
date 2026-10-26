import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import useAuth from '../../../hooks/useAuth';
import { ROUTES } from '../../../utils/constants';
import Wordmark from '../Wordmark';

const ANCHORS = [
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Security', href: '#security' },
];

const LINK =
  'inline-flex min-h-11 items-center rounded-lg px-3 text-[14px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]';
const PRIMARY =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent-primary)] px-4 text-[14px] font-semibold text-[var(--text-on-accent)] transition-colors duration-150 hover:bg-[var(--accent-hover)]';

const Nav = () => {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(/** @type {HTMLButtonElement | null} */ (null));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  const actions = isAuthenticated ? (
    <Link to={ROUTES.DASHBOARD} className={PRIMARY} onClick={close}>
      Go to dashboard
    </Link>
  ) : (
    <>
      <Link to={ROUTES.LOGIN} className={LINK} onClick={close}>
        Log in
      </Link>
      <Link to={ROUTES.REGISTER} className={PRIMARY} onClick={close}>
        Get started
      </Link>
    </>
  );

  return (
    <nav
      aria-label="Primary"
      className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? 'border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--accent-primary)] focus:px-3 focus:py-1.5 focus:text-[13px] focus:font-semibold focus:text-[var(--text-on-accent)]"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link to={ROUTES.HOME} aria-label="EquityLens home" className="rounded-lg">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {ANCHORS.map((item) => (
            <a key={item.href} href={item.href} className={LINK}>
              {item.label}
            </a>
          ))}
          <Link to={ROUTES.HELP} className={LINK}>
            Help Centre
          </Link>
          <span className="ml-3 flex items-center gap-2">{actions}</span>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-[var(--border-subtle)] lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-8">
            {ANCHORS.map((item) => (
              <a key={item.href} href={item.href} className={LINK} onClick={close}>
                {item.label}
              </a>
            ))}
            <Link to={ROUTES.HELP} className={LINK} onClick={close}>
              Help Centre
            </Link>
            <div className="mt-2 flex flex-col gap-2">{actions}</div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Nav;
