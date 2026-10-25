import { motion, useReducedMotion } from 'framer-motion';

import { reveal } from '../motion';

import StartButtons from './StartButtons';

/**
 * @param {{ cta: import('react').ComponentProps<typeof StartButtons> }} props
 */
const FinalCta = ({ cta }) => {
  const reduce = useReducedMotion();
  return (
    <section
      aria-labelledby="final-heading"
      className="bg-[var(--accent-primary)] text-[var(--text-on-accent)]"
    >
      <motion.div
        {...reveal(reduce)}
        className="mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-24"
      >
        <div>
          <h2
            id="final-heading"
            className="max-w-[20ch] text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em]"
          >
            Find out what moved your portfolio.
          </h2>
          <p className="mt-4 max-w-[60ch] text-[17px]">
            Have your EasyEquities statement or our Excel template ready.
          </p>
        </div>
        <div className="shrink-0">
          <StartButtons {...cta} onAccent />
        </div>
      </motion.div>
    </section>
  );
};

export default FinalCta;