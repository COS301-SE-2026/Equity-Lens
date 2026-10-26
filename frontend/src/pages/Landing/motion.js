export const MICRO = 0.15;
export const SECTION = 0.3;
export const COMPLEX = 0.5;

/** @type {[number, number, number, number]} */
export const EASE = [0.16, 1, 0.3, 1];

/**
 * @param {boolean | null} reduce
 * @param {number} [delay]
 */
export const reveal = (reduce, delay = 0) =>
  reduce
    ? { initial: false }
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: SECTION, ease: EASE, delay },
      };
