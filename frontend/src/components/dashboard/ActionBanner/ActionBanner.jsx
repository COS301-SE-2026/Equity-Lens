import { CheckCircle2, Upload } from 'lucide-react';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import { Link } from 'react-router-dom';

const SEVERITY = {
  risk: { color: 'var(--signal-negative)', bg: 'var(--signal-negative-bg)', label: 'RISK' },
  suggestion: { color: 'var(--accent-primary)', bg: 'var(--accent-subtle)', label: 'SUGGESTION' },
  info: { color: 'var(--text-secondary)', bg: 'var(--surface-hover)', label: 'WORTH ASKING' },
};

/**
 * @param {{
 *   item: {
 *     id: string,
 *     severity: 'risk'|'suggestion'|'info',
 *     impact: 'High'|'Medium'|'Low',
 *     title: string,
 *     detail: string,
 *     benefit: string,
 *     healthImprovement: number|null,
 *     cta: { label: string, to: string, target?: undefined } | { label: string, target: string, to?: undefined },
 *   },
 *   onScrollTo: (target: string) => void,
 * }} props
 */
const ActionCard = ({ item, onScrollTo }) => {
  const { color, bg, label } = SEVERITY[item.severity];
  const { cta } = item;
  return (
    <div
      className="flex w-full flex-col gap-2 rounded-xl p-4"
      style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-widest" style={{ color, background: bg }}>
          {label}
        </div>
        <span className="font-mono text-[9px] font-bold tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          {item.impact.toUpperCase()} IMPACT
          {item.healthImprovement !== null && ` · +${item.healthImprovement.toFixed(1)} Health`}
        </span>
      </div>
      <p className="text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
        {item.title}
      </p>
      <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {item.detail}
      </p>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        {item.benefit}
      </p>
      {cta.to ? (
        <Link to={cta.to}
          className="mt-auto inline-flex w-fit items-center rounded-lg px-3.5 py-2 font-mono text-[11px] font-bold transition-opacity hover:opacity-85"
          style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
        >
          {cta.label}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => { if (cta.target) onScrollTo(cta.target)}}
          className="mt-auto inline-flex w-fit items-center rounded-lg px-3.5 py-2 font-mono text-[11px] font-bold transition-opacity hover:opacity-85"
          style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
};

/**
 * @param {{ items: any[], hasHoldings: boolean, onScrollTo: (target: string) => void }} props
 */
const ActionBanner = ({ items, hasHoldings, onScrollTo }) => (
  <GlassPanel>
    <PanelHead label="ACTION CENTRE" hint={hasHoldings ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined} />
    <div className="p-4">
      {!hasHoldings ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Upload size={22} style={{ color: 'var(--text-ghost)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Import a portfolio to get personalised risk checks and suggestions.
          </p>
          <Link
            to="/portfolio"
            className="mt-1 rounded-md px-4 py-2 font-mono text-[11px] font-medium"
            style={{ background: 'var(--accent-primary)', color: 'var(--text-on-accent)' }}
          >
            IMPORT PORTFOLIO
          </Link>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 size={18} style={{ color: 'var(--signal-positive)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Nothing urgent right now, sector spread and position sizing both look reasonable.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ActionCard key={item.id} item={item} onScrollTo={onScrollTo} />
          ))}
        </div>
      )}
    </div>
  </GlassPanel>
);

export default ActionBanner;
