import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import GroupBuilder from './GroupBuilder';
import { bookTotal, shareOfBook } from '../../../utils/portfolioStats';

export const MAX_HOLDINGS = 5;
export const MAX_GROUPS = 4;
export const MAX_SERIES_TICKERS = 15;
export const HOLDING_COLOURS = [
  'var(--signal-info)',
  'var(--signal-warning)',
  'var(--signal-positive)',
  'var(--accent-light)',
  'var(--text-dim)',
];

export const GROUP_COLOURS = [
  'var(--signal-positive)',
  'var(--signal-info)',
  'var(--accent-light)',
  'var(--signal-warning)',
];

export const GROUP_DASH = '9 4';

/** @param {string[]} selected @param {string} ticker */
export const colourFor = (selected, ticker) =>
  HOLDING_COLOURS[selected.indexOf(ticker) % HOLDING_COLOURS.length];

/** @param {{ id: string }[]} groups @param {string} id */
export const groupColourFor = (groups, id) =>
  GROUP_COLOURS[groups.findIndex((g) => g.id === id) % GROUP_COLOURS.length];

const PANES = [
  { key: 'holdings', label: 'Compare individual holdings' },
  { key: 'groups', label: 'Build holding groups' },
];

// far enough that a scroll or a tap does not count as a swipe
const SWIPE_PX = 40;

/**
 * @param {{
 *   holdings: { ticker: string, name?: string, value: number }[],
 *   selected: string[],
 *   onToggle: (ticker: string) => void,
 *   groups?: { id: string, name: string, members: string[] }[],
 *   onGroupsChange?: (groups: { id: string, name: string, members: string[] }[]) => void,
 *   drawnGroups?: { id: string, name: string }[],
 * }} props
 */
const HoldingSelector = ({
  holdings, selected, onToggle, groups = [], onGroupsChange, drawnGroups = [],
}) => {
  const [open, setOpen] = useState(false);
  const [lastRemoved, setLastRemoved] = useState(/** @type {any} */ (null));
  const [pane, setPane] = useState(0);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const wrapperRef = useRef(null);
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const panesRef = useRef(null);

  /** @param {number} delta */
  const step = (delta) => setPane((p) => Math.min(PANES.length - 1, Math.max(0, p + delta)));

  /** @param {React.KeyboardEvent} e */
  const handleArrows = (e) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else return;
    e.preventDefault();
  };

  useEffect(() => {
    const node = panesRef.current;
    if (!node) return undefined;
    let startX = 0;
    /** @param {TouchEvent} e */
    const onStart = (e) => { startX = e.changedTouches[0].clientX; };
    /** @param {TouchEvent} e */
    const onEnd = (e) => {
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > SWIPE_PX) step(delta < 0 ? 1 : -1);
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchend', onEnd);
    };
  }, [open, pane]);

  useEffect(() => {
    if (!open) return undefined;
    /** @param {MouseEvent} e */
    const handleClick = (e) => {
      if (!wrapperRef.current?.contains(/** @type {Node} */ (e.target))) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) setLastRemoved(null);
  }, [open]);

  const total = bookTotal(holdings);
  const options = [...holdings]
    .filter((h) => h.ticker)
    .sort((a, b) => b.value - a.value);
  const atCap = selected.length >= MAX_HOLDINGS;

  /** @param {string} id */
  const removeGroup = (id) => {
    const removed = groups.find((g) => g.id === id);
    if (!removed) return;
    setLastRemoved(removed);
    onGroupsChange?.(groups.filter((g) => g.id !== id));
  };

  const restoreGroup = () => {
    if (!lastRemoved) return;
    onGroupsChange?.([...groups, lastRemoved]);
    setLastRemoved(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="pressable flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-[12px]"
          style={{
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            background: 'var(--surface-hover)',
          }}
        >
          Compare holdings
          <ChevronDown
            size={12}
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              color: 'var(--text-ghost)',
            }}
          />
        </button>

        {open && (
          <div className="glass-surface-elevated absolute left-0 z-50 mt-1 w-72 overflow-hidden rounded-lg">
            <div ref={panesRef} className="max-h-56 overflow-y-auto">
              {pane === 0 ? (
                <ul
                  role="listbox"
                  aria-label="Holdings to compare"
                  aria-multiselectable="true"
                  className="py-1"
                >
                  {options.length === 0 && (
                    <li className="px-3 py-2 font-mono text-[12px]" style={{ color: 'var(--text-ghost)' }}>
                      No holdings to compare
                    </li>
                  )}
                  {options.map((h) => {
                    const isSelected = selected.includes(h.ticker);
                    const blocked = atCap && !isSelected;
                    const weight = shareOfBook(h.value, total)?.toFixed(1) ?? '0.0';

                    return (
                      <li key={h.ticker} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          disabled={blocked}
                          onClick={() => onToggle(h.ticker)}
                          title={blocked ? `Clear one first - up to ${MAX_HOLDINGS} at a time` : undefined}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          <span
                            className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-sm"
                            style={{
                              border: `1px solid ${isSelected ? colourFor(selected, h.ticker) : 'var(--border-mid)'}`,
                              background: isSelected ? colourFor(selected, h.ticker) : 'transparent',
                            }}
                          >
                            {isSelected && <Check size={9} style={{ color: 'var(--text-on-accent)' }} />}
                          </span>
                          <span className="truncate">{h.ticker}</span>
                          <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-ghost)' }}>
                            {weight}%
                          </span>
                        </button>
                      </li>
                    );
                  })}

                  {atCap && (
                    <li
                      className="px-3 pb-1 pt-1.5 font-mono text-[11px] leading-snug"
                      style={{ color: 'var(--text-ghost)', borderTop: '1px solid var(--border-subtle)' }}
                    >
                      {MAX_HOLDINGS} at a time - past that the end labels collide and the chart stops
                      being readable. Clear one to swap, or build a group instead.
                    </li>
                  )}
                </ul>
              ) : (
                <GroupBuilder
                  holdings={holdings}
                  groups={groups}
                  onChange={(next) => onGroupsChange?.(next)}
                  lastRemoved={lastRemoved}
                  onRestore={restoreGroup}
                />
              )}
            </div>

            <div
              role="tablist"
              aria-label="Comparison mode"
              className="flex items-center justify-center gap-2 py-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {PANES.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  onClick={() => setPane(i)}
                  onKeyDown={handleArrows}
                  aria-label={p.label}
                  aria-selected={pane === i}
                  className="pressable h-2.5 w-2.5 rounded-full"
                  style={{
                    background: pane === i ? 'var(--text-secondary)' : 'var(--border-mid)',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.map((ticker) => (
        <button
          key={ticker}
          type="button"
          onClick={() => onToggle(ticker)}
          aria-label={`Remove ${ticker}`}
          className="pressable flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]"
          style={{
            border: `1px solid ${colourFor(selected, ticker)}`,
            color: colourFor(selected, ticker),
          }}
        >
          <span className="h-0 w-4 border-t-2" style={{ borderColor: colourFor(selected, ticker) }} />
          {ticker}
          <X size={10} />
        </button>
      ))}

      {drawnGroups.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => removeGroup(group.id)}
          aria-label={`Remove ${group.name}`}
          className="pressable flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px]"
          style={{
            border: `1px solid ${groupColourFor(drawnGroups, group.id)}`,
            color: groupColourFor(drawnGroups, group.id),
          }}
        >
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: groupColourFor(drawnGroups, group.id) }} />
          {group.name}
          <X size={10} />
        </button>
      ))}
    </div>
  );
};

export default HoldingSelector;
