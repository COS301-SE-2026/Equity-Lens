import { Settings } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import AnimatedReveal from '../shared/AnimatedReveal';
import CollapseToggle from '../shared/CollapseToggle';
import { GlassPanel } from '../shared/GlassPanel';
import HelpTooltip from '../../common/HelpTooltip/HelpTooltip';
import Money from '../../common/Money/Money';
import MoneyAxisTick from '../shared/MoneyAxisTick';
import CardErrorBoundary from '../../common/ErrorBoundary/CardErrorBoundary';
import { zar } from '../../../utils/currency';
import { buildChartStats, filterByRange, buildExplanation, buildingHistoryLabel, buildPerformanceQuestions,
  BENCHMARK_METHOD, benchmarkCompositionLines, shortBenchmarkLabel,
} from '../../../utils/dashboardInsights';
import { buildGroupSeries, rebaseBenchmarkToSlice, rebaseForRange } from '../../../utils/portfolioStats';
import { buildEventNarrative, longDate, rowLabel } from '../../../utils/eventNarrative';
import { getHoldingSeries } from '../../../services/portfolioService';
import ContributionsChart from '../ContributionsChart/ContributionsChart';
import CardMascotTrigger from '../../chat/CardMascotTrigger/CardMascotTrigger';
import HoldingSelector, {
  GROUP_DASH,
  MAX_HOLDINGS,
  MAX_SERIES_TICKERS,
  colourFor,
  groupColourFor,
} from './HoldingSelector';
import { loadGroups, resolveGroups, saveGroups } from './GroupBuilder';
import HistorySettingsModal, {
  historyCutoff,
  loadHistoryPref,
  saveHistoryPref,
} from './HistorySettingsModal';
import EventPopover from '../WhyDidItMove/WhyDidItMove';

/** @typedef {'1D'|'1W'|'1M'|'3M'|'1Y'|'ALL'} RangeKey */
/** @type {RangeKey[]} */
const RANGES = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
const MAX_DOTS = 8;
const DOT_RADIUS = 5;
const CHART_PAD = 20;
const POPOVER_GAP = 12;
const GROUP_METHOD_HELP =
  'A group line is a fixed-weight index. Each member\'s weight is what it was worth on the '
  + 'first day of the range - its quantity times its close that day - and those weights are then '
  + 'held for the whole range. Three things follow. You bought and sold over the period, so the '
  + 'quantities you actually held changed from day to day and a holding bought halfway through '
  + 'contributed nothing before you bought it. Your portfolio line is a time-weighted return, '
  + 'which chain-links across deposits and withdrawals so they do not read as growth, while a '
  + 'group line is a price index. And a day where any member has no price is left out of the '
  + 'group line entirely. A group of every holding will therefore track the portfolio line '
  + 'closely without sitting on it, and the gap between them is the effect of your buying and '
  + 'selling over the period.';


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
      className="rounded-lg px-3 py-2 font-mono text-[12px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}>
      <div className="mb-1 text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {rowLabel(label ?? '')}
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

/**
 * @param {{ active?: boolean, payload?: any[], label?: string, benchmarkLabel: string }} props
 */
export const IndexTooltip = ({ active, payload, label, benchmarkLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[12px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}>
      <div className="mb-1 text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {rowLabel(label ?? '')}
      </div>
      {payload.map((p) => {
        let who;
        if (p.dataKey === 'value') {
          who = 'you';
        } else if (p.dataKey === 'benchmark') {
          who = benchmarkLabel;
        } else {
          who = p.dataKey;
        }
        const move = typeof p.value === 'number' ? p.value - 100 : null;
        return (
          <div key={p.dataKey} className="flex items-center gap-3 py-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span style={{ color: 'var(--text-secondary)' }}>{who}</span>
            </span>
            <span className="ml-auto font-semibold" style={{ color: 'var(--text-primary)' }}>
              {move === null ? '-' : `${move >= 0 ? '+' : ''}${move.toFixed(1)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );};

/** @param {{ x?: number, y?: number, payload?: { value: number } }} props */
export const IndexAxisTick = ({ x, y, payload }) => (
  <text x={x} y={y} dy={3} textAnchor="end" fontSize={11} fontFamily="monospace" fill="var(--chart-axis-text)">
    {payload ? `${(payload.value - 100 >= 0 ? '+' : '') + (payload.value - 100).toFixed(0)}%` : ''}
  </text>
);

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
      <div className="flex items-center gap-1 font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
        {label}
        {help && <HelpTooltip text={help} />}
      </div>
      {valueDisplay}
    </div>
  );};

/**
 * @param {{ rows: any[], ticker: string, colour: string, label?: string }} props
 */
export const endMarker = ({ rows, ticker, colour, label }) => {
  const last = rows[rows.length - 1];
  const y = last?.[ticker];
  if (typeof y !== 'number') return null;

  return (
    <ReferenceDot
      key={`end-${ticker}`}
      x={last.date}
      y={y}
      r={3}
      fill={colour}
      stroke="none"
      isFront
      label={{ value: label ?? ticker, position: 'right', fontSize: 11, fontFamily: 'monospace', fill: colour }}
    />
  );
};

/**
 * @param {{ rows: any[], events: any }} args
 * @returns {{
 *   key: string,
 *   event: any,
 *   y: number,
 *   fill: string,
 *   stroke: string,
 *   strokeWidth: number,
 * }[]}
 */
export function eventDots({ rows, events }) {
  const byDate = new Map(rows.map((row) => [row.date, row]));

  /** @param {string} date */
  const yOn = (date) => {
    const y = byDate.get(date)?.value;
    return typeof y === 'number' ? y : null;
  };

  const holdingDots = (events?.events ?? [])
    .map((/** @type {any} */ event) => {
      const y = yOn(event.date);
      if (y === null) return null;

      const fill = event.direction === 'down'
        ? 'var(--signal-negative)'
        : 'var(--signal-positive)';

      return {
        key: `${event.ticker}:${event.date}`,
        event,
        y,
        fill,
        stroke: 'var(--surface-card)',
        strokeWidth: 1.5,
      };
    })
    .filter(Boolean);

  return holdingDots
    .sort((/** @type {any} */ a, /** @type {any} */ b) =>
      Math.abs(b.event.z_score ?? 0) - Math.abs(a.event.z_score ?? 0))
    .slice(0, MAX_DOTS);
}

/**
 * @param {{ events: any, loading: boolean, failed: boolean }} args
 * @returns {string|null}
 */
function markerNote({ events, loading, failed }) {
  if (failed) return 'Unusual-move markers are unavailable right now.';
  if (loading) return 'Looking for unusual moves...';
  if (!events) return null;
  if ((events.events ?? []).length > 0) {
    return 'Dots mark unusually large single-day moves. Click one for an explanation.';
  }

  const scanned = events.coverage?.holdings_scanned ?? 0;
  if (scanned === 0) return 'Not enough price history yet to look for unusual moves.';
  return `No unusual moves across ${scanned} holding${scanned === 1 ? '' : 's'} in the last year.`;
}

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
      className="rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors"
      style={{ background, color }}>
      {range}
    </button>
  );};

/**
 * @param {{
 *   at: { cx: number, cy: number },
 *   containerRef: React.MutableRefObject<HTMLDivElement | null>,
 *   children: React.ReactNode,
 * }} props
 */
const AnchoredPopover = ({ at, containerRef, children }) => {
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const cardRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (card) setSize({ width: card.offsetWidth, height: card.offsetHeight });
  }, [at, children]);

  const container = containerRef.current;
  const boxWidth = container?.clientWidth ?? 0;
  const boxHeight = container?.clientHeight ?? 0;
  const dotX = CHART_PAD + at.cx;
  const dotY = CHART_PAD + at.cy;

  const rightFits = dotX + POPOVER_GAP + size.width <= boxWidth - CHART_PAD;
  const leftFits = dotX - POPOVER_GAP - size.width >= CHART_PAD;
  let side = 'centre';
  if (rightFits) side = 'right';
  else if (leftFits) side = 'left';

  let left;
  if (side === 'right') left = dotX + POPOVER_GAP;
  else if (side === 'left') left = dotX - POPOVER_GAP - size.width;
  else left = Math.max(CHART_PAD, (boxWidth - size.width) / 2);

  const top = Math.min(
    Math.max(dotY - size.height / 2, CHART_PAD),
    Math.max(CHART_PAD, boxHeight - CHART_PAD - size.height),
  );
  const connector = side === 'centre' ? null : {
    left: side === 'right' ? dotX : left + size.width,
    width: side === 'right' ? left - dotX : dotX - (left + size.width),
  };

  return (
    <>
      {connector && connector.width > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20"
          style={{
            left: connector.left,
            top: dotY,
            width: connector.width,
            height: 1,
            background: 'var(--border-mid)',
          }} />
      )}
      <div
        ref={cardRef}
        className="absolute z-20 max-h-[calc(100%-2.5rem)] overflow-y-auto"
        style={{ left, top }}
      >
        {children}
      </div>
    </>
  );
};

/**
 * @param {{
 *   rows: any[],
 *   indexed: boolean,
 *   drawn: string[],
 *   selected: string[],
 *   benchmarkLabel: string,
 *   events?: any,
 *   onSelectEvent?: (event: any) => void,
 *   groups?: { id: string, name: string }[],
 * }} props
 */
const PerfChart = ({
  rows, indexed, drawn, selected, benchmarkLabel, events = null, onSelectEvent, groups = [],
}) => {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: 'var(--text-ghost)' }}>
        Performance history will appear once portfolio has sufficient data.
      </div>
    );
  }

  const dots = eventDots({ rows, events });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 24, right: indexed ? 52 : 5, bottom: 5, left: 5 }}>
        <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={rowLabel}
          stroke="var(--text-ghost)"
          tick={{ fontSize: 11, fontFamily: 'monospace' }}
          tickLine={false}
          axisLine={false}
          minTickGap={48}
        />
        <YAxis
          stroke="var(--text-ghost)"
          tick={indexed ? <IndexAxisTick /> : <MoneyAxisTick />}
          domain={indexed ? ['auto', 'auto'] : undefined}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={
            indexed
              ? <IndexTooltip benchmarkLabel={benchmarkLabel} />
              : <PerfTooltip benchmarkLabel={benchmarkLabel} />
          }
        />
        <Line type="monotone" dataKey="benchmark" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--accent-primary)"
          strokeWidth={indexed ? 1.5 : 2}
          strokeOpacity={indexed ? 0.45 : 1}
          dot={false}
          activeDot={{ r: 5, fill: 'var(--accent-primary)', stroke: 'var(--surface-card)', strokeWidth: 2 }} />
        {indexed && drawn.map((ticker) => (
          <Line
            key={ticker}
            type="monotone"
            dataKey={ticker}
            stroke={colourFor(selected, ticker)}
            strokeWidth={2.5}
            dot={false}
            connectNulls
            activeDot={{ r: 5 }} />
        ))}
        {indexed && drawn.map((ticker) =>
          endMarker({ rows, ticker, colour: colourFor(selected, ticker) }))}
        {/* dashed, on a pattern the benchmark does not use - the token palette has no sixth
            hue left, so a group is told apart by its stroke and its end label */}
        {groups.map((group) => (
          <Line
            key={group.id}
            type="monotone"
            dataKey={group.id}
            stroke={groupColourFor(groups, group.id)}
            strokeWidth={2.5}
            strokeDasharray={GROUP_DASH}
            dot={false}
            connectNulls
            activeDot={{ r: 5 }} />
        ))}
        {groups.map((group) =>
          endMarker({ rows, ticker: group.id, colour: groupColourFor(groups, group.id),
            label: group.name }))}
        {dots.map((dot) => {
          const { key, event, y, fill, stroke, strokeWidth } = dot;
          const open = (/** @type {{ cx: number, cy: number }} */ at) =>
            onSelectEvent?.({ ...dot, at });
          return (
          <ReferenceDot
            key={key}
            x={event.date}
            y={y}
            r={DOT_RADIUS}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            isFront
            shape={(/** @type {any} */ props) => (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={DOT_RADIUS}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                role="button"
                tabIndex={0}
                aria-label={buildEventNarrative(event, null).headline}
                style={{ cursor: 'pointer' }}
                onClick={() => open({ cx: props.cx, cy: props.cy })}
                onKeyDown={(/** @type {any} */ e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open({ cx: props.cx, cy: props.cy });
                  }
                }}
              />
            )}
          />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
};
/** @param {string | undefined} ticker @param {{ ticker: string, value: number }[]} holdings */
const holdingWeightPct = (ticker, holdings) => {
  if (!ticker) return null;
  const upper = ticker.toUpperCase();
  const bookValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const held = holdings.find((h) => (h.ticker ?? '').toUpperCase() === upper);
  return held && bookValue ? (held.value / bookValue) * 100 : null;
};

/**
 * @param {{
 *   series: {date:string, name:string, value:number, benchmark?:number, twr_index?:number}[],
 *   contributionSeries?: {date:string, name:string, portfolio_value:number, cumulative_net_contributions:number, cumulative_market_gain:number}[],
 *   attribution?: { contributors: any[], drags: any[], todayReturn: number },
 *   benchmarkLabel?: string,
 *   historyDays?: number,
 *   holdings?: { ticker: string, name?: string, value: number }[],
 *   events?: any,
 *   eventsLoading?: boolean,
 *   eventsFailed?: boolean,
 *   eventDetails?: Record<string, any>,
 *   eventPendingKey?: string|null,
 *   onExpandEvent?: (ticker: string, date: string) => void,
 *   onAskAboutEvent?: (question: string) => void,
 *   importedAt?: string|null,
 *   benchmarkComposition?: { region: string, label: string, weight: number }[],
 *   historyQuality?: any,
 * }} props
 */
const PerformanceVsBenchmark = ({
  series,
  contributionSeries = [],
  attribution = { contributors: [], drags: [], todayReturn: 0 },
  benchmarkLabel = 'JSE ALSI',
  historyDays = 0,
  holdings = [],
  events = null,
  eventsLoading = false,
  eventsFailed = false,
  eventDetails = {},
  eventPendingKey = null,
  onExpandEvent,
  onAskAboutEvent,
  importedAt = null,
  benchmarkComposition = [],
  historyQuality = null,
}) => {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const [range, setRange] = useState(/** @type {RangeKey} */ ('ALL'));
  const [selected, setSelected] = useState(/** @type {string[]} */ ([]));
  const [openEvent, setOpenEvent] = useState(/** @type {any} */ (null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyPref, setHistoryPref] = useState(loadHistoryPref);
  const [groups, setGroups] = useState(loadGroups);
  const [holdingSeries, setHoldingSeries] = useState(/** @type {any[]} */ ([]));
  /** @type {React.MutableRefObject<HTMLDivElement | null>} */
  const chartContainerRef = useRef(null);
  const lastStepAtRef = useRef(0);
  const STEP_COOLDOWN_MS = 250;
  /** @param {WheelEvent} event */
  const handleWheelZoom = useCallback((/** @type {WheelEvent} */ event) => {
  if (!event.ctrlKey && !event.metaKey) return;
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

  const seriesPeriod = useMemo(() => {
    if (historyDays > 700) return '5y';
    if (historyDays > 300) return '2y';
    return '1y';
  }, [historyDays]);

  const resolvedGroups = useMemo(
    () => resolveGroups(groups, holdings).filter((g) => g.members.length > 0),
    [groups, holdings],
  );

  const { wanted, droppedTickers } = useMemo(() => {
    const members = resolvedGroups.flatMap((g) => g.members.map((m) => m.ticker));
    const union = [...new Set([...members, ...selected])];
    return {
      wanted: union.slice(0, MAX_SERIES_TICKERS),
      droppedTickers: union.slice(MAX_SERIES_TICKERS),
    };
  }, [resolvedGroups, selected]);

  const wantedKey = wanted.join(',');

  useEffect(() => {
    if (wanted.length === 0) {
      setHoldingSeries([]);
      return undefined;
    }
    let cancelled = false;
    getHoldingSeries(wanted, seriesPeriod)
      .then((data) => {
        if (!cancelled) setHoldingSeries(data.series ?? []);
      })
      .catch((err) => {
        console.warn('holding series fetch failed:', err);
        if (!cancelled) setHoldingSeries([]);
      });
    return () => { cancelled = true; };
  }, [wantedKey, seriesPeriod]);

  const cutoff = historyCutoff(historyPref, importedAt);
  const chosenSeries = useMemo(
    () => (cutoff ? series.filter((point) => point.date >= cutoff) : series),
    [series, cutoff],
  );

  const visibleSeries = useMemo(
    () => rebaseBenchmarkToSlice(filterByRange(chosenSeries, range).series),
    [chosenSeries, range],
  );

  const individualSeries = useMemo(
    () => holdingSeries.filter((/** @type {any} */ h) => selected.includes(h.ticker)),
    [holdingSeries, selected],
  );

  const rebased = useMemo(
    () => rebaseForRange(visibleSeries, individualSeries),
    [visibleSeries, individualSeries],
  );

  const groupLines = useMemo(
    () => buildGroupSeries(visibleSeries, holdingSeries, resolvedGroups),
    [visibleSeries, holdingSeries, resolvedGroups],
  );

  const chartRows = useMemo(() => {
    if (groupLines.drawn.length === 0) return rebased.rows;
    return rebased.rows.map((row, i) => {
      const merged = { ...row };
      for (const id of groupLines.drawn) merged[id] = groupLines.columns[id][i];
      return merged;
    });
  }, [rebased.rows, groupLines]);

  const drawnGroups = resolvedGroups.filter((g) => groupLines.drawn.includes(g.id));
  const indexed = selected.length > 0 || drawnGroups.length > 0;

  const undrawnNames = [
    ...rebased.undrawn,
    ...resolvedGroups.flatMap((g) =>
      (groupLines.undrawn[g.id] ?? []).map((t) => `${t} (${g.name})`)),
  ];

  const toggleHolding = useCallback((/** @type {string} */ ticker) => {
    setSelected((current) => {
      if (current.includes(ticker)) return current.filter((t) => t !== ticker);
      return current.length >= MAX_HOLDINGS ? current : [...current, ticker];
    });
  }, []);

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


  const selectEvent = (/** @type {any} */ dot) => {
    setOpenEvent(dot);
    onExpandEvent?.(dot.event.ticker, dot.event.date);
  };

  const openKey = openEvent ? `${openEvent.event.ticker}:${openEvent.event.date}` : null;
  const eventWeightPct = holdingWeightPct(openEvent?.event?.ticker, holdings);

  const tooShortToPlot = chosenSeries.length < 2;

  const chartArea = tooShortToPlot ? (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {buildingHistoryLabel(chosenSeries.length)}
      </p>
      <p className="text-[12px]" style={{ color: 'var(--text-ghost)' }}>
        {historyPref.source === 'imported' ? (
          <>
            You are plotting only what we recorded ourselves
            {importedAt ? `, which starts on ${longDate(importedAt)}` : ''}. Turn the
            reconstruction back on in the history settings to see further back.
          </>
        ) : (
          <>
            We are still rebuilding your history from your transactions and the closing prices
            we hold for them. It fills in as more of your holdings can be priced further back.
          </>
        )}
      </p>
    </div>
  ) : (
    <PerfChart
      groups={drawnGroups}
      rows={indexed ? chartRows : visibleSeries}
      indexed={indexed}
      drawn={rebased.drawn}
      selected={selected}
      benchmarkLabel={benchmarkLabel}
      events={events}
      onSelectEvent={selectEvent} />
  );

  const benchmarkHelp = [...benchmarkCompositionLines(benchmarkComposition), BENCHMARK_METHOD]
    .join('\n');

  const groupWeightCaption = drawnGroups.some((g) => groupLines.weightBasis[g.id] === 'current')
    ? 'Groups are weighted by what each holding is worth today, held constant across the range.'
    : 'Groups are weighted by what each holding was worth on the first day of the range.';

  const note = markerNote({ events, loading: eventsLoading, failed: eventsFailed });
  const hasDots = eventDots({ rows: indexed ? chartRows : visibleSeries, events }).length > 0;
  const showsReconstructed =
    historyPref.source === 'reconstructed'
    && Boolean(importedAt)
    && visibleSeries.some((point) => point.date < /** @type {string} */ (importedAt));

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
        <div className="font-mono text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          Performance vs Benchmark
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-5 font-mono text-[11px]">
            <LegendKey color="var(--accent-primary)" label="Portfolio" variant="line" />
            <span className="flex items-center gap-1">
              <LegendKey
                color="var(--text-secondary)"
                label={shortBenchmarkLabel(benchmarkComposition, benchmarkLabel)}
                variant="dashed" />
              <HelpTooltip text={benchmarkHelp} />
            </span>
            {hasDots && (
              <>
                <LegendKey color="var(--signal-negative)" label="Unusual fall" variant="dot" />
                <LegendKey color="var(--signal-positive)" label="Unusual rise" variant="dot" />
              </>
            )}
          </div>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            Ctrl + scroll to zoom
          </span>
          <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--surface-raised)' }}>
            {RANGES.map((r) => {
              return <RangeButton key={r} range={r} active={range === r} onClick={() => setRange(r)} />;
            })}
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Performance history settings"
            className="pressable flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--surface-hover)]"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <Settings size={14} />
          </button>
          <CollapseToggle
            open={open}
            onToggle={() => setOpen((wasOpen) => !wasOpen)}
            controls={bodyId}
            label="performance vs benchmark"/>
        </div>
      </div>

      <div id={bodyId}>
      <AnimatedReveal show={open}>

      <div className="flex items-start gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="min-w-0 flex-1">
          <HoldingSelector
            holdings={holdings}
            selected={selected}
            onToggle={toggleHolding}
            groups={groups}
            onGroupsChange={(next) => { setGroups(next); saveGroups(next); }}
            drawnGroups={drawnGroups}
          />
        </div>

        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
        <AnimatedReveal show={selected.length > 0}>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="pressable rounded-md px-2 py-1 font-mono text-[11px]"
            style={{ color: 'var(--text-ghost)' }}
          >
            Clear
          </button>
        </AnimatedReveal>
       
        <AnimatedReveal show={indexed}>
          <div className="flex items-center gap-1 font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            Indexed to 100 at {rebased.baseDate}
            <HelpTooltip text="Every line starts level at the beginning of the selected range, so what you are comparing is the shape of the move rather than the size of the position. The portfolio line is its time-weighted index, so a deposit does not read as a gain." />
          </div>
        </AnimatedReveal>
        <AnimatedReveal show={indexed && undrawnNames.length > 0}>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            No cached price history for {undrawnNames.join(', ')}
          </span>
        </AnimatedReveal>
        <AnimatedReveal show={droppedTickers.length > 0}>
          <span className="font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            {droppedTickers.join(', ')} not drawn - {MAX_SERIES_TICKERS} series at a time
          </span>
        </AnimatedReveal>
        <AnimatedReveal show={drawnGroups.length > 0}>
          <div className="flex items-center gap-1 font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
            {groupWeightCaption}
            <HelpTooltip text={GROUP_METHOD_HELP} />
          </div>
        </AnimatedReveal>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <Stat label="Portfolio return" value={stats.portAvailable ? stats.portReturn : buildingHistoryLabel(stats.historyDays)} tone={portTone} help="Time-weighted return - how the money grew while it was invested, with purchases and sales taken back out, so it can be fairly compared to an index."/>
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
            <p className="mt-1 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {explanation}
            </p>)}
        </div>)}
      <div ref={chartContainerRef} className="relative h-[420px] p-5">
        {chartArea}
        {openEvent && (
          <AnchoredPopover at={openEvent.at ?? { cx: 0, cy: 0 }} containerRef={chartContainerRef}>
            <CardErrorBoundary label="Why did my money move?">
              <EventPopover
                event={openEvent.event}
                detail={openKey ? eventDetails[openKey] : null}
                pending={Boolean(openKey) && eventPendingKey === openKey}
                weightPct={eventWeightPct}
                onClose={() => setOpenEvent(null)}
                onAsk={onAskAboutEvent}
              />
            </CardErrorBoundary>
          </AnchoredPopover>
        )}
      </div>

      {showsReconstructed && (
        <div className="flex items-center gap-1 px-5 pb-1 font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
          Values before {longDate(/** @type {string} */ (importedAt))} are reconstructed from your statement.
          <HelpTooltip text="Before you uploaded, your value each day is worked out backwards from the transactions on your statement and the closing prices we have cached. It assumes the statement's transaction list is complete, carries the last known price across days it has no price for, cannot see a position you opened and closed before the statement period, and does not adjust for corporate actions." />
        </div>
      )}

      {note && (
        <div className="px-5 pb-3 font-mono text-[11px]" style={{ color: 'var(--text-ghost)' }}>
          {note}
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <ContributionsChart series={visibleContributionSeries} />
      </div>
      </AnimatedReveal>
      </div>
      </GlassPanel>

      <HistorySettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        pref={historyPref}
        onChange={(next) => {
          setHistoryPref(next);
          saveHistoryPref(next);
        }}
        importedAt={importedAt}
        historyQuality={historyQuality}
      />
    </div>
  );};

/**

 * @param {{ color: string, label: string, variant?: 'line'|'dashed'|'dot' }} props
 */
const LegendKey = ({ color, label, variant = 'line' }) => {
  let marker;
  if (variant === 'dashed') {
    marker = <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />;
  } else if (variant === 'dot') {
    marker = <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />;
  } else {
    marker = <span className="h-0 w-4 border-t-2" style={{ borderColor: color }} />;
  }

  return (
    <div className="flex items-center gap-1.5" style={{ color: 'var(--text-ghost)' }}>
      {marker}
      {label}
    </div>
  );};

export default PerformanceVsBenchmark;