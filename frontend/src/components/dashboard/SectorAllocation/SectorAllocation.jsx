import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { GlassPanel, PanelHead } from '../shared/GlassPanel';
import { zar } from '../../../utils/currency';

/** @type {Record<string, string>} */
const SECTOR_COLORS = {
Financials: '#3B82F6',
Materials: '#F97316',
Mining: '#C2410C',
Technology: '#06B6D4',
Telecommunications: '#A855F7',
Consumer: '#10B981',
Healthcare: '#EC4899',
Energy: '#EAB308',
Industrials: '#6366F1',
Utilities: '#84CC16',
RealEstate: '#F43F5E',
Other: '#64748B',};

/**
 * @param {{
 *   sectorData: {name:string, value:number}[],
 *   holdings: { ticker: string, sector: string|null, value: number }[],
 * }} props
 */
const SectorAllocation = ({ sectorData, holdings }) => {
  const [selected, setSelected] = useState(/** @type {string|null} */ (null));
  const filtered = selected ? holdings.filter((h) => (h.sector ?? 'Other') === selected) : holdings;

  const panelHint = selected && (
    <button onClick={() => setSelected(null)} className="font-mono text-[10px]" style={{ color: 'var(--accent-primary)' }}>
      Clear
    </button>);

  if (sectorData.length === 0) {
    return (
      <GlassPanel className="flex h-full flex-col">
        <PanelHead
          label="Sector Allocation"
          help="How your money is split across industries. Too much in one sector means whole portfolio is hit harder."
          hint={panelHint}/>
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
          Upload holdings to see your allocation.
        </div>
      </GlassPanel>
    );}

  let sectorList;
  if (selected) {
    if (filtered.length === 0) {
      sectorList = (
        <p className="py-2 text-[11px]" style={{ color: 'var(--text-ghost)' }}>No holdings in {selected}</p>
      );
    } else {
      sectorList = filtered.slice(0, 6).map((h) => (
        <div key={h.ticker} className="flex items-center justify-between px-1 font-mono text-[12px]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SECTOR_COLORS[h.sector ?? 'Other'] ?? SECTOR_COLORS.Other }} />
            <span className="font-bold">{h.ticker}</span>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{zar(h.value ?? 0)}</span>
        </div>
      ));}
  } else {
    sectorList = sectorData.map((s) => (
      <button
        key={s.name}
        onClick={() => setSelected(s.name)}
        className="grid w-full grid-cols-[10px_1fr_44px] items-center gap-2 rounded px-1 py-1 text-left font-mono text-[12px] transition-colors hover:bg-[var(--glass-hover)]">
        <span className="h-2.5 w-2.5 rounded" style={{ background: SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other }} />
        <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
        <span className="text-right" style={{ color: 'var(--text-secondary)' }}>{s.value.toFixed(1)}%</span>
      </button>
    ));}

  return (
    <GlassPanel className="flex h-full flex-col">
      <PanelHead
        label="Sector Allocation"
        help="How your money is split across industries. Too much in one sector means whole portfolio is hit harder."
        hint={panelHint}/>

      <div className="grid flex-1 grid-cols-1 items-center gap-4 p-5 md:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-[180px] w-full max-w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectorData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                onClick={(d) => {
                  const next = d.name === selected ? null : d.name;
                  setSelected(next);
                }}
                animationDuration={300}>
                {sectorData.map((s) => (
                  <Cell
                    key={s.name}
                    fill={SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other}
                    stroke="var(--bg-primary)"
                    strokeWidth={2}
                    opacity={!selected || selected === s.name ? 1 : 0.25}
                    style={{ cursor: 'pointer' }}
                  />))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
              {selected ?? 'Sectors'}
            </div>
            <div className="font-mono text-[18px] font-bold">
              {selected ? `${sectorData.find((s) => s.name === selected)?.value.toFixed(1)}%` : sectorData.length}
            </div>
          </div>
        </div>
        <div className="space-y-1.5">{sectorList}</div>
      </div>
    </GlassPanel>
  );};

export default SectorAllocation;