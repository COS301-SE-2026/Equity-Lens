import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value?.toFixed(2)}%`;

const HoldingsTable = ({ holdings = [] }) => {
  if (!holdings || holdings.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
        No holdings found. Import your portfolio to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" aria-label="Holdings table">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-[var(--border-default)]">
            {['Ticker', 'Name', 'Sector', 'Qty', 'Avg Cost', 'Current', 'Value', 'P&L', 'P&L %'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, index) => {
            const positive = h.gain_loss_pct >= 0;
            return (
              <tr
                key={h.ticker}
                className={`border-b border-[var(--border-default)] last:border-0 hover:bg-[rgba(255,184,0,0.03)] transition-colors ${
                  index % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'
                }`}
              >
                <td className="px-4 py-3 font-mono font-semibold text-[var(--accent-primary)]">
                  {h.ticker}
                </td>
                <td className="px-4 py-3 text-[var(--text-primary)]">{h.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {h.sector}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[var(--text-primary)]">{h.quantity}</td>
                <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                  {formatCurrency(h.avg_price)}
                </td>
                <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                  {formatCurrency(h.current_price)}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-[var(--text-primary)]">
                  {formatCurrency(h.value)}
                </td>
                <td className={`px-4 py-3 font-mono ${positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                  {positive ? '+' : ''}R{h.gain_loss?.toFixed(0)}
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`flex items-center gap-1 font-mono font-semibold ${
                      positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                    }`}
                  >
                    {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {formatPercent(h.gain_loss_pct)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default HoldingsTable;