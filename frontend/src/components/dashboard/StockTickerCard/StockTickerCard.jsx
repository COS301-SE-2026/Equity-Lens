const StockTickerCard = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-[var(--text-secondary)]">{name}</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{ticker}</p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            positive
              ? 'bg-[rgba(34,197,94,0.1)] text-[var(--color-success)]'
              : 'bg-[rgba(239,68,68,0.1)] text-[var(--color-danger)]'
          }`}
        >
          {positive ? '+' : ''}{changePercent?.toFixed(2)}%
        </span>
      </div>
      <p className="text-xl font-mono font-semibold text-[var(--text-primary)]">
        R{price?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export default StockTickerCard;