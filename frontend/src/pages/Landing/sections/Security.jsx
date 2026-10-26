import { motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, FileLock2, KeyRound, MapPin, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';

import { SAMPLE_AMOUNTS } from '../landingData';
import { reveal } from '../motion';

const FACTS = [
  {
    Icon: FileLock2,
    title: 'Read in your browser',
    body: 'The file stays on your device, only figures are saved.',
  },
  {
    Icon: KeyRound,
    title: 'Authenticator-app sign-in',
    body: 'A six-digit code and your password.',
  },
  { Icon: MapPin, title: 'Hosted in Cape Town', body: 'AWS region af-south-1.' },
  {
    Icon: Trash2,
    title: 'Delete your data any time',
    body: 'One button in Settings.',
  },
  {
    Icon: UserX,
    title: 'Guest data is deleted',
    body: 'Everything goes when the session ends.',
  },
];

const Security = () => {
  const reduce = useReducedMotion();
  const [blurred, setBlurred] = useState(false);

  return (
    <section
      id="security"
      aria-labelledby="security-heading"
      className="mx-auto max-w-7xl scroll-mt-16 px-6 pb-20 pt-10 sm:px-8 lg:pb-32 lg:pt-10"
    >
      <motion.div {...reveal(reduce)}>
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--accent-primary)]">
          Security and privacy
        </p>
        <h2
          id="security-heading"
          className="mt-4 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]"
        >
          Your portfolio stays yours.
        </h2>
      </motion.div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <ul className="grid gap-8 sm:grid-cols-2">
          {FACTS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <Icon
                size={20}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-[var(--accent-primary)]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-[20px] font-semibold text-[var(--text-primary)]">{title}</h3>
                <p className="mt-1 text-[16px] leading-relaxed text-[var(--text-secondary)]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* the same idea as the eye in the app's top bar: amounts blur for screen sharing */}
        <motion.div
          {...reveal(reduce, 0.1)}
          className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-[15px] font-semibold text-[var(--text-primary)]">
              Sharing your screen?
            </p>
            <button
              type="button"
              onClick={() => setBlurred((v) => !v)}
              aria-pressed={blurred}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-mid)] px-4 text-[14px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--surface-hover)]"
            >
              {blurred ? (
                <EyeOff size={18} strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Eye size={18} strokeWidth={1.5} aria-hidden="true" />
              )}
              Blur amounts
            </button>
          </div>
          <dl
            className={`mt-4 grid gap-2 ${blurred ? 'money-blurred' : ''}`}
            data-testid="sample-amounts"
          >
            {SAMPLE_AMOUNTS.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-[var(--border-subtle)] pb-3"
              >
                <dt className="text-[14px] text-[var(--text-secondary)]">{row.label}</dt>
                <dd className="money-value font-mono text-[18px] tabular-nums text-[var(--text-primary)]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-[var(--text-dim)]">
            Sample figures. In the app, the eye in the top bar does the same.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Security;