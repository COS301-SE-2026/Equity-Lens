import { TrendingUp, TrendingDown } from 'lucide-react';

const WatchlistItem = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-default)] last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold text-[var(--accent-primary)]">
          {ticker.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{ticker}</p>
          <p className="text-xs text-[var(--text-secondary)]">{name}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-sm font-mono font-semibold text-[var(--text-primary)]">
          R{price?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div
          className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${
            positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {positive ? '+' : ''}{changePercent?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

export default WatchlistItem;