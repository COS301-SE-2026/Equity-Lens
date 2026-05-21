const StockTickerCard = ({ ticker, name, price, changePercent, totalReturn }) => {
  const dailyPositive = changePercent >= 0;
  const totalPositive = totalReturn >= 0;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <p style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-primary)',
          }}>
            {name}
          </p>
          <p style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {ticker}
          </p>
        </div>

        <span style={{
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '3px',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
          background: totalPositive ? 'var(--signal-positive-bg)' : 'var(--signal-negative-bg)',
          color: totalPositive ? 'var(--signal-positive)' : 'var(--signal-negative)',
          border: totalPositive
            ? '1px solid var(--signal-positive-border)'
            : '1px solid var(--signal-negative-border)',
        }}>
          {totalPositive ? '+' : ''}{totalReturn?.toFixed(2)}%
        </span>
      </div>

      {/* Price */}
      <p style={{
        fontSize: '20px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
      }}>
        R{price?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>

      {/* Metadata row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <span style={{
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-primary)',
        }}>
          JSE
        </span>
        <span style={{
          fontSize: '9px',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          Vol 1.2M
        </span>

        <span style={{
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          color: dailyPositive ? 'var(--signal-positive)' : 'var(--signal-negative)',
        }}>
          24h {dailyPositive ? '▲' : '▼'} {Math.abs(changePercent?.toFixed(2))}%
        </span>
      </div>
    </div>
  );
};

export default StockTickerCard;
