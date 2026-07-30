import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import { zar } from '../../../utils/currency';

/** @param {{ label: string, items: {ticker:string, contribution:number}[], tone: 'good'|'bad' }} props */
const MoverColumn = ({ label, items, tone }) => (
  <div>
    <div className="mb-2 font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    {items.length === 0 ? (
      <p className="text-[12px]" style={{ color: 'var(--text-ghost)' }}>
        Nothing meaningful today
      </p>
    ) : (
      <div className="space-y-1.5">
        {items.slice(0, 3).map((it) => (
          <div key={it.ticker} className="flex items-center justify-between font-mono text-[13px]">
            <span className="font-bold">{it.ticker}</span>
            <span style={{ color: tone === 'good' ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
              {it.contribution >= 0 ? '+' : ''}
              {zar(it.contribution)}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/**
 * @param {{ attribution: { contributors: any[], drags: any[], todayReturn: number } }} props
 */
const TopMovers = ({ attribution }) => (
  <GlassPanel>
    <PanelHead label="Today's Movers" />
    <div className="grid grid-cols-2 gap-6 p-5">
      <MoverColumn label="Top contributors" items={attribution.contributors} tone="good" />
      <MoverColumn label="Largest drag" items={attribution.drags} tone="bad" />
    </div>
  </GlassPanel>
);

export default TopMovers;
