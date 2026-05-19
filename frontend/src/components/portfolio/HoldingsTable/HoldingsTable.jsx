import React from 'react';

import PropTypes from 'prop-types';

HoldingsTable.propTypes = {
  holdings: PropTypes.arrayOf(
    PropTypes.shape({
      ticker: PropTypes.string,
      name: PropTypes.string,
      sector: PropTypes.string,
      quantity: PropTypes.number,
      avg_price: PropTypes.number,
      current_price: PropTypes.number,
      value: PropTypes.number,
      gain_loss: PropTypes.number,
      gain_loss_pct: PropTypes.number,
    })
  ),
};

const COLS = ['Ticker', 'Name', 'Sector', 'Qty', 'Avg Cost', 'Current', 'Value', 'P&L', 'P&L %'];

const HoldingsTable = ({ holdings = [] }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {COLS.map((col) => (
            <th
              key={col}
              style={{
                textAlign: 'left',
                paddingBottom: '8px',
                paddingRight: '16px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {holdings.map((h, i) => {
          const positive = h.gain_loss_pct >= 0;
          return (
            <tr
              key={h.ticker}
              style={{
                borderBottom: i < holdings.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                transition: 'background 120ms ease-out',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {h.ticker}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' }}>
                {h.name}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)', whiteSpace: 'nowrap' }}>
                {h.sector}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                {h.quantity}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                R{h.avg_price?.toFixed(2)}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                R{h.current_price?.toFixed(2)}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                R{h.value?.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '10px 16px 10px 0', fontSize: '12px', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                {positive ? '+' : ''}R{h.gain_loss?.toFixed(0)}
              </td>
              <td style={{ padding: '10px 0' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  background: positive ? 'var(--signal-positive-bg)' : 'var(--signal-negative-bg)',
                  color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)',
                  border: positive
                    ? '1px solid var(--signal-positive-border)'
                    : '1px solid var(--signal-negative-border)',
                }}>
                  {positive ? '+' : ''}{h.gain_loss_pct?.toFixed(1)}%
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default HoldingsTable;
