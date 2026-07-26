import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import SecondaryButton from '../shared/SecondaryButton';
import { SCROLL_LIST_CLASS, SCROLL_LIST_STYLE } from '../shared/scrollList';

/** @type {Record<string, { color: string }>} */
const TONE = {
  gain: { color: 'var(--signal-positive)' },
  loss: { color: 'var(--signal-negative)' },
  'best-performer': { color: 'var(--signal-positive)' },
  laggard: { color: 'var(--signal-warning)' },
  'missing-sector': { color: 'var(--accent-primary)' },
};
const DEFAULT = { color: 'var(--accent-primary)' };

/**
 * @param {{
 *   insights: { type?: string, text: string, why: string, action: { label: string, to?: string, target?: string } | null }[],
 *   onScrollTo?: (target: string) => void,
 * }} props
 */
const TodayInsights = ({ insights, onScrollTo }) => {
  const [expanded, setExpanded] = useState(() => new Set());

  if (insights.length === 0) return null;

  /** @param {string} key */
  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <GlassPanel>
      <PanelHead label="TODAY'S INSIGHTS" />
      <div className={`${SCROLL_LIST_CLASS} space-y-3 p-4`} style={SCROLL_LIST_STYLE}>
        {insights.map((insight) => {
          const { color } = (insight.type ? TONE[insight.type] : undefined) ?? DEFAULT;
          const isOpen = expanded.has(insight.text);
          return (
            <div
              key={insight.text}
              className="rounded-lg p-3"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    {insight.text}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <SecondaryButton
                      size="sm"
                      onClick={() => toggle(insight.text)}
                      expanded={isOpen}
                      trailing={
                        <ChevronDown
                          size={10}
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                        />
                      }
                    >
                      Why?
                    </SecondaryButton>

                    {insight.action && (insight.action.to || (insight.action.target && onScrollTo)) && (
                      <SecondaryButton
                        size="sm"
                        to={insight.action.to}
                         onClick={() => {if (insight.action?.target) onScrollTo?.(insight.action.target);}}
                      >
                        {insight.action.label}
                      </SecondaryButton>
                    )}
                  </div>

                  {isOpen && (
                    <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
                      {insight.why}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
};

export default TodayInsights;
