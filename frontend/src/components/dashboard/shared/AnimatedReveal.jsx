import { AnimatePresence, motion } from 'framer-motion';

/**
 * @param {{ show: boolean, children: React.ReactNode, className?: string }} props
 */
const AnimatedReveal = ({ show, children, className = '' }) => (
  <AnimatePresence initial={false}>
    {show && (
      <motion.div
        initial={{ opacity: 0, height: 0, y: -6 }}
        animate={{ opacity: 1, height: 'auto', y: 0 }}
        exit={{ opacity: 0, height: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{ overflow: 'hidden' }}
        className={className}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export default AnimatedReveal;
