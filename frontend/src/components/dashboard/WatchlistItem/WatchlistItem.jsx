const WatchlistItem = ({ ticker, name, price, changePercent }) => {
  const positive = changePercent >= 0;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}
      className="last:border-0"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {ticker}
        </p>
        <p style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-primary)',
        }}>
          {name}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          R{price.toFixed(2)}
        </p>
        <span style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          padding: '1px 6px',
          borderRadius: '3px',
          background: positive ? 'var(--signal-positive-bg)' : 'var(--signal-negative-bg)',
          color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)',
          border: positive
            ? '1px solid var(--signal-positive-border)'
            : '1px solid var(--signal-negative-border)',
        }}>
          {positive ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
      </div>
    </div>
  );
};

export default WatchlistItem;
