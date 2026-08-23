import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import { Search } from 'lucide-react';

import { GlassPanel } from '../shared/GlassPanel';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import MoneyAxisTick from '../shared/MoneyAxisTick';
import { zar } from '../../../utils/currency';
import { buildChartStats, filterByRange, buildExplanation, buildingHistoryLabel, buildPerformanceQuestions,
} from '../../../utils/dashboardInsights';
import { ROUTES } from '../../../utils/constants';
import ContributionsChart from '../ContributionsChart/ContributionsChart';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';

/** @typedef {'1D'|'1W'|'1M'|'3M'|'1Y'|'ALL'} RangeKey */
/** @type {RangeKey[]} */
const RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
const ANOMALY_NEUTRAL_BAND_PCT = 1;
const POPOVER_FLIP_THRESHOLD_PX = 110;

/** @param {number} changePct */
function anomalyColor(changePct) {
  if (changePct > ANOMALY_NEUTRAL_BAND_PCT) return 'var(--signal-positive)';
  if (changePct < -ANOMALY_NEUTRAL_BAND_PCT) return 'var(--signal-negative)';
  return 'var(--text-ghost)';}

/** @param {{date:string, ticker:string, changePct:number, headline:string}} anomaly */
function askAiAboutAnomaly(anomaly) {
  const direction = anomaly.changePct >= 0 ? 'gain' : 'drop';
  const sign = anomaly.changePct >= 0 ? '+' : '';
  return `Why did ${anomaly.ticker} move ${sign}${anomaly.changePct.toFixed(1)}% (${direction}) around ${anomaly.date}? News: "${anomaly.headline}"`;}

/**
 * @template T
 * @param {T | null} value
 * @returns {value is T}
 */
function isNotNull(value) {
  return value !== null;}

/**
 * @param {{ cx?: number, cy?: number, anomaly: any, onSelect: (anomaly: any, cx: number, cy: number) => void }} props
 */
const AnomalyMarker = ({ cx, cy, anomaly, onSelect }) => {
  if (cx === undefined || cx === null || cy === undefined || cy === null) return null;
  const color = anomalyColor(anomaly.changePct);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`News for ${anomaly.ticker} on ${anomaly.date}`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(anomaly, cx, cy);}}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(anomaly, cx, cy);
        }}}>
      <circle cx={cx} cy={cy} r={9} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={1.5} />
      <Search x={cx - 6} y={cy - 6} width={12} height={12} color={color} strokeWidth={2.5} />
    </g>
  );};

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
 *   anomalies?: {date:string, ticker:string, changePct:number, headline:string,
 *                articleId?:string|null, articleLink?:string|null,
 *                articleSource?:string|null}[],
 *   attribution?: { contributors: any[], drags: any[], todayReturn: number },
 *   benchmarkLabel?: string,
 *   historyDays?: number,
 * }} props
 */
const PerformanceVsBenchmark = ({
  series,
  contributionSeries = [],
  anomalies = [],
  attribution = { contributors: [], drags: [], todayReturn: 0 },
  benchmarkLabel = 'JSE ALSI',
  historyDays = 0,
}) => {
  const navigate = useNavigate();
  const [range, setRange] = useState(/** @type {RangeKey} */ ('ALL'));
  const [activeAnomaly, setActiveAnomaly] = useState(
  /** @type {{ anomaly: any, cx: number, cy: number } | null} */ (null));
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const popoverRef = useRef(null);
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

useEffect(() => {
  if (!activeAnomaly) return undefined;
  /** @param {MouseEvent} e */
  const handleClick = (e) => {
    if (popoverRef.current && !popoverRef.current.contains(/** @type {Node} */ (e.target))) {
      setActiveAnomaly(null);
    }};
  /** @param {KeyboardEvent} e */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setActiveAnomaly(null);};
  document.addEventListener('mousedown', handleClick);
  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('mousedown', handleClick);
    document.removeEventListener('keydown', handleKeyDown);
  };}, [activeAnomaly]);

  /**
 * @param {any} anomaly
 * @param {number} cx
 * @param {number} cy
 */
  const handleSelectAnomaly = useCallback(
  (/** @type {any} */ anomaly, /** @type {number} */ cx, /** @type {number} */ cy) => {
    setActiveAnomaly((current) => (current?.anomaly === anomaly ? null : { anomaly, cx, cy }));},[],);

  const { series: visibleSeries } = useMemo(() => {
    return filterByRange(series, range);
  }, [series, range]);

  const { series: visibleContributionSeries } = useMemo(() => {
    return filterByRange(contributionSeries, range);}, [contributionSeries, range]);

  const stats = useMemo(() => {
    return buildChartStats(visibleSeries, { historyDays });}, [visibleSeries, historyDays]);

  const { explanation } = useMemo(() => {
    return buildExplanation({ stats, attribution, anomalies, visibleSeries });
  }, [stats, attribution, anomalies, visibleSeries]);
    const visibleAnomalies = useMemo(() => {
      return anomalies.map((a) => {
          const point = visibleSeries.find((p) => p.date === a.date);
          return point ? { ...a, name: point.name, y: point.value } : null;})
        .filter(isNotNull);
    }, [anomalies, visibleSeries]);

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
          {visibleAnomalies.map((a) => (
            <ReferenceDot
              key={`${a.ticker}-${a.date}`}
              x={a.name}
              y={a.y}
              shape={(shapeProps) => <AnomalyMarker {...shapeProps} anomaly={a} onSelect={handleSelectAnomaly} />}
            />))}
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
        {activeAnomaly && ( <div className="pointer-events-none absolute inset-5">
            <div
              ref={popoverRef}
              role="menu"
              className="pointer-events-auto absolute z-20 w-60 rounded-xl p-1.5 shadow-lg"
              style={{ left: activeAnomaly.cx, top: activeAnomaly.cy, transform:
                  activeAnomaly.cy < POPOVER_FLIP_THRESHOLD_PX
                  ? 'translate(-50%, 14px)'
                  : 'translate(-50%, calc(-100% - 14px))',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',}}>
              <div className="px-2 pb-1.5 pt-1">
                <div
                  className="flex items-center gap-1.5 font-mono text-[10px] font-semibold"
                  style={{ color: anomalyColor(activeAnomaly.anomaly.changePct) }}>
                  <span>{activeAnomaly.anomaly.ticker}</span>
                  <span>
                    {activeAnomaly.anomaly.changePct >= 0 ? '+' : ''}
                    {activeAnomaly.anomaly.changePct.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {activeAnomaly.anomaly.headline}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const { articleId, articleLink } = activeAnomaly.anomaly;
                  const identifier = articleId || articleLink;
                  navigate(
                    identifier ? `${ROUTES.NEWS}?article=${encodeURIComponent(identifier)}`
                      : ROUTES.NEWS,);
                  setActiveAnomaly(null);}}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}>
                {activeAnomaly.anomaly.articleId || activeAnomaly.anomaly.articleLink
                  ? 'View article'
                  : 'View latest news'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  navigate(`${ROUTES.AI_CHAT}?q=${encodeURIComponent(askAiAboutAnomaly(activeAnomaly.anomaly))}`);
                  setActiveAnomaly(null);}}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-secondary)' }}>
                Ask AI to explain
              </button>
            </div>
          </div>
        )}</div>

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