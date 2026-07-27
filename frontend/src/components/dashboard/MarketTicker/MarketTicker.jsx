import { TrendingUp, TrendingDown } from 'lucide-react';

//replace with live before demo 2
const MACRO = [
  { sym: 'JSE-ALSI', val: '81,204', chg: 0.84 },
  { sym: 'USD/ZAR', val: '18.42', chg: -0.31 },
  { sym: 'BRENT', val: '$83.14', chg: 1.12 },
  { sym: 'GOLD', val: '$2,341', chg: 0.58 },
];

const MarketTicker = () => (
  <div
    className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-4 py-3"
    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
    {MACRO.map((m) => (
      <div key={m.sym} className="flex items-center gap-2 font-mono text-[11px]">
        <span style={{ color: 'var(--text-secondary)' }}>{m.sym}</span>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{m.val}</span>
        <span
          className="inline-flex items-center gap-0.5"
          style={{ color: m.chg >= 0 ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
          {m.chg >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {m.chg >= 0 ? '+' : ''}
          {m.chg}%
        </span>
      </div>
    ))}
  </div>
);

export default MarketTicker;
