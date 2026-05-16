const HoldingsTable = ({ holdings = [] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--border-default)]">
          {['Ticker', 'Name', 'Sector', 'Qty', 'Avg Cost', 'Current', 'Value', 'P&L', 'P&L %'].map(h => (
            <th key={h} className="text-left pb-2 text-xs font-medium text-[var(--text-secondary)] pr-4 last:pr-0">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {holdings.map((h) => {
          const positive = h.gain_loss_pct >= 0;
          return (
            <tr key={h.ticker} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
              <td className="py-3 pr-4 font-mono font-medium text-[var(--text-primary)]">{h.ticker}</td>
              <td className="py-3 pr-4 text-[var(--text-secondary)]">{h.name}</td>
              <td className="py-3 pr-4 text-[var(--text-secondary)]">{h.sector}</td>
              <td className="py-3 pr-4 font-mono text-[var(--text-primary)]">{h.quantity}</td>
              <td className="py-3 pr-4 font-mono text-[var(--text-primary)]">R{h.avg_price?.toFixed(2)}</td>
              <td className="py-3 pr-4 font-mono text-[var(--text-primary)]">R{h.current_price?.toFixed(2)}</td>
              <td className="py-3 pr-4 font-mono text-[var(--text-primary)]">R{h.value?.toLocaleString()}</td>
              <td className={`py-3 pr-4 font-mono ${positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {positive ? '+' : ''}R{h.gain_loss?.toFixed(0)}
              </td>
              <td className={`py-3 font-mono ${positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {positive ? '+' : ''}{h.gain_loss_pct?.toFixed(1)}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default HoldingsTable;