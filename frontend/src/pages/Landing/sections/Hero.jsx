import { useReducedMotion } from 'framer-motion';

import { PAGES } from '../landingData';

import LensDemo from './LensDemo';
import StartButtons from './StartButtons';

const CHIP =
  'inline-flex min-h-9 items-center rounded-full border border-[var(--border-mid)] px-3 text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]';

/**
 * @param {{ cta: import('react').ComponentProps<typeof StartButtons> }} props
 */
const Hero = ({ cta }) => {
  const reduce = useReducedMotion();

  /** @param {string} id */
  const showCard = (id) => {
    const card = document.getElementById(`page-${id}`);
    if (!card) return;
    card.scrollIntoView({
      block: 'center',
      inline: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    });
    card.focus({ preventScroll: true });
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:pb-20 lg:pt-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(560px circle at 72% 42%, rgba(var(--accent-primary-rgb), 0.12), transparent 70%)',
        }}
      />
      <div>
        <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--accent-primary)]">
          Portfolio analytics for South African investors
        </p>
        <h1
          id="hero-heading"
          className="text-balance text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[44px] lg:text-[48px]"
        >
          See <span className="text-[var(--accent-primary)]">why</span> your portfolio moved, not
          just that it did.
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--text-secondary)] sm:text-[17px]">
          Upload your EasyEquities statement and EquityLens flags the unusual days, splits each move
          into a market part and a company part, and lines up the news published around it.
        </p>
        <div className="mt-8">
          <StartButtons {...cta} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <p className="mr-1 font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Inside
          </p>
          {PAGES.map((page) => (
            <button key={page.id} type="button" className={CHIP} onClick={() => showCard(page.id)}>
              {page.chip}
            </button>
          ))}
        </div>
      </div>

      <LensDemo />
    </section>
  );
};

export default Hero;