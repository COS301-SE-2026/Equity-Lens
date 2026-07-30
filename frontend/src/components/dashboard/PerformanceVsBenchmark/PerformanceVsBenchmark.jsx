import { useMemo, useState } from 'react';
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
import SecondaryButton from '../shared/SecondaryButton';
import { zar } from '../../../utils/currency';
import { formatShortCurrency } from '../../../utils/formatters';
import { buildChartStats, filterByRange, buildExplanation, classifyContext, buildDriver,
} from '../../../utils/dashboardInsights';

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
const PerfTooltip = ({ active, payload, label, benchmarkLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[11px] backdrop-blur-xl"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--glass-border)' }}>
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
            <span className="ml-auto font-semibold">R{Math.round(p.value).toLocaleString('en-ZA')}</span>
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

const CONTEXT_TONE = {
  normal: 'var(--text-ghost)',
  market: 'var(--signal-info)',
  sector: 'var(--signal-info)',
  company: 'var(--signal-info)',
  unusual: 'var(--signal-warning)',
};

/** @type {Partial<Record<'normal'|'market'|'sector'|'company'|'unusual', { label: string, target: string }>>} */
const CONTEXT_CTA = {
  sector: { label: 'Review Holdings', target: 'holdings-table' },
};

/**
 * @param {{
 *   label: string,
 *   row: { ticker: string, contribution: number } | null,
 *   holding: any,
 *   holdings: any[],
 *   anomalies: any[],
 *   onScrollTo?: (target: string) => void,
 *   emptyText: string,
 * }} props
 */
const MoveCard = ({ label, row, holding, holdings, anomalies, onScrollTo, emptyText }) => {
  if (!row || !holding) {
    return (
      <div className="rounded-lg p-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>{label}</div>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-ghost)' }}>{emptyText}</p>
      </div>
    );}

  const pos = row.contribution >= 0;

  let color;
  if (pos) {
    color = 'var(--signal-positive)';
  } else {
    color = 'var(--signal-negative)';
  }

  const contributionSign = pos ? '+' : '-';

  let changeSign;
  if (pos) {
    changeSign = '+';
  } else {
    changeSign = '';
  }

  const context = classifyContext({ holding, holdings, anomalies });
  /** @type {{ label: string, target?: string } | undefined} */
  let cta;
  if (context.level === 'unusual') {
    cta = { label: 'Ask AI Why' };
  } else {
    cta = CONTEXT_CTA[context.level];}

  let ctaButton = null;
  if (cta) {
    if (context.level === 'unusual') {
      ctaButton = (
        <SecondaryButton size="sm" to={`/ai?q=${encodeURIComponent(`Why did ${row.ticker} move today?`)}`}>
          {cta.label}
        </SecondaryButton>);
    } else {
      ctaButton = (
        <SecondaryButton size="sm" onClick={() => cta.target && onScrollTo?.(cta.target)}>
          {cta.label}
        </SecondaryButton>);}}

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>{label}</span>
        {holding.sector && (
          <span className="font-mono text-[9px]" style={{ color: 'var(--text-ghost)' }}>{holding.sector}</span>)}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-[14px] font-bold">{row.ticker}</span>
        <span className="font-mono text-[13px] font-semibold" style={{ color }}>
          {contributionSign}{zar(Math.abs(row.contribution))}
        </span>
        <span className="font-mono text-[11px]" style={{ color }}>
          ({changeSign}{(holding.daily_change_pct ?? 0).toFixed(1)}%)
        </span>
      </div>

      <div className="mt-2 rounded-md p-2" style={{ background: 'var(--surface-hover)' }}>
        <div className="font-mono text-[8px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>Context</div>
        <p className="mt-0.5 text-[10px] font-semibold leading-snug" style={{ color: CONTEXT_TONE[context.level] }}>
          {context.label}
        </p>
        <p className="text-[10px] leading-snug" style={{ color: 'var(--text-ghost)' }}>{context.detail}</p>
      </div>

      {ctaButton && <div className="mt-2">{ctaButton}</div>}
    </div>
  );};

/**
 * @param {{ driver: { text: string, tickers: string[] } | null }} props
 */
const DriverCard = ({ driver }) => {
  if (!driver) return null;
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderLeft: '3px solid var(--accent-primary)' }}>
      <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>Today&apos;s Driver</div>
      <p className="mt-2 text-[12px] leading-snug" style={{ color: 'var(--text-primary)' }}>{driver.text}</p>
    </div>
  );};

/**
 * @param {{
 *   holdings: any[],
 *   attribution: { contributors: any[], drags: any[], todayReturn: number },
 *   anomalies: any[],
 *   onScrollTo?: (target: string) => void,
 * }} props
 */
const TodaysMoves = ({ holdings, attribution, anomalies, onScrollTo }) => {
  if (!holdings.length) return null;
  /** @param {string} ticker */
  const findHolding = (ticker) => {
    return holdings.find((h) => h.ticker === ticker);
  };
  const gain = attribution.contributors[0] ?? null;
  const loss = attribution.drags[0] ?? null;
  const { driver } = buildDriver({ holdings, attribution });

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <MoveCard
        label="Today's Biggest Gain"
        row={gain}
        holding={gain && findHolding(gain.ticker)}
        holdings={holdings}
        anomalies={anomalies}
        onScrollTo={onScrollTo}
        emptyText="Nothing pushing your portfolio up today."
      />
      <MoveCard
        label="Today's Biggest Loss"
        row={loss}
        holding={loss && findHolding(loss.ticker)}
        holdings={holdings}
        anomalies={anomalies}
        onScrollTo={onScrollTo}
        emptyText="Nothing dragging your portfolio down today."
      />
      <DriverCard driver={driver} />
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
 *   anomalies?: {date:string, ticker:string, changePct:number, headline:string}[],
 *   attribution?: { contributors: any[], drags: any[], todayReturn: number },
 *   holdings?: any[],
 *   onScrollTo?: (target: string) => void,
 *   benchmarkLabel?: string,
 * }} props
 */
const PerformanceVsBenchmark = ({
  series,
  anomalies = [],
  attribution = { contributors: [], drags: [], todayReturn: 0 },
  holdings = [],
  onScrollTo,
  benchmarkLabel = 'JSE ALSI',
}) => {

  const [range, setRange] = useState(/** @type {RangeKey} */ ('ALL'));

  const { series: visibleSeries } = useMemo(() => {
    return filterByRange(series, range);
  }, [series, range]);

  const stats = useMemo(() => {
    return buildChartStats(visibleSeries);
  }, [visibleSeries]);

  const { explanation } = useMemo(() => {
    return buildExplanation({ stats, attribution, anomalies, visibleSeries });
  }, [stats, attribution, anomalies, visibleSeries]);

  // chart dots for anomaly events pulled as not feesible in time - will be a demo 3 thing

  /** @type {'good'|'bad'} */
  let portTone;
  if (stats.portReturn.startsWith('-')) {
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
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatShortCurrency}
          />
          <Tooltip content={<PerfTooltip benchmarkLabel={benchmarkLabel} />} />
          <Line type="monotone" dataKey="benchmark" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    );}

  return (
    <GlassPanel className="flex h-full flex-col">
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
        <Stat label="Portfolio return" value={stats.portReturn} tone={portTone} />
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
      <div className="h-[420px] p-5">{chartArea}</div>
      <TodaysMoves holdings={holdings} attribution={attribution} anomalies={anomalies} onScrollTo={onScrollTo} />
    </GlassPanel>
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