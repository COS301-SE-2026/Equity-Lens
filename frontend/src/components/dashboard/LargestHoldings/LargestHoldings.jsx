import { Link } from 'react-router-dom';

import { zar } from '../../../utils/currency';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';

/** @param {{ label: string, value: string }} props */
const ExposureStat = ({ label, value }) => (
  <div>
    <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    <div className="mt-0.5 font-mono text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
      {value}
    </div>
  </div>
);

/**
 * @param {{ holdings: any[], sectorCount: number }} props
 */
const LargestHoldings = ({ holdings, sectorCount }) => {
  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const top = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 4);
  const topPct = totalValue && top[0] ? ((top[0].value ?? 0) / totalValue) * 100 : 0;

  return (
    <GlassPanel className="flex h-full flex-col">
      <PanelHead
        label="Largest Positions"
        help="Your biggest holdings by rand value - not necessarily your best performers."
      />
      <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <ExposureStat label="Positions" value={String(holdings.length)} />
        <ExposureStat label="Sectors" value={String(sectorCount)} />
        <ExposureStat label="Largest position" value={top[0] ? `${topPct.toFixed(0)}%` : '—'} />
      </div>

      {top.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          No holdings yet.
        </div>
      ) : (
        <div className="flex-1 p-2">
          {top.map((h) => {
            const weight = totalValue ? ((h.value ?? 0) / totalValue) * 100 : 0;
            const positive = (h.daily_change_pct ?? 0) >= 0;
            return (
              <div key={h.ticker} className="flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-[var(--glass-hover)]">
                <div className="min-w-0">
                  <div className="font-mono text-[12px] font-bold">{h.ticker}</div>
                  <div className="truncate text-[10px]" style={{ color: 'var(--text-ghost)' }}>{h.name}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                    {weight.toFixed(1)}%
                  </span>
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}
                  >
                    {positive ? '+' : ''}
                    {(h.daily_change_pct ?? 0).toFixed(2)}%
                  </span>
                  <span className="font-mono text-[12px] font-semibold">{zar(h.value ?? 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <Link to="/portfolio" className="font-mono text-[11px] font-medium" style={{ color: 'var(--accent-primary)' }}>
          View full portfolio
        </Link>
      </div>
    </GlassPanel>
  );
};

export default LargestHoldings;
