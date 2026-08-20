import { Link } from 'react-router-dom';

import { zar } from '../../../utils/currency';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';

/** @type {Record<string, string>} */
const SECTOR_COLORS = {
  Financials: '#3B82F6',
  Materials: '#F97316',
  Mining: '#C2410C',
  Technology: '#06B6D4',
  Telcos: '#A855F7',
  Telecommunications: '#A855F7',
  Consumer: '#10B981',
  Healthcare: '#EC4899',
  Energy: '#EAB308',
  Industrials: '#6366F1',
  Utilities: '#84CC16',
  RealEstate: '#F43F5E',
  Other: '#64748B',
};

/**
 * @param {{ holdings: any[] }} props
 */
const DashboardHoldingsTable = ({ holdings }) => {
  const totalVal = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);

  return (
    <GlassPanel>
      <PanelHead label="Holdings" hint={`${holdings.length} position${holdings.length === 1 ? '' : 's'}`} />
      {holdings.length === 0 ? (
        <div className="p-8 text-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          Upload holdings to see them here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th>Asset</th>
              <th>Sector</th>
              <th>Allocation</th>
              <th>Price</th>
              <th>Today</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const value = h.value ?? 0;
                const changePct = h.daily_change_pct ?? 0;
                const pct = totalVal ? (value / totalVal) * 100 : 0;
                const profit = (value * changePct) / 100;
                const pos = changePct >= 0;
                const color = SECTOR_COLORS[h.sector] ?? SECTOR_COLORS.Other;
                return (
                  <tr key={h.ticker} className="transition-colors hover:bg-[var(--glass-hover)]" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-4 py-2.5">
                      <div className="font-mono text-[12px] font-bold">{h.ticker}</div>
                      <div className="truncate text-[10px]" style={{ color: 'var(--text-ghost)' }}>{h.name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px]"
                        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        {h.sector || 'Other'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full" style={{ background: 'var(--border-subtle)' }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">{zar(h.current_price ?? 0)}</td>
                    <td
                      className="px-4 py-2.5 font-mono text-[12px]"
                      style={{ color: pos ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                      {pos ? '+' : ''}
                      {zar(profit)}
                      <span className="ml-1 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        ({pos ? '+' : ''}
                        {changePct.toFixed(2)}%)
                      </span>
                    </td>
                  </tr>
                );})}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <Link to="/portfolio" className="font-mono text-[11px] font-medium" style={{ color: 'var(--accent-primary)' }}>
          Full transaction history
        </Link>
      </div>
    </GlassPanel>
  );
};

export default DashboardHoldingsTable;