import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import SecondaryButton from '../shared/SecondaryButton';
import { getConcRisk } from '../../../utils/dashboardInsights';

/**
 * @param {{
 *   sectorData: {name:string, value:number}[],
 *   selected: string|null,
 *   onSelectSector: (sector: string|null) => void,
 *   flashSector?: boolean,
 * }} props
 */
const SectorAllocation = ({ sectorData, selected, onSelectSector, flashSector }) => {
  return (
    <div id="sector-allocation" className={`dashboard-highlight rounded-xl p-3 ${flashSector ? 'is-active' : ''}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          Sectors
          <HelpTooltip text="Where your money sits across industries. Too much in one sector means whole-portfolio news can hit harder." />
        </div>
        {selected && (
          <SecondaryButton size="sm" onClick={() => onSelectSector(null)}>
            Filtered to {selected} - Clear
          </SecondaryButton>)}
      </div>
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
              onClick={(d) => onSelectSector(d.name === selected ? null : d.name)}
              animationDuration={300}>
              {sectorData.map((s) => (
                <Cell
                  key={s.name}
                  fill={getConcRisk(s.value).color}
                  stroke="var(--surface-card)"
                  strokeWidth={2}
                  opacity={!selected || selected === s.name ? 1 : 0.25}
                  style={{ cursor: 'pointer' }}
                />))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mx-auto mt-2 max-w-[140px] text-center">
        <div className="font-mono text-[8px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          {selected ?? 'Sectors'}
        </div>
        <div className="font-mono text-[18px] font-bold">
          {selected ? `${sectorData.find((s) => s.name === selected)?.value.toFixed(1)}%` : sectorData.length}
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {sectorData.map((s) => {
          const risk = getConcRisk(s.value);
          const isSelected = selected === s.name;
          return (
            <button
              key={s.name}
              type="button"
              onClick={() => onSelectSector(isSelected ? null : s.name)}
              className="w-full rounded px-1.5 py-1 text-left transition-colors hover:bg-[var(--surface-hover)]"
              style={isSelected ? { background: 'var(--surface-hover)' } : undefined}>
              <div className="grid grid-cols-[10px_1fr_44px] items-center gap-2 font-mono text-[11px]">
                <span className="h-2.5 w-2.5 rounded" style={{ background: risk.color }} />
                <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                <span className="text-right" style={{ color: risk.level === 'low' ? 'var(--text-secondary)' : risk.color }}>
                  {s.value.toFixed(1)}%
                </span>
              </div>
            </button>
          );})}
      </div>
    </div>
  );};

export default SectorAllocation;
