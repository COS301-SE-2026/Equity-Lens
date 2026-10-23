import { motion, useReducedMotion } from 'framer-motion';
import { Gauge, ScanSearch, Upload } from 'lucide-react';

import { STEPS } from '../landingData';
import { reveal } from '../motion';

const ICONS = { upload: Upload, understand: Gauge, explain: ScanSearch };

const HowItWorks = () => {
  const reduce = useReducedMotion();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto max-w-7xl scroll-mt-16 px-6 pb-10 pt-20 sm:px-8 lg:pb-10 lg:pt-32"
    >
      <motion.div {...reveal(reduce)}>
        <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--accent-primary)]">
          How it works
        </p>
        <h2
          id="how-heading"
          className="mt-4 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-primary)]"
        >
          From statement to explanation in three steps.
        </h2>
      </motion.div>

      <ol className="mt-12 grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = ICONS[/** @type {keyof typeof ICONS} */ (step.id)];
          return (
            <motion.li key={step.id} {...reveal(reduce, i * 0.1)} className="flex gap-4">
              <Icon
                size={24}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-[var(--accent-primary)]"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-[20px] font-semibold text-[var(--text-primary)] lg:text-[22px]">
                  <span className="mr-2 font-mono tabular-nums text-[var(--text-dim)]">
                    {i + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[60ch] text-[16px] leading-relaxed text-[var(--text-secondary)]">
                  {step.body}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
};

export default HowItWorks;