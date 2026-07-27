import { Link } from 'react-router-dom';
import { AlertTriangle, Lightbulb, MessageCircle, CheckCircle2, Upload } from 'lucide-react';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';

const SEVERITY = {
  risk: { icon: AlertTriangle, color: 'var(--signal-negative)', label: 'RISK' },
  suggestion: { icon: Lightbulb, color: 'var(--accent-primary)', label: 'SUGGESTION' },
  info: { icon: MessageCircle, color: 'var(--text-secondary)', label: 'WORTH ASKING' },
};

/**
 * @param {{
 *   item: { id: string, severity: 'risk'|'suggestion'|'info', title: string, detail: string, cta: { label: string, to?: string, target?: string } },
 *   onScrollTo: (target: string) => void,
 * }} props
 */
const ActionItem = ({ item, onScrollTo }) => {
  const { icon: Icon, color, label } = SEVERITY[item.severity];
  return (
    <div className="flex gap-3 rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
      <Icon size={16} className="mt-0.5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 font-mono text-[9px] tracking-widest" style={{ color }}>
          {label}
        </div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {item.title}
        </p>
        <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          {item.detail}
        </p>
        {item.cta.to ? (
          <Link
            to={item.cta.to}
            className="mt-2 inline-block font-mono text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-primary)' }}
          >
            {item.cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => { if (item.cta.target) onScrollTo(item.cta.target)}}
            className="mt-2 font-mono text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent-primary)' }}
          >
            {item.cta.label}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * @param {{ items: any[], hasHoldings: boolean, onScrollTo: (target: string) => void }} props
 */
const ActionCentre = ({ items, hasHoldings, onScrollTo }) => (
  <GlassPanel>
    <PanelHead label="ACTION CENTRE" hint={hasHoldings ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined} />
    <div className="p-5">
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
        <div className="flex items-center gap-3 py-4">
          <CheckCircle2 size={18} style={{ color: 'var(--signal-positive)' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            Nothing urgent right now, sector spread and position sizing both look reasonable.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ActionItem key={item.id} item={item} onScrollTo={onScrollTo} />
          ))}
        </div>
      )}
    </div>
  </GlassPanel>
);

export default ActionCentre;
