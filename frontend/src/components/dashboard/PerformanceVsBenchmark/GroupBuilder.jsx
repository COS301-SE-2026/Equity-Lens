import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';

import AnimatedReveal from '../shared/AnimatedReveal';

import { GROUP_COLOURS, MAX_GROUPS, groupColourFor } from './HoldingSelector';
import { bookTotal, shareOfBook } from '../../../utils/portfolioStats';

const STORAGE_KEY = 'performance_holding_groups';

/** @typedef {{ id: string, name: string, members: string[] }} StoredGroup */

/** @returns {StoredGroup[]} */
export function loadGroups() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g) => g && typeof g.id === 'string' && Array.isArray(g.members))
      .slice(0, MAX_GROUPS)
      .map((g) => ({
        id: g.id,
        name: typeof g.name === 'string' ? g.name : 'Group',
        members: g.members.filter((/** @type {any} */ t) => typeof t === 'string'),
      }));
  } catch {
    return [];
  }
}

/** @param {StoredGroup[]} groups */
export function saveGroups(groups) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    //
  }
}

/**
 * @param {StoredGroup[]} groups
 * @param {{ ticker: string, name?: string, value: number, current_price?: number }[]} holdings
 */
export function resolveGroups(groups, holdings) {
  const byTicker = new Map(holdings.filter((h) => h.ticker).map((h) => [h.ticker, h]));
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    members: group.members
      .filter((ticker) => byTicker.has(ticker))
      .map((ticker) => ({
        ticker,
        value: byTicker.get(ticker)?.value ?? 0,
        currentPrice: byTicker.get(ticker)?.current_price ?? 0,
      })),
  }));
}

/**
 * @param {{
 *   holdings: { ticker: string, name?: string, value: number }[],
 *   groups: StoredGroup[],
 *   onChange: (groups: StoredGroup[]) => void,
 *   lastRemoved?: StoredGroup | null,
 *   onRestore?: () => void,
 * }} props
 */
const GroupBuilder = ({ holdings, groups, onChange, lastRemoved = null, onRestore }) => {
  const [openId, setOpenId] = useState(/** @type {string|null} */ (null));

  const total = bookTotal(holdings);
  const options = [...holdings].filter((h) => h.ticker).sort((a, b) => b.value - a.value);
  const atCap = groups.length >= MAX_GROUPS;

  const addGroup = () => {
    if (atCap) return;
    const id = `g${Date.now().toString(36)}`;
    onChange([...groups, { id, name: `Group ${groups.length + 1}`, members: [] }]);
    setOpenId(id);
  };

  /** @param {string} id @param {Partial<StoredGroup>} patch */
  const update = (id, patch) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  /** @param {string} id @param {string} ticker */
  const toggleMember = (id, ticker) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    update(id, {
      members: group.members.includes(ticker)
        ? group.members.filter((t) => t !== ticker)
        : [...group.members, ticker],
    });
  };

  /** @param {StoredGroup} group */
  const groupShare = (group) => {
    const value = group.members.reduce(
      (sum, ticker) => sum + (holdings.find((h) => h.ticker === ticker)?.value ?? 0), 0,
    );
    return shareOfBook(value, total)?.toFixed(1) ?? '0.0';
  };

  return (
    <div className="py-1">
      {groups.length === 0 && (
        <p className="px-3 py-2 text-[12px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          Put several holdings on one line - your banks, your offshore ETFs - and compare the
          group against the portfolio.
        </p>
      )}

      {groups.map((group) => {
        const isOpen = openId === group.id;
        const colour = groupColourFor(groups, group.id);

        return (
          <div key={group.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: colour }}
              />
              <input
                value={group.name}
                onChange={(e) => update(group.id, { name: e.target.value })}
                aria-label={`Name for ${group.name}`}
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : group.id)}
                aria-expanded={isOpen}
                className="pressable flex-shrink-0 font-mono text-[11px]"
                style={{ color: 'var(--text-ghost)' }}
              >
                {group.members.length} · {groupShare(group)}%
              </button>
              <button
                type="button"
                onClick={() => onChange(groups.filter((g) => g.id !== group.id))}
                aria-label={`Remove ${group.name}`}
                className="pressable flex-shrink-0"
                style={{ color: 'var(--text-ghost)' }}
              >
                <X size={11} />
              </button>
            </div>

            {isOpen && (
              <ul className="max-h-40 overflow-y-auto pb-1">
                {options.map((h) => {
                  const inGroup = group.members.includes(h.ticker);
                  return (
                    <li key={h.ticker}>
                      <button
                        type="button"
                        onClick={() => toggleMember(group.id, h.ticker)}
                        aria-pressed={inGroup}
                        className="flex w-full items-center gap-2 py-1 pl-7 pr-3 text-left font-mono text-[12px]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span
                          className="flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-sm"
                          style={{
                            border: `1px solid ${inGroup ? colour : 'var(--border-mid)'}`,
                            background: inGroup ? colour : 'transparent',
                          }}>
                          {inGroup && <Check size={9} style={{ color: 'var(--text-on-accent)' }} />}
                        </span>
                        <span className="truncate">{h.ticker}</span>
                      </button>
                    </li>
                  );})}
              </ul>
            )}
          </div>);})}

      <div className="px-3 pb-1 pt-1.5">
        <button
          type="button"
          onClick={addGroup}
          disabled={atCap}
          className="pressable flex items-center gap-1.5 font-mono text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: 'var(--text-primary)' }}
        >
          <Plus size={11} />
          New group
        </button>

        <AnimatedReveal show={Boolean(lastRemoved)}>
          <button
            type="button"
            onClick={() => onRestore?.()}
            className="pressable mt-1 rounded-md px-2 py-1 font-mono text-[11px]"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Restore {lastRemoved?.name}
          </button>
        </AnimatedReveal>

        <AnimatedReveal show={atCap}>
          <p className="mt-1 font-mono text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
            {MAX_GROUPS} groups is the cap - {GROUP_COLOURS.length} distinguishable lines is
            already a busy chart. Remove one to add another.
          </p>
        </AnimatedReveal>

        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          A holding can sit in more than one group.
        </p>
      </div>
    </div>
  );
};

export default GroupBuilder;
