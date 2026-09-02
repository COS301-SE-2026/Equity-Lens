import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import AnimatedReveal from '../shared/AnimatedReveal';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import SecondaryButton from '../shared/SecondaryButton';
import { SCROLL_LIST_FLEX_CLASS, SCROLL_LIST_STYLE } from '../shared/scrollList';

/** @type {Record<string, { color: string }>} */
const TONE = {
  gain: { color: 'var(--signal-positive)' },
  loss: { color: 'var(--signal-negative)' },
  driver: { color: 'var(--accent-primary)' },
  opportunity: { color: 'var(--signal-positive)' },
};
const DEFAULT = { color: 'var(--accent-primary)' };
/** @type {Record<string, string>} */
const TONE_RGB = {
  gain: 'var(--signal-positive-rgb)',
  loss: 'var(--signal-negative-rgb)',
  driver: 'var(--accent-primary-rgb)',
  opportunity: 'var(--signal-positive-rgb)',
};
const DEFAULT_RGB = 'var(--accent-primary-rgb)';

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
    <GlassPanel className="flex h-[420px] flex-col">
      <PanelHead label="Today's Insights" />
      <div className={`${SCROLL_LIST_FLEX_CLASS} space-y-2 p-3`} style={SCROLL_LIST_STYLE}>
        {insights.map((insight) => {
          const { color } = (insight.type ? TONE[insight.type] : undefined) ?? DEFAULT;
          const colorRgb = (insight.type ? TONE_RGB[insight.type] : undefined) ?? DEFAULT_RGB;
          const isOpen = expanded.has(insight.text);
          return (
            <div
              key={insight.text}
              className="glass-surface rounded-lg p-2.5"
              style={{
                background: `rgba(${colorRgb}, 0.14)`,
                border: `1px solid rgba(${colorRgb}, 0.3)`,
              }}
            >
              <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {insight.text}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                <SecondaryButton
                  size="sm"
                  onClick={() => toggle(insight.text)}
                  expanded={isOpen}
                  className="!px-1.5 !py-0.5 !text-[9px]"
                  trailing={
                    <ChevronDown
                      size={9}
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
                    className="!px-1.5 !py-0.5 !text-[9px]"
                    onClick={() => {if (insight.action?.target) onScrollTo?.(insight.action.target);}}
                  >
                    {insight.action.label}
                  </SecondaryButton>
                )}
              </div>

              <AnimatedReveal show={isOpen}>
                <p className="mt-1 text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
                  {insight.why}
                </p>
              </AnimatedReveal>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
};

export default TodayInsights;
