import { X } from 'lucide-react';
import Money from '../../common/Money/Money';

/**
 * @param {{
 *   ticker: string,
 *   name: string,
 *   price: number,
 *   changePercent: number,
 *   onRemove?: () => void,
 * }} props
 */
const WatchlistItem = ({ ticker, name, price, changePercent, onRemove }) => {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          <Money as="p" style={{
            fontSize: '12px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            R{price.toFixed(2)}
          </Money>
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
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={`Remove ${ticker} from watchlist`}
            style={{ color: 'var(--text-ghost)', lineHeight: 0 }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

export default WatchlistItem;
