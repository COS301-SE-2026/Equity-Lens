import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { RING_PATH } from '../../../components/common/BrandMark/BrandMark';
import { DEMO_COMPANY, DEMO_EVENTS, DEMO_MONTHS, DEMO_PRICES } from '../landingData';
import { COMPLEX, EASE, MICRO, SECTION } from '../motion';

const W = 640;
const H = 280;
const PAD = { left: 12, right: 12, top: 34, bottom: 30 };
const LOW = Math.min(...DEMO_PRICES) - 0.4;
const HIGH = Math.max(...DEMO_PRICES) + 0.4;
const LAST = DEMO_PRICES.length - 1;

/** @param {number} day */
const xAt = (day) => PAD.left + (day / LAST) * (W - PAD.left - PAD.right);
/** @param {number} price */
const yAt = (price) => PAD.top + ((HIGH - price) / (HIGH - LOW)) * (H - PAD.top - PAD.bottom);

/** @param {number} day */
const pointAt = (day) => {
  const i = Math.min(Math.floor(day), LAST - 1);
  const price = DEMO_PRICES[i] + (DEMO_PRICES[i + 1] - DEMO_PRICES[i]) * (day - i);
  return { x: xAt(day), y: yAt(price), price };
};

const LINE = DEMO_PRICES.map(
  (p, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(p).toFixed(1)}`,
).join(' ');
const AREA = `${LINE} L${xAt(LAST)} ${H - PAD.bottom} L${xAt(0)} ${H - PAD.bottom} Z`;

const LENS_R = 28;
const RING_CENTRE = 318;
const RING_SCALE = LENS_R / 187;
const ZOOM = 2.2;
const START_DAY = 3;
const FIRST = DEMO_EVENTS[0];

/** @param {number} value */
const pct = (value) => `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`;

const SUMMARY =
  `Illustrative chart of ${DEMO_COMPANY.name}, a fictional share, over ${DEMO_PRICES.length} ` +
  `trading days. Two unusual days are flagged. ${DEMO_EVENTS.map(
    (e) =>
      `On ${e.date} it moved ${pct(e.movePct)}: ${pct(e.marketPct)} in line with the market and ` +
      `${pct(e.companyPct)} specific to the company. ${e.timing}: ${e.headline}.`,
  ).join(' ')}`;

/** @param {{ event: import('../landingData').DemoEvent, reduce: boolean | null }} props */
const EventCard = ({ event, reduce }) => {
  const total = Math.abs(event.marketPct) + Math.abs(event.companyPct);
  const grow = (/** @type {number} */ delay) =>
    reduce
      ? { initial: false }
      : {
          initial: { scaleX: 0 },
          animate: { scaleX: 1 },
          transition: { duration: SECTION, ease: EASE, delay },
        };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SECTION, ease: EASE }}
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">{DEMO_COMPANY.ticker}</span>
            {' · '}
            {event.date}
            {' · unusual day'}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">
            About {event.sigma.toFixed(1)}× its typical daily move
          </p>
        </div>
        <p
          className={`font-mono text-[22px] font-semibold leading-none ${
            event.movePct < 0 ? 'text-[var(--signal-negative)]' : 'text-[var(--signal-positive)]'
          }`}
        >
          {pct(event.movePct)}
        </p>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        <motion.span
          className="h-full bg-[var(--text-secondary)]"
          style={{ width: `${(Math.abs(event.marketPct) / total) * 100}%`, originX: 0 }}
          {...grow(0.1)}
        />
        <motion.span
          className="h-full flex-1 bg-[var(--accent-primary)]"
          style={{ originX: 0 }}
          {...grow(0.2)}
        />
      </div>
      <dl className="mt-2 flex justify-between gap-3 text-[12px]">
        <div>
          <dt className="text-[var(--text-dim)]">Market part</dt>
          <dd className="font-mono text-[14px] text-[var(--text-primary)]">
            {pct(event.marketPct)}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-[var(--text-dim)]">Company-specific part</dt>
          <dd className="font-mono text-[14px] text-[var(--accent-primary)]">
            {pct(event.companyPct)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{event.headline}</p>
        <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{event.timing}</p>
      </div>
      <p className="mt-2 text-[12px] text-[var(--text-dim)]">
        News is ranked by relevance and timing. It is context, not proof.
      </p>
    </motion.div>
  );
};

const LensDemo = () => {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(reduce ? FIRST.id : null);
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches);
  const lensRef = useRef(/** @type {SVGGElement | null} */ (null));
  const zoomRef = useRef(/** @type {SVGGElement | null} */ (null));
  const readoutRef = useRef(/** @type {SVGTextElement | null} */ (null));
  const dayRef = useRef(reduce ? FIRST.day : START_DAY);
  const busyRef = useRef(!reduce);

  /** @param {number} day */
  const place = (day) => {
    const { x, y, price } = pointAt(day);
    dayRef.current = day;
    lensRef.current?.setAttribute('transform', `translate(${x} ${y})`);
    zoomRef.current?.setAttribute('transform', `scale(${ZOOM}) translate(${-x} ${-y})`);
    if (readoutRef.current) readoutRef.current.textContent = `R ${price.toFixed(2)}`;
  };

  /**
   * @param {number} to
   * @param {number} [delay]
   */
  const glide = (to, delay = 0) =>
    animate(dayRef.current, to, { duration: COMPLEX, ease: EASE, delay, onUpdate: place });

  useEffect(() => {
    if (reduce) return undefined;
    let stopped = false;
    /** @type {ReturnType<typeof animate> | null} */
    let current = null;
    const run = async () => {
      current = glide(18, COMPLEX);
      await current;
      if (stopped) return;
      current = glide(FIRST.day);
      await current;
      if (stopped) return;
      busyRef.current = false;
      setActive(FIRST.id);
    };
    run();
    return () => {
      stopped = true;
      current?.stop();
    };
  }, [reduce]);

  /** @param {import('../landingData').DemoEvent} event */
  const show = async (event) => {
    setActive(event.id);
    if (reduce) {
      place(event.day);
      return;
    }
    busyRef.current = true;
    await glide(event.day);
    busyRef.current = false;
  };

  /** @param {import('react').PointerEvent<HTMLDivElement>} e */
  const inspect = (e) => {
    if (!finePointer || busyRef.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const day = ((x - PAD.left) / (W - PAD.left - PAD.right)) * LAST;
    place(Math.max(0, Math.min(LAST, day)));
  };

  const returnLens = () => {
    const event = DEMO_EVENTS.find((item) => item.id === active);
    if (!finePointer || busyRef.current || !event) return;
    glide(event.day);
  };

  const event = DEMO_EVENTS.find((item) => item.id === active) ?? null;
  const start = pointAt(dayRef.current);

  return (
    <figure className="m-0 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-elevated)] sm:p-5">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
          {DEMO_COMPANY.name} ({DEMO_COMPANY.ticker})
        </span>
        <span className="rounded-full border border-[var(--border-mid)] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
          Illustrative example
        </span>
      </figcaption>
      <p className="sr-only">{SUMMARY}</p>

      <div
        className={`relative mt-2 aspect-[640/280] w-full ${finePointer ? 'cursor-crosshair' : ''}`}
        onPointerMove={inspect}
        onPointerLeave={returnLens}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <clipPath id="lens-glass">
              <circle r={LENS_R - 1} />
            </clipPath>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => {
            const y = PAD.top + f * (H - PAD.top - PAD.bottom);
            return (
              <line
                key={f}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--border-subtle)"
              />
            );
          })}
          <path d={AREA} style={{ fill: 'var(--accent-primary)' }} fillOpacity={0.08} />
          <path
            d={LINE}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          <motion.g
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: MICRO, delay: COMPLEX }}
          >
            <g ref={lensRef} transform={`translate(${start.x} ${start.y})`}>
              <g clipPath="url(#lens-glass)">
                <circle r={LENS_R} fill="var(--surface-elevated)" />
                <g ref={zoomRef} transform={`scale(${ZOOM}) translate(${-start.x} ${-start.y})`}>
                  <path d={LINE} fill="none" stroke="var(--accent-primary)" strokeWidth="1.2" />
                </g>
              </g>
              <path
                d={RING_PATH}
                fill="#FF5500"
                transform={`scale(${RING_SCALE}) translate(${-RING_CENTRE} ${-RING_CENTRE})`}
              />
              <text
                ref={readoutRef}
                display={finePointer ? undefined : 'none'}
                y={-LENS_R - 10}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize="13"
                fontFamily="var(--font-mono)"
              >
                R {start.price.toFixed(2)}
              </text>
            </g>
          </motion.g>
        </svg>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 text-[12px] text-[var(--text-dim)]"
        >
          {DEMO_MONTHS.map((m) => (
            <span
              key={m.label}
              className="absolute bottom-0"
              style={{ left: `${(xAt(m.day) / W) * 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {!reduce && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[var(--surface-card)]"
            style={{ originX: 1 }}
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: COMPLEX, ease: EASE }}
          />
        )}

        {DEMO_EVENTS.map((item) => {
          const p = pointAt(item.day);
          const on = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
              onClick={() => show(item)}
              aria-expanded={on}
              aria-controls="lens-event"
              aria-label={`Unusual day, ${item.date}: ${item.movePct < 0 ? 'down' : 'up'} ${Math.abs(
                item.movePct,
              )}%. Show details`}
            >
              {!reduce && (
                <motion.span
                  aria-hidden="true"
                  className="absolute h-4 w-4 rounded-full border-2 border-[var(--signal-warning)]"
                  initial={{ opacity: 0 }}
                  animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 1.8 }}
                />
              )}
              <motion.span
                aria-hidden="true"
                className={`relative h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-card)] ${
                  on ? 'bg-[var(--text-primary)]' : 'bg-[var(--signal-warning)]'
                }`}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: SECTION, ease: EASE, delay: COMPLEX }}
              />
            </button>
          );
        })}
      </div>

      <div id="lens-event" className="mt-3">
        {event ? (
          <EventCard key={event.id} event={event} reduce={reduce} />
        ) : (
          <div className="invisible" aria-hidden="true">
            <EventCard event={FIRST} reduce />
          </div>
        )}
      </div>
    </figure>
  );
};

export default LensDemo;
