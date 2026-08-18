import { useEffect, useRef } from 'react';

const LERP = 0.045;
const SIZE = 520;

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
    el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    /** @param {MouseEvent} e */
    const handleMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;};
    window.addEventListener('mousemove', handleMove);

    let frame = requestAnimationFrame(function tick() {
      x += (targetX - x) * LERP;
      y += (targetY - y) * LERP;
      el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
      frame = requestAnimationFrame(tick);});

    return () => {
      window.removeEventListener('mousemove', handleMove);
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