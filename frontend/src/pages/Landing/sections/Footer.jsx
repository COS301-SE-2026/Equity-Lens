import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '../../../utils/constants';
import { CONTACT_EMAIL, PAGES, REPO_URL } from '../landingData';
import Wordmark from '../Wordmark';

const LINK =
  'inline-flex min-h-11 items-center text-[14px] lg:min-h-9 text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]';

const Footer = () => {
  const [copyStatus, setCopyStatus] = useState('');

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Could not copy, select the address instead');
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <footer>
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--text-dim)]">
            Portfolio analytics for South African retail investors, built by The Big Five.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Product
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6">
            {PAGES.map((page) => (
              <li key={page.id}>
                <a href={`#page-${page.id}`} className={LINK}>
                  {page.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Contact
          </p>
          <ul className="mt-2">
            <li className="flex flex-wrap items-center gap-x-3">
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                {CONTACT_EMAIL}
              </a>
              <button
                type="button"
                onClick={copyEmail}
                className="min-h-11 rounded-lg border border-[var(--border-mid)] px-3 text-[13px] text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
              >
                Copy email
              </button>
              <span role="status" className="text-[13px] text-[var(--text-secondary)]">
                {copyStatus}
              </span>
            </li>
            <li>
              <Link to={ROUTES.HELP} className={LINK}>
                Help Centre
              </Link>
            </li>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
                GitHub repository
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-[var(--border-subtle)] px-4 py-6 text-center text-[13px] text-[var(--text-dim)]">
        COS 301 Capstone · University of Pretoria · Built for AWS
      </p>
    </footer>
  );
};

export default Footer;