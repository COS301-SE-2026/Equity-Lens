import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 4;

/**
 * @param {{
 *   id: string,
 *   value: string|number|null,
 *   options: { value: string|number, label: string }[],
 *   onChange: (value: string|number) => void,
 *   placeholder?: string,
 *   disabled?: boolean,
 *   direction?: 'down'|'up',
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
const GlassSelect = ({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  direction = 'down',
  className = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const wrapperRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLButtonElement | null>} */
  const triggerRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLUListElement | null>} */
  const listRef = useRef(null);
  const [anchor, setAnchor] = useState(/** @type {DOMRect | null} */ (null));

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const openList = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);};

  /** @param {number} index */
  const commit = (index) => {
    const option = options[index];
    setOpen(false);
    triggerRef.current?.focus();
    if (option && option.value !== value) onChange(option.value);};

  useLayoutEffect(() => {
    if (!open) return undefined;

    const measure = () => setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  useEffect(() => { if (!open) return undefined;

    /** @param {MouseEvent} e */
    const handleClick = (e) => {
      const target = /** @type {Node} */ (e.target);
      if (!wrapperRef.current?.contains(target) && !listRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  /** @param {React.KeyboardEvent} e */
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return;}

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } 
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } 
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
    } 
    else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } 
    else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } 
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(activeIndex);}};

  const listboxId = `${id}-listbox`;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        className="pressable flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-mono text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          background: 'var(--surface-hover)',}}>
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'var(--text-ghost)',
          }}/></button>

      {open &&
        anchor &&
        createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            data-direction={direction}
            className="glass-surface-elevated fixed z-50 max-h-48 overflow-y-auto rounded-lg py-1"
            style={{
              left: anchor.left,
              width: anchor.width,
              ...(direction === 'up' ? { bottom: window.innerHeight - anchor.top + GAP }
                : { top: anchor.bottom + GAP }),}}>
            {options.map((option, i) => (
              <li
                key={option.value}
                id={`${id}-option-${i}`}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(i);}}
                className="cursor-pointer px-3 py-1.5 font-mono text-[12px]"
                style={{
                  color: 'var(--text-primary)',
                  background:
                    i === activeIndex ? 'var(--surface-hover)'
                      : option.value === value ? 'var(--accent-subtle)'
                        : 'transparent',}}>
                {option.label}
              </li>
            ))}
          </ul>,
          document.body,)}
    </div>
  );};

export default GlassSelect;