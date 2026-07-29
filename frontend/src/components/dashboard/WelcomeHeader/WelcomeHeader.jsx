import { motion, useReducedMotion } from 'framer-motion';

/** @param {number} hour */
function greetingForHour(hour) {
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

/**
 * @param {{ name: string }} props
 */
const WelcomeHeader = ({ name }) => {
  const reduceMotion = useReducedMotion();
  const greeting = greetingForHour(new Date().getHours());

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          <span className="font-light" style={{ color: 'var(--text-secondary)' }}>
            {greeting}{' '}
          </span>
          <span style={{ color: 'var(--accent-primary)' }}>{name}</span>
        </h1>
        <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          Snapshot as of {new Date().toLocaleDateString('en-ZA')}
        </p>
      </div>
    </motion.div>
  );
};

export default WelcomeHeader;
