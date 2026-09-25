import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import AnimatedReveal from '../shared/AnimatedReveal';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import { SCROLL_LIST_FLEX_CLASS, SCROLL_LIST_STYLE, useScrollEndFade } from '../shared/scrollList';
import SecondaryButton from '../shared/SecondaryButton';

/** @type {Record<string, { color: string }>} */
const TONE = {
  gain: { color: 'var(--signal-positive)' },
  loss: { color: 'var(--signal-negative)' },
  driver: { color: 'var(--accent-primary)' },
  opportunity: { color: 'var(--signal-positive)' },
  risk: { color: 'var(--signal-negative)' },
  neutral: { color: 'var(--accent-primary)' },
  info: { color: 'var(--text-ghost)' },
};
const DEFAULT = { color: 'var(--accent-primary)' };
/** @type {Record<string, string>} */
const TONE_RGB = {
  gain: 'var(--signal-positive-rgb)',
  loss: 'var(--signal-negative-rgb)',
  driver: 'var(--accent-primary-rgb)',
  opportunity: 'var(--signal-positive-rgb)',
  risk: 'var(--signal-negative-rgb)',
  neutral: 'var(--accent-primary-rgb)',
  info: 'var(--accent-primary-rgb)',
};
const DEFAULT_RGB = 'var(--accent-primary-rgb)';

/** @param {string} category */
const chipLabel = (category) => category.replace(/_/g, ' ').toUpperCase();
const MAX_ACTIONS = 3;

/**
 * @param {{
 *   insight: any,
 *   isOpen: boolean,
 *   onToggle: () => void,
 *   onScrollTo?: (target: string) => void,
 *   onAsk?: (question: string) => void,
 * }} props
 */
const InsightCard = ({ insight, isOpen, onToggle, onScrollTo, onAsk }) => {
  const key = insight.severity ?? insight.type;
  const { color } = TONE[key] ?? DEFAULT;
  const colorRgb = TONE_RGB[key] ?? DEFAULT_RGB;
  const evidence = insight.evidence ?? [];
  // buildInsights hands over a list; a record built by hand may still carry the single action
  const actions = (insight.actions ?? (insight.action ? [insight.action] : [])).slice(0, MAX_ACTIONS);
  const questions = actions.filter((/** @type {any} */ action) => action.question && !action.target);

  return (
    <div
      className="glass-surface rounded-lg p-2.5"
      style={{
        background: `rgba(${colorRgb}, 0.14)`,
        border: `1px solid rgba(${colorRgb}, 0.3)`,
      }}
    >
      {insight.category && (
        <div className="mb-1 font-mono text-[11px] tracking-widest" style={{ color }}>
          {chipLabel(insight.category)}
        </div>
      )}

      <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {insight.text}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <SecondaryButton
          size="sm"
          onClick={onToggle}
          expanded={isOpen}
          className="!px-1.5 !py-0.5 !text-[11px]"
          trailing={
            <ChevronDown
              size={9}
              style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
            />
          }
        >
          Why?
        </SecondaryButton>

        {actions.map((/** @type {any} */ action) => {
          if (action.target) {
            return (
              <SecondaryButton key={action.label} size="sm" className="!px-1.5 !py-0.5 !text-[11px]" onClick={() => onScrollTo?.(action.target)}>
                {action.label}
              </SecondaryButton>
            );
          }
          if (action.question) return null;
          return (
            <SecondaryButton key={action.label} size="sm" to={action.to} className="!px-1.5 !py-0.5 !text-[11px]">
              {action.label}
            </SecondaryButton>
          );
        })}
      </div>

      <AnimatedReveal show={isOpen}>
        {questions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {questions.map((/** @type {any} */ action) => (
              <SecondaryButton key={action.label} size="sm" className="!px-1.5 !py-0.5 !text-[11px]" onClick={() => onAsk?.(action.question)}>
                {action.label}
              </SecondaryButton>
            ))}
          </div>
        )}
        {evidence.length > 0 && (
          <dl className="mt-1.5 space-y-0.5">
            {evidence.map((/** @type {any} */ row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                  {row.label}
                </dt>
                <dd className="font-mono text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
          {insight.why}
        </p>
      </AnimatedReveal>
    </div>
  );
};

/**
 * @param {{
 *   insights: { id?: string, category?: string, severity?: string, type?: string, text: string, why: string, evidence?: { label: string, value: string }[], action?: { label: string, to?: string, target?: string } | null, actions?: { label: string, to?: string, target?: string, question?: string }[] }[],
 *   more?: any[],
 *   onScrollTo?: (target: string) => void,
 *   onAsk?: (question: string) => void,
 * }} props
 */
const TodayInsights = ({ insights, more = [], onScrollTo, onAsk }) => {
  const [expanded, setExpanded] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const scroller = useScrollEndFade();

  if (insights.length === 0) {
    return (
      <GlassPanel className="flex h-[440px] flex-col">
        <PanelHead label="Portfolio Insights" />
        <div className="flex flex-1 items-center justify-center p-5 text-center text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          Nothing notable moved today.
        </div>
      </GlassPanel>
    );
  }

  /** @param {string} key */
  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visible = showAll ? [...insights, ...more] : insights;

  return (
    <GlassPanel className="flex h-[440px] flex-col">
      <PanelHead label="Portfolio Insights" />
      <div
        ref={/** @type {React.RefObject<HTMLDivElement>} */ (scroller.ref)}
        onScroll={scroller.onScroll}
        className={`${SCROLL_LIST_FLEX_CLASS} space-y-2 p-3`}
        style={SCROLL_LIST_STYLE}>
        {visible.map((insight) => (
          <InsightCard
            key={insight.text}
            insight={insight}
            isOpen={expanded.has(insight.text)}
            onToggle={() => toggle(insight.text)}
            onScrollTo={onScrollTo}
            onAsk={onAsk}
          />
        ))}

        {more.length > 0 && !showAll && (
          <SecondaryButton size="sm" className="!text-[11px]" onClick={() => setShowAll(true)}>
            Show {more.length} more
          </SecondaryButton>
        )}
      </div>
    </GlassPanel>
  );
};

export default TodayInsights;
