import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import { zar } from '../../../utils/currency';
import { CONCENTRATION_HIGH, getConcRisk } from '../../../utils/dashboardInsights';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import SecondaryButton from '../shared/SecondaryButton';

/** @type {Record<string, string>} */
const SECTOR_COLORS = {
  Financials: '#3B82F6',
  Materials: '#F97316',
  Mining: '#C2410C',
  Technology: '#06B6D4',
  Telcos: '#A855F7',
  Telecommunications: '#A855F7',
  Consumer: '#10B981',
  Healthcare: '#EC4899',
  Energy: '#EAB308',
  Industrials: '#6366F1',
  Utilities: '#84CC16',
  RealEstate: '#F43F5E',
  'SA Equity': '#22C55E',
  'US Equity': '#0EA5E9',
  'Global Equity': '#8B5CF6',
  'Emerging Market Equity': '#F59E0B',
  Other: '#64748B',
};

/** @param {{ label: string, value: string, tone?: string, caption?: string }} props */
const ExposureStat = ({ label, value, tone, caption }) => (
  <div>
    <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
      {label}
    </div>
    <div className="mt-0.5 font-mono text-[16px] font-semibold" style={{ color: tone ?? 'var(--text-primary)' }}>
      {value}
    </div>
    {caption && (
      <div className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
        {caption}
      </div>
    )}
  </div>
);

/**
 * @param {{ pct: number, color: string }} props
 */
const ThresholdBar = ({ pct, color }) => (
  <div className="relative mt-1 h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-subtle)' }}>
    <div
      className="h-full rounded-full transition-all"
      style={{ width: `${Math.min(100, pct)}%`, background: color }}
    />
    <div
      className="absolute top-0 h-full w-px"
      style={{ left: `${CONCENTRATION_HIGH}%`, background: 'var(--text-ghost)' }}
      title={`${CONCENTRATION_HIGH}% concentration threshold`}
    />
  </div>
);

/**
 * @param {{
 *   sectorData: {name:string, value:number}[],
 *   holdings: any[],
 *   flashSector?: boolean,
 *   flashHoldings?: boolean,
 * }} props
 */
const PortfolioOverview = ({ sectorData, holdings, flashSector, flashHoldings }) => {
  const FLASH_RING = 'ring-4 ring-inset ring-orange-500 animate-pulse transition-all duration-500';
  const [selected, setSelected] = useState(null);
  const filtered = selected ? holdings.filter((h) => (h.sector ?? 'Other') === selected) : holdings;

  const totalValue = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const top = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 4);

  return (
    <GlassPanel className="flex h-full flex-col">
      <PanelHead
        label="Portfolio Overview"
        help="Where your money sits, how spread out it is across sectors, and which single positions carry the most weight."
      />

      {holdings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          Upload holdings to see portfolio overview.
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
          <div id="sector-allocation" className={`rounded-xl p-5 ${flashSector ? FLASH_RING : ''}`} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                Sector Allocation
              </span>
              {selected && (
                <button onClick={() => setSelected(null)} className="font-mono text-[9px]" style={{ color: 'var(--accent-primary)' }}>
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[140px_1fr]">
              <div className="relative mx-auto h-[140px] w-full max-w-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      onClick={(d) => setSelected(d.name === selected ? null : d.name)}
                      animationDuration={300}
                    >
                      {sectorData.map((s) => (
                        <Cell
                          key={s.name}
                          fill={SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other}
                          stroke="var(--bg-primary)"
                          strokeWidth={2}
                          opacity={!selected || selected === s.name ? 1 : 0.25}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-mono text-[8px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                    {selected ?? 'Sectors'}
                  </div>
                  <div className="font-mono text-[16px] font-bold">
                    {selected ? `${sectorData.find((s) => s.name === selected)?.value.toFixed(1)}%` : sectorData.length}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {selected
                  ? (filtered.length === 0 ? (
                      <p className="py-2 text-[11px]" style={{ color: 'var(--text-ghost)' }}>No holdings in {selected}</p>
                    ) : (
                      filtered.slice(0, 5).map((h) => (
                        <div key={h.ticker} className="flex items-center justify-between px-1 font-mono text-[12px]">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SECTOR_COLORS[h.sector ?? 'Other'] ?? SECTOR_COLORS.Other }} />
                            <span className="font-bold">{h.ticker}</span>
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{zar(h.value ?? 0)}</span>
                        </div>
                      ))
                    ))
                  : sectorData.slice(0, 5).map((s) => {
                      const risk = getConcRisk(s.value);
                      return (
                        <button
                          key={s.name}
                          onClick={() => setSelected(s.name)}
                          className="w-full rounded px-1 py-1.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                        >
                          <div className="grid grid-cols-[10px_1fr_40px] items-center gap-2 font-mono text-[11px]">
                            <span className="h-2.5 w-2.5 rounded" style={{ background: SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other }} />
                            <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                            <span className="text-right" style={{ color: risk.level === 'low' ? 'var(--text-secondary)' : risk.color }}>
                              {s.value.toFixed(1)}%
                            </span>
                          </div>
                          <div className="pl-[18px]">
                            <ThresholdBar pct={s.value} color={risk.color} />
                          </div>
                          <p className="mt-0.5 pl-[18px] text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>
                            {risk.level === 'high'
                              ? `${risk.label} concentration - above the ${CONCENTRATION_HIGH}% threshold`
                              : risk.level === 'moderate'
                                ? `${risk.label} concentration - approaching the ${CONCENTRATION_HIGH}% threshold`
                                : `${risk.label} concentration - well under the ${CONCENTRATION_HIGH}% threshold`}
                          </p>
                        </button>
                      );
                    })}
              </div>
            </div>
          </div>
          <div id="holdings-table" className={`flex flex-col rounded-xl p-5 ${flashHoldings ? FLASH_RING : ''}`}>
            <span className="mb-3 font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              Largest Positions
            </span>
            <div className="mb-3 grid grid-cols-2 gap-3 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <ExposureStat label="Positions" value={String(holdings.length)} />
              <ExposureStat label="Sectors" value={String(sectorData.length)} />
            </div>
            <div className="flex-1 space-y-1">
              {top.map((h) => {
                const weight = totalValue ? ((h.value ?? 0) / totalValue) * 100 : 0;
                const positive = (h.daily_change_pct ?? 0) >= 0;
                return (
                  <div key={h.ticker} className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-bold">{h.ticker}</div>
                      <div className="truncate text-[10px]" style={{ color: 'var(--text-ghost)' }}>{h.name}</div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>{weight.toFixed(1)}%</span>
                      <span className="font-mono text-[11px]" style={{ color: positive ? 'var(--signal-positive)' : 'var(--signal-negative)' }}>
                        {positive ? '+' : ''}{(h.daily_change_pct ?? 0).toFixed(2)}%
                      </span>
                      <span className="font-mono text-[12px] font-semibold">{zar(h.value ?? 0)}</span>
                    </div>
                  </div>
                );
              })}
              {holdings.length > top.length && (
                <div
                  className="flex items-center justify-between px-2 pt-2 font-mono text-[11px]"
                  style={{ color: 'var(--text-ghost)', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <span>+{holdings.length - top.length} more</span>
                  <span>{zar(totalValue - top.reduce((s, h) => s + (h.value ?? 0), 0))}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto px-5 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <SecondaryButton to="/portfolio">
          View full portfolio
        </SecondaryButton>
      </div>
    </GlassPanel>
  );
};

export default PortfolioOverview;