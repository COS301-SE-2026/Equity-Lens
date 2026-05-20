import { useState } from 'react';
import useIndicators from '../../hooks/useIndicators';

const INDICATORS = {
  capm: {
    label: 'CAPM',
    tooltip: 'Expected return based on how much this stock moves relative to the broader market. Higher beta = higher expected return demanded.',
    signal:   (v) => v > 14 ? 'positive' : 'neutral',
    describe: (v) => `${v}% expected annual return for this risk level`,
  },
  pe_ratio: {
    label: 'P/E Ratio',
    tooltip: 'Price paid per rand of earnings. Below 15 is cheap; above 30 may be expensive unless strong growth is expected.',
    signal:   (v) => v < 15 ? 'positive' : v > 30 ? 'negative' : 'neutral',
    describe: (v) => v < 15 ? 'Below market average' : v > 30 ? 'Premium valuation' : 'In line with market',
  },
  altman_z: {
    label: 'Altman Z',
    tooltip: 'Bankruptcy risk score. Above 2.99 is safe; below 1.81 signals distress; in between is the grey zone.',
    signal:   (v) => v > 2.99 ? 'positive' : v < 1.81 ? 'negative' : 'neutral',
    describe: (v) => v > 2.99 ? 'Safe zone' : v < 1.81 ? 'Distress zone' : 'Grey zone — monitor',
  },
  sharpe: {
    label: 'Sharpe Ratio',
    tooltip: "Return earned per unit of risk. Above 1.0 is good; negative means the risk isn't being rewarded.",
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good risk-adjusted return' : v < 0 ? 'Below risk-free rate' : 'Modest return for risk',
  },
  beta: {
    label: 'Beta',
    tooltip: 'Measures how much this stock moves relative to the market. Above 1 means more volatile than the market.',
    signal:   (v) => v < 1 ? 'positive' : v > 1.5 ? 'negative' : 'neutral',
    describe: (v) => v < 1 ? 'Less volatile than market' : v > 1.5 ? 'Highly volatile' : 'Moves with the market',
  },
  sortino: {
    label: 'Sortino Ratio',
    tooltip: 'Like the Sharpe ratio but only penalises downward volatility. Above 1 is good.',
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good downside-adjusted return' : v < 0 ? 'Poor downside performance' : 'Moderate',
  },
  rsi: {
    label: 'RSI',
    tooltip: 'Measures price momentum on a 0–100 scale. Above 70 is overbought; below 30 is oversold.',
    signal:   (v) => v < 30 ? 'positive' : v > 70 ? 'negative' : 'neutral',
    describe: (v) => v > 70 ? 'Overbought — possible pullback' : v < 30 ? 'Oversold — possible bounce' : 'Neutral momentum',
  },
};

const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1 cursor-default"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute z-50 bottom-full left-0 mb-2 w-52 rounded px-3 py-2 text-[10px] leading-relaxed pointer-events-none"
          style={{ background: 'var(--bg-elevated,#161616)', color: 'var(--text-secondary,#a0a0a0)',
            border: '1px solid var(--border-subtle,#2a2a2a)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', whiteSpace: 'normal' }}>
          {text}
        </span>
      )}
    </span>
  );
};

const InfoIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-ghost,#444)', flexShrink: 0 }}>
    <circle cx="6" cy="6" r="5.5" stroke="currentColor"/>
    <path d="M6 5.5v3M6 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const IndicatorCell = ({ indicatorKey, result, loading }) => {
  const meta = INDICATORS[indicatorKey];
  const color = (sig) =>
    sig === 'positive' ? 'var(--signal-positive,#22c55e)'
    : sig === 'negative' ? 'var(--signal-negative,#ef4444)'
    : 'var(--text-primary,#e5e5e5)';

  if (loading) return (
    <div className="flex flex-col gap-1.5 animate-pulse pt-1">
      <div className="h-4 w-12 rounded" style={{ background: 'var(--border-subtle,#2a2a2a)' }}/>
      <div className="h-2.5 w-16 rounded" style={{ background: 'var(--border-subtle,#2a2a2a)' }}/>
    </div>
  );

  if (!result || result.status === 'error') return (
    <div className="flex flex-col gap-0.5 pt-1">
      <span className="text-[11px] font-mono" style={{ color: 'var(--signal-negative,#ef4444)' }}>Error</span>
      <span className="text-[9px]" style={{ color: 'var(--text-ghost,#444)' }}>Calc failed</span>
    </div>
  );

  if (result.status === 'insufficient_data') return (
    <div className="flex flex-col gap-0.5 pt-1">
      <span className="text-[11px] font-mono" style={{ color: 'var(--text-ghost,#444)' }}>N/A</span>
      <span className="text-[9px] leading-tight" style={{ color: 'var(--text-ghost,#444)' }}>
        {result.reason?.split('.')[0]}
      </span>
    </div>
  );

  const sig = meta.signal(result.value);
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <span className="text-sm font-mono font-semibold tabular-nums"
        style={{ color: color(sig), letterSpacing: '-0.02em' }}>
        {result.value}{result.unit}
      </span>
      <span className="text-[9px] leading-tight" style={{ color: 'var(--text-ghost,#444)' }}>
        {meta.describe(result.value)}
      </span>
    </div>
  );
};

const StockRow = ({ stock, loading, results, index }) => (
  <div className="terminal-card overflow-hidden"
    style={{ animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${index * 70}ms` }}>
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '1px solid var(--border-subtle,#2a2a2a)' }}>
      <div className="w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0"
        style={{ background: 'var(--border-subtle,#2a2a2a)', color: 'var(--text-primary,#e5e5e5)' }}>
        {stock.ticker.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: 'var(--text-primary,#e5e5e5)' }}>{stock.ticker}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-ghost,#444)' }}>{stock.name}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
      {Object.keys(INDICATORS).map((key, i) => (
        <div key={key} className="px-3 pb-3"
          style={{ borderRight: i < 6 ? '1px solid var(--border-subtle,#2a2a2a)' : 'none' }}>
          <Tooltip text={INDICATORS[key].tooltip}>
            <span className="text-[9px] uppercase tracking-widest font-medium flex items-center gap-1 pt-3"
              style={{ color: 'var(--text-ghost,#444)' }}>
              {INDICATORS[key].label} <InfoIcon />
            </span>
          </Tooltip>
          <IndicatorCell indicatorKey={key} result={results?.[key]} loading={loading} />
        </div>
      ))}
    </div>
  </div>
);
export default function Analytics() {
  const { stockData, loading, error } = useIndicators();

  const stocks = Object.values(stockData).map((s) => s.results).filter(Boolean);

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="p-4 flex flex-col gap-4 max-w-[1600px] mx-auto w-full" aria-label="Analytics page">
        <div className="flex items-center justify-between pb-3"
          style={{ borderBottom: '1px solid var(--border-subtle,#2a2a2a)' }}>
          <div>
            <h1 className="text-xs font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-primary,#e5e5e5)' }}>Analytics</h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost,#444)' }}>
              Financial indicators calculated per holding — hover any label for an explanation
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded font-mono"
            style={{ color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)' }}>
            {stocks.length} holdings
          </span>
        </div>

        {error && (
          <div className="terminal-card text-center p-8" role="alert">
            <p className="text-xs font-medium" style={{ color: 'var(--signal-negative,#ef4444)' }}>
              Failed to load indicators
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary,#a0a0a0)' }}>{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="terminal-card overflow-hidden animate-pulse">
                  <div className="h-14 px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle,#2a2a2a)' }}>
                    <div className="h-3 w-16 rounded mb-2" style={{ background: 'var(--border-subtle,#2a2a2a)' }}/>
                    <div className="h-2.5 w-24 rounded" style={{ background: 'var(--border-subtle,#2a2a2a)' }}/>
                  </div>
                  <div className="grid grid-cols-7 p-3 gap-3">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <div key={j} className="h-10 rounded" style={{ background: 'var(--border-subtle,#2a2a2a)' }}/>
                    ))}
                  </div>
                </div>
              ))
            : stocks.map((stock, i) => (
                <StockRow
                  key={stock.ticker}
                  stock={stock}
                  index={i}
                  loading={false}
                  results={stock}
                />
              ))
          }
        </div>
      </div>
    </>
  );
}
