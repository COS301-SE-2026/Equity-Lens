import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';

import { RING_PATH } from '../../../components/common/BrandMark/BrandMark';
import { PAGES, fullImage } from '../landingData';
import { reveal } from '../motion';

import PageDrawing from './PageDrawing';
import PageViewer from './PageViewer';

const preloaded = new Set();

/** @param {{ id: string, shot: boolean }} page */
const preload = (page) => {
  if (!page.shot || preloaded.has(page.id)) return;
  preloaded.add(page.id);
  const img = new Image();
  const { src, srcSet, sizes } = fullImage(page.id);
  img.sizes = sizes;
  img.srcset = srcSet;
  img.src = src;
};

/**
 * @param {{ cta: import('react').ComponentProps<typeof PageViewer>['cta'] }} props
 */
const PlatformGallery = ({ cta }) => {
  const reduce = useReducedMotion();
  const listRef = useRef(/** @type {HTMLUListElement | null} */ (null));
  const near = useInView(listRef, { once: true, margin: '0px 0px 200px 0px' });
  const [open, setOpen] = useState(/** @type {number | null} */ (null));
  const [slide, setSlide] = useState(1);
  const openerRef = useRef('');

  /** @param {number} index */
  const show = (index) => {
    openerRef.current = PAGES[index].id;
    setOpen(index);
  };

  const close = () => {
    setOpen(null);
    document.getElementById(`page-${openerRef.current}`)?.focus();
  };

  /** @param {import('react').UIEvent<HTMLUListElement>} e */
  const onScroll = (e) => {
    const list = e.currentTarget;
    const step = list.scrollWidth / PAGES.length;
    setSlide(Math.min(PAGES.length, Math.round(list.scrollLeft / step) + 1));
  };

  return (
    <section
      id="platform"
      data-theme="light"
      aria-labelledby="platform-heading"
      className="scroll-mt-16 bg-[var(--surface-raised)] text-[var(--text-primary)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:py-32">
        <motion.div
          {...reveal(reduce)}
          className="lg:flex lg:items-end lg:justify-between lg:gap-12"
        >
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[var(--accent-primary)]">
              The platform
            </p>
            <h2
              id="platform-heading"
              className="mt-4 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em]"
            >
              Six pages, one portfolio.
            </h2>
          </div>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[var(--text-secondary)] lg:mt-0 lg:max-w-[36ch] lg:pb-2">
            Open any page for a closer look at what it shows you.
          </p>
        </motion.div>

        <ul
          ref={listRef}
          onScroll={onScroll}
          className="-mx-6 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
        >
          {PAGES.map((page, i) => (
            <li
              key={page.id}
              className="group relative w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] md:w-auto"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[var(--text-primary)]">
                <div className="h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-focus-within:scale-[1.04] motion-safe:group-hover:scale-[1.04]">
                  {page.shot ? (
                    <img
                      src={near ? `/showcase/${page.id}-card.webp` : undefined}
                      width={800}
                      height={500}
                      loading="lazy"
                      decoding="async"
                      alt={page.alt}
                      className={`block h-full w-full object-cover ${near ? '' : 'invisible'}`}
                    />
                  ) : (
                    <PageDrawing id={page.id} />
                  )}
                </div>
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-[var(--surface-base)] px-3 py-1.5 text-[13px] font-medium text-[var(--text-primary)] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 707 707" width="14" height="14" focusable="false">
                    <path d={RING_PATH} fill="currentColor" />
                  </svg>
                  Look closer
                </span>
                {!page.shot && (
                  <span className="absolute left-3 top-3 rounded-full bg-[var(--surface-base)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    Drawing
                  </span>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-[20px] font-semibold tracking-[-0.01em] lg:text-[22px]">
                  <button
                    id={`page-${page.id}`}
                    type="button"
                    onClick={() => show(i)}
                    onMouseEnter={() => preload(page)}
                    onFocus={() => preload(page)}
                    aria-describedby={`page-${page.id}-line`}
                    className="scroll-mt-28 text-left outline-none focus-visible:outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--accent-primary)]"
                  >
                    {page.name}
                  </button>
                </h3>
                <p
                  id={`page-${page.id}-line`}
                  className="mt-2 text-[16px] leading-relaxed text-[var(--text-secondary)]"
                >
                  {page.line}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p
          aria-hidden="true"
          className="mt-4 text-center font-mono text-[13px] tabular-nums text-[var(--text-dim)] md:hidden"
        >
          {slide} / {PAGES.length}
        </p>
      </div>

      <AnimatePresence>
        {open !== null && <PageViewer index={open} onIndex={setOpen} onClose={close} cta={cta} />}
      </AnimatePresence>
    </section>
  );
};

export default PlatformGallery;