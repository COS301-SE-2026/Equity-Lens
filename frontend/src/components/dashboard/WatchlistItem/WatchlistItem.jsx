const WatchlistItem = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-default)] last:border-0">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{ticker}</p>
        <p className="text-xs text-[var(--text-secondary)]">{name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono text-[var(--text-primary)]">
          R{price.toFixed(2)}
        </p>
        <p className={`text-xs font-mono ${positive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
          {positive ? '+' : ''}{changePercent.toFixed(2)}%
        </p>
      </div>
    </div>
  );
};

export default WatchlistItem;