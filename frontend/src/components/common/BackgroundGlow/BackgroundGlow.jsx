import { useEffect, useRef } from 'react';

const SIZE = 520;
const MIN_LERP = 0.004;
const MAX_LERP = 0.012;
const MIN_WAIT_MS = 4000;
const MAX_WAIT_MS = 9000;

/** @param {number} min @param {number} max */
const randomBetween = (min, max) => min + Math.random() * (max - min);

const BackgroundGlow = () => {
  /** @type {import('react').RefObject<HTMLDivElement>} */
  const glowRef = useRef(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let targetX = x;
    let targetY = y;
    let lerp = randomBetween(MIN_LERP, MAX_LERP);
    el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    /** @type {ReturnType<typeof setTimeout>} */
    let wanderTimeout;
    const pickNewTarget = () => {
      targetX = randomBetween(0, window.innerWidth);
      targetY = randomBetween(0, window.innerHeight);
      lerp = randomBetween(MIN_LERP, MAX_LERP);
      wanderTimeout = setTimeout(pickNewTarget, randomBetween(MIN_WAIT_MS, MAX_WAIT_MS));};
    wanderTimeout = setTimeout(pickNewTarget, randomBetween(MIN_WAIT_MS, MAX_WAIT_MS));

    let frame = requestAnimationFrame(function tick() {
      x += (targetX - x) * lerp;
      y += (targetY - y) * lerp;
      el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
      frame = requestAnimationFrame(tick);});

    return () => {
      clearTimeout(wanderTimeout);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      className="magnifying-glass-bg"
      style={{ width: `${SIZE}px`, height: `${SIZE}px` }}>
      <svg viewBox="0 0 520 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line
          x1="345" y1="345" x2="475" y2="475"
          stroke="var(--accent-primary)" strokeWidth="28" strokeLinecap="round"/>
        <circle cx="215" cy="215" r="165" fill="rgba(var(--accent-primary-rgb), 0.12)" />
        <circle cx="215" cy="215" r="165" stroke="var(--accent-primary)" strokeWidth="20" />
        <path
          d="M120 145 A130 130 0 0 1 245 82"
          stroke="rgba(255,255,255,0.4)" strokeWidth="10" strokeLinecap="round"/>
      </svg>
    </div>);};

export default BackgroundGlow;