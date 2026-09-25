import { useEffect, useRef } from 'react';

export const SCROLL_LIST_FLEX_CLASS = 'scroll-list min-h-0 flex-1 overflow-y-auto';

/** @type {React.CSSProperties} */
export const SCROLL_LIST_STYLE = { scrollbarWidth: 'thin', scrollBehavior: 'smooth' };

const AT_END_CLASS = 'is-at-end';
const END_TOLERANCE_PX = 1;

/** @param {HTMLElement | null} el */
const markAtEnd = (el) => {
  if (!el) return;
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - END_TOLERANCE_PX;
  el.classList.toggle(AT_END_CLASS, atEnd);
};

export const useScrollEndFade = () => {
  const ref = useRef(/** @type {HTMLElement | null} */ (null));
  useEffect(() => {
    markAtEnd(ref.current);
  });

  return { ref, onScroll: () => markAtEnd(ref.current) };
};
