const StockTickerCard = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-bold text-[var(--accent-primary)]">
          {ticker.slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{ticker}</p>
          <p className="text-xs text-[var(--text-secondary)]">{name}</p>
        </div>
      </div>
      <p className="text-xl font-mono font-semibold text-[var(--text-primary)]">
        R{price?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export default StockTickerCard;