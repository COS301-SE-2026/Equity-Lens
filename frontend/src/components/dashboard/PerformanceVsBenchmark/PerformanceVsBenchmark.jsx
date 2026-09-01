import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import { GlassPanel } from '../shared/GlassPanel';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import MoneyAxisTick from '../shared/MoneyAxisTick';
import { zar } from '../../../utils/currency';
import { buildChartStats, filterByRange, buildExplanation, buildingHistoryLabel, buildPerformanceQuestions,
} from '../../../utils/dashboardInsights';
import ContributionsChart from '../ContributionsChart/ContributionsChart';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';

/** @typedef {'1D'|'1W'|'1M'|'3M'|'1Y'|'ALL'} RangeKey */
/** @type {RangeKey[]} */
const RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
/** @param {{ diff: string, diffPct: number, benchAvailable: boolean }} stats
 *  @param {string} benchmarkLabel */
function takeaway(stats, benchmarkLabel) {
  if (!stats.benchAvailable) return null;
  let word;
  if (stats.diffPct >= 0) {
    word = 'outperformed';
  } else {
    word = 'underperformed';
  }
  return `Your portfolio has ${word} the ${benchmarkLabel} by ${Math.abs(stats.diffPct).toFixed(1)}% over the selected period.`;
}

/** @param {{ active?: boolean, payload?: any[], label?: string, benchmarkLabel: string }} props */
export const PerfTooltip = ({ active, payload, label, benchmarkLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[11px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}>
      <div className="mb-1 text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
      </div>
      {payload.map((p) => {
        let who;
        if (p.dataKey === 'value') {
          who = 'you';
        } else {
          who = benchmarkLabel;
        }
        return (
          <div key={p.dataKey} className="flex items-center gap-3 py-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{who}</span>
            </span>
            <Money className="ml-auto font-semibold">{zar(p.value)}</Money>
          </div>
        );
      })}
    </div>
  );};

/** @param {{ label: string, value: string, tone: 'good'|'bad'|'neutral', help?: string, loading?: boolean }} props */
const Stat = ({ label, value, tone, help, loading }) => {
  let color;
  if (tone === 'good') {
    color = 'var(--signal-positive)';
  } else if (tone === 'bad') {
    color = 'var(--signal-negative)';
  } else {
    color = 'var(--text-primary)';
  }

  let valueDisplay;
  if (loading) {
    valueDisplay = (
      <div className="mt-1.5 h-[18px] w-14 animate-pulse rounded" style={{ background: 'var(--border-subtle)' }} />
    );
  } else {
    valueDisplay = (
      <div className="mt-1 font-mono text-[15px] font-semibold" style={{ color }}>
        {value}
      </div>
    );}

  return (
    <div>
      <div className="flex items-center gap-1 font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
        {help && <HelpTooltip text={help} />}
      </div>
      {valueDisplay}
    </div>
  );};

/** @param {{ range: string, active: boolean, onClick: () => void }} props */
const RangeButton = ({ range, active, onClick }) => {
  let background;
  let color;
  if (active) {
    background = 'var(--accent-primary)';
    color = 'var(--text-on-accent)';
  } else {
    background = 'transparent';
    color = 'var(--text-ghost)';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2.5 py-1 font-mono text-[10px] font-medium transition-colors"
      style={{ background, color }}>
      {range}
    </button>
  );};

/**
 * @param {{
 *   series: {date:string, name:string, value:number, benchmark?:number}[],
 *   contributionSeries?: {date:string, name:string, portfolio_value:number, cumulative_net_contributions:number, cumulative_market_gain:number}[],
 *   attribution?: { contributors: any[], drags: any[], todayReturn: number },
 *   benchmarkLabel?: string,
 *   historyDays?: number,
 * }} props
 */
const PerformanceVsBenchmark = ({
  series,
  contributionSeries = [],
  attribution = { contributors: [], drags: [], todayReturn: 0 },
  benchmarkLabel = 'JSE ALSI',
  historyDays = 0,
}) => {
  const [range, setRange] = useState(/** @type {RangeKey} */ ('ALL'));
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const chartContainerRef = useRef(null);
  const lastStepAtRef = useRef(0);
  const STEP_COOLDOWN_MS = 250;
  /** @param {WheelEvent} event */
  const handleWheelZoom = useCallback((/** @type {WheelEvent} */ event) => {
  const idx = RANGES.indexOf(range);
  const scrollingToShorter = event.deltaY > 0;
  const atFloor = idx === 0 && scrollingToShorter;
  const atCeiling = idx === RANGES.length - 1 && !scrollingToShorter;
  if (atFloor || atCeiling) return;
  event.preventDefault();
  const now = Date.now();
  if (now - lastStepAtRef.current < STEP_COOLDOWN_MS) return;
  lastStepAtRef.current = now;
  setRange(RANGES[scrollingToShorter ? idx - 1 : idx + 1]);}, [range]);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return undefined;
    node.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => node.removeEventListener('wheel', handleWheelZoom);}, [handleWheelZoom]);

  const { series: visibleSeries } = useMemo(() => {
    return filterByRange(series, range);
  }, [series, range]);

  const { series: visibleContributionSeries } = useMemo(() => {
    return filterByRange(contributionSeries, range);}, [contributionSeries, range]);

  const stats = useMemo(() => {
    return buildChartStats(visibleSeries, { historyDays });}, [visibleSeries, historyDays]);

  const { explanation } = useMemo(() => {
    return buildExplanation({ stats, attribution });
  }, [stats, attribution]);

  /** @type {'good'|'bad'|'neutral'} */
  let portTone;
  if (!stats.portAvailable) {
    portTone = 'neutral'; } else if (stats.portReturn.startsWith('-')) {
    portTone = 'bad';
  } else {
    portTone = 'good';
  }

  /** @type {'good'|'bad'} */
  let diffTone;
  if (stats.diff.startsWith('-')) {
    diffTone = 'bad';
  } else {
    diffTone = 'good';
  }

  let chartArea;
  if (visibleSeries.length === 0) {
    chartArea = (
      <div className="flex h-full items-center justify-center text-[12px]" style={{ color: 'var(--text-ghost)' }}>
        Performance history will appear once portfolio has sufficient data.
      </div>
    );
  } else {
    chartArea = (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={visibleSeries} margin={{ top: 24, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--text-ghost)"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
          />
          <YAxis
            stroke="var(--text-ghost)"
            tick={<MoneyAxisTick />}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<PerfTooltip benchmarkLabel={benchmarkLabel} />} />
          <Line type="monotone" dataKey="benchmark" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: 'var(--accent-primary)', stroke: 'var(--surface-card)', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    );}

  return (
      <div className="group relative">
        <CardMascotTrigger
        questions={buildPerformanceQuestions({ diffPct: stats.diffPct, benchAvailable: stats.benchAvailable, benchmarkLabel })}
        label="Ask AI about performance vs benchmark"
        className="-right-6 top-16"/>
      <GlassPanel className="flex flex-col">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          Performance vs Benchmark
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-5 font-mono text-[10px]">
            <LegendDot color="var(--accent-primary)" label="Portfolio" />
            <LegendDot color="var(--text-secondary)" label={benchmarkLabel} dashed />
          </div>
          <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--surface-raised)' }}>
            {RANGES.map((r) => {
              return <RangeButton key={r} range={r} active={range === r} onClick={() => setRange(r)} />;
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Stat label="Portfolio return" value={stats.portAvailable ? stats.portReturn : buildingHistoryLabel(stats.historyDays)} tone={portTone} help="Time-weighted return - removes the effect of when you deposited or withdrew money, so it can be fairly compared to an index."/>
        <Stat label={`${benchmarkLabel} return`} value={stats.benchReturn} tone="neutral" loading={!stats.benchAvailable} />
        <Stat
          label="Vs benchmark"
          value={stats.diff}
          tone={diffTone}
          loading={!stats.benchAvailable}
          help={`How your portfolio's return compares to the ${benchmarkLabel} over the selected period.`}/>
      </div>

      {takeaway(stats, benchmarkLabel) && (
        <div className="px-5 pt-3">
          <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
            {takeaway(stats, benchmarkLabel)}
          </p>
          {explanation && (
            <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {explanation}
            </p>)}
        </div>)}
      <div ref={chartContainerRef} className="relative h-[420px] p-5">
        {chartArea}
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <ContributionsChart series={visibleContributionSeries} />
      </div>
      </GlassPanel>
    </div>
  );};

/** @param {{ color: string, label: string, dashed?: boolean }} props */
const LegendDot = ({ color, label, dashed }) => {
  let marker;
  if (dashed) {
    marker = <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />;
  } else {
    marker = <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />;
  }

  return (
    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-ghost)' }}>
      {marker}
      {label}
    </div>
  );};

export default PerformanceVsBenchmark;