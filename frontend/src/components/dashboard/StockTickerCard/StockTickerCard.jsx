import { TrendingUp, TrendingDown } from 'lucide-react';

const StockTickerCard = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 hover:border-[var(--accent-primary)] transition-all duration-200 cursor-pointer">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--accent-primary)] flex-shrink-0">
          {ticker.slice(0, 2)}
        </div>
        <div>
          <p className="text-xs text-[var(--text-secondary)]">{name}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{ticker}</p>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-xl font-mono font-semibold text-[var(--text-primary)]">
          R{price?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div
          className={`flex items-center gap-1 text-sm font-semibold ${
            positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {positive ? '+' : ''}{changePercent?.toFixed(2)}%
        </div>
      </div>
    </div>
  );
};

export default StockTickerCard;