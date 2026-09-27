import { zar } from './currency';
import { POOR_DIVERSIFICATION_COUNT, SEVERITY_RANK, TEMPLATES } from './insightTemplates';
import { dailyReturnsFromIndex, seriesKey } from './portfolioStats';

/** @param {any} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const CONCENTRATION_LOW = 25;
const CONCENTRATION_HIGH = 45;
const RANGE = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
const NOTABLE_BENCHMARK_GAP_PCT = 2;
const PERFORMANCE_BADGE = 'Performance';
const NOTABLE_DAILY_MOVE_PCT = 1;
const DRIVER_LIM = 0.5;
const MOVE_LIM = 5;
const MARKET_WIDE_BREADTH = 0.6;

/**
 * @param {any[]} holdings
 * @returns {{ sectors: { name: string, value: number }[] }} sector name -> % of portfolio, sorted desc
 */
export function buildSectors(holdings) {
  const total = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);
  if (!holdings.length || total === 0) {
    return { sectors: [] };
  }

  /** @type {Record<string, number>} */
  const buckets = {};
  for (const h of holdings) {
    const sector = h.sector ?? 'Other';
    buckets[sector] = (buckets[sector] ?? 0) + (h.value ?? 0);
  }

  return {
    sectors: Object.entries(buckets)
      .map(([name, val]) => ({ name, value: (val / total) * 100 }))
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * @param {any} holding
 */
const isFund = (holding) => holding?.kind === 'etf';

/**
 * @param {number} pct
 * @param {{ low: number, high: number }} [thresholds]
 */
export function getConcRisk(
  pct,
  thresholds = { low: CONCENTRATION_LOW, high: CONCENTRATION_HIGH },
) {
  if (pct < thresholds.low) return { level: 'low', label: 'Low', color: 'var(--signal-positive)' };
  if (pct < thresholds.high)
    return { level: 'moderate', label: 'Moderate', color: 'var(--signal-warning)' };
  return { level: 'high', label: 'High', color: 'var(--signal-negative)' };
}

/**
 * @param {any[]} holdings
 * @returns {{ topHolding: any, topPct: number }}
 */
function getTopHolding(holdings) {
  const totalVal = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const topHolding = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const topPct = totalVal ? ((topHolding?.value ?? 0) / totalVal) * 100 : 0;
  return { topHolding, topPct };
}

/** @param {number} days */
export const buildingHistoryLabel = (days) =>
  `Building history - ${days} day${days === 1 ? '' : 's'} so far`;

/**
 * @typedef {{ region: string, label: string, weight: number }} BenchmarkComponent
 */
/**
 * @param {BenchmarkComponent[]} composition
 * @param {string} fullLabel
 */
export const shortBenchmarkLabel = (composition, fullLabel) => {
  const parts = composition ?? [];
  if (parts.length < 2) return fullLabel;
  const biggest = [...parts].sort((a, b) => b.weight - a.weight)[0];
  return `${biggest.label} + ${parts.length - 1} more`;
};

/** @param {BenchmarkComponent[]} composition */
export const benchmarkCompositionLines = (composition) =>
  [...(composition ?? [])]
    .sort((a, b) => b.weight - a.weight)
    .map((c) => `${c.label} - ${c.weight}% of your book`);

export const BENCHMARK_METHOD =
  "Each region's index is converted to rand at that day's exchange rate, blended by that " +
  "region's share of your book, then rebased to what your portfolio was worth on the first " +
  'day of the series.';
/**
 * @template {{ date: string }} T
 * @param {T[]} series
 * @param {keyof typeof RANGE | 'ALL'} range
 * @returns {{ series: T[] }}
 */
export function filterByRange(series, range) {
  if (range === 'ALL' || !RANGE[range]) return { series };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE[range]);
  cutoff.setHours(0, 0, 0, 0);
  const filtered = series.filter((p) => p.date && new Date(p.date) >= cutoff);
  return { series: filtered.length >= 2 ? filtered : series.slice(-2) };
}

/**
 * @param {{ name: string, value: number, benchmark?: number, twr_index?: number }[]} series
 * @param {{ historyDays?: number }} [meta]
 */
export function buildChartStats(series, meta = {}) {
  const { historyDays = 0 } = meta;

  if (!series.length) {
    return {
      portReturn: '-',
      portAvailable: false,
      historyDays,
      benchReturn: '-',
      diff: '-',
      diffPct: 0,
      bestDay: '-',
      worstDay: '-',
      benchAvailable: false,
    };
  }

  const portKey = /** @type {'value'|'benchmark'|'twr_index'} */ (seriesKey(series));

  /** @param {'value'|'benchmark'|'twr_index'} field @param {number} from */
  const legReturn = (field, from) => {
    const points = series.slice(from).filter((p) => typeof p[field] === 'number');
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last || first === last || !first[field] || !last[field]) return null;
    return ((last[field] - first[field]) / first[field]) * 100;
  };

  const shared = series.findIndex(
    (p) => typeof p[portKey] === 'number' && typeof p.benchmark === 'number',
  );
  const portPct = legReturn(portKey, shared === -1 ? 0 : shared);
  const benchPct = shared === -1 ? null : legReturn('benchmark', shared);
  const portAvailable = portPct !== null;
  const benchAvailable = benchPct !== null && portAvailable;
  const diffPct = benchAvailable ? portPct - benchPct : 0;

  let best = { pct: -Infinity, name: '' };
  let worst = { pct: Infinity, name: '' };

  for (let i = 1; i < series.length; i++) {
    const returns = dailyReturnsFromIndex(series.slice(i - 1, i + 1), portKey);
    if (!returns) continue;
    const pct = returns[0] * 100;
    if (pct > best.pct) best = { pct, name: series[i].name };
    if (pct < worst.pct) worst = { pct, name: series[i].name };
  }

  /** @param {number} pct */
  const fmt = (pct) => `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

  return {
    portReturn: portAvailable ? fmt(portPct) : '-',
    portAvailable,
    historyDays,
    benchReturn: benchAvailable ? fmt(benchPct) : '-',
    diff: benchAvailable ? fmt(diffPct) : '-',
    diffPct,
    bestDay: best.pct === -Infinity ? '-' : `${fmt(best.pct)} · ${best.name}`,
    worstDay: worst.pct === Infinity ? '-' : `${fmt(worst.pct)} · ${worst.name}`,
    benchAvailable,
  };
}

/**
 * @param {any[]} holdings
 */
export function buildAttrib(holdings) {
  const priced = holdings.filter((h) => num(h.daily_change_pct) !== null);
  const rows = priced.map((h) => ({
    ticker: h.ticker,
    contribution: ((num(h.value) ?? 0) * h.daily_change_pct) / 100,
  }));
  const contributors = rows
    .filter((r) => r.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const drags = rows
    .filter((r) => r.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution);
  const todayReturn = rows.reduce((s, r) => s + r.contribution, 0);
  return { contributors, drags, todayReturn, excluded: holdings.length - priced.length };
}

/**
 * @param {{ holdings: any[], attribution: { contributors: any[], drags: any[], todayReturn: number } }} ctx
 */
function dailyRecords({ holdings, attribution }) {
  const hasLiveMove = holdings.some(
    (/** @type {any} */ h) => h.daily_change_pct !== null && h.daily_change_pct !== undefined,
  );
  if (!hasLiveMove) return [];

  /** @param {string} ticker */
  const findHolding = (ticker) => holdings.find((h) => h.ticker === ticker);

  /** @param {{ ticker: string, contribution: number }} row */
  const rowAction = (row) => {
    const holding = findHolding(row.ticker);
    if (!holding) return null;
    const context = classifyContext({ holding, holdings });
    if (!context) return null;
    if (context.level === 'unusual') {
      return askAiWhy(`Why did ${row.ticker} move today?`);
    }
    if (context.level === 'sector') {
      return { label: 'Review Holdings', target: 'holdings-table' };
    }
    return null;
  };
  const records = [];

  const gain = attribution.contributors[0];
  const gainHolding = gain && findHolding(gain.ticker);
  if (gain && gainHolding) {
    const movePct = gainHolding.daily_change_pct ?? 0;
    records.push({
      id: 'daily.gainer',
      category: 'daily',
      severity: 'opportunity',
      magnitude: Math.min(1, Math.abs(movePct) / 10),
      type: 'gain',
      text: `${gain.ticker} is today's biggest gainer, up ${movePct.toFixed(1)}% (+${zar(Math.abs(gain.contribution))}).`,
      why: classifyContext({ holding: gainHolding, holdings })?.detail,
      evidence: [
        { label: gain.ticker, value: `+${movePct.toFixed(1)}%` },
        { label: "Added to today's move", value: zar(Math.abs(gain.contribution)) },
      ],
      action: rowAction(gain),
    });
  }

  const loss = attribution.drags[0];
  const lossHolding = loss && findHolding(loss.ticker);
  if (loss && lossHolding) {
    const movePct = Math.abs(lossHolding.daily_change_pct ?? 0);
    records.push({
      id: 'daily.drag',
      category: 'daily',
      severity: 'risk',
      magnitude: Math.min(1, movePct / 10),
      type: 'loss',
      text: `${loss.ticker} is today's biggest drag, down ${movePct.toFixed(1)}% (-${zar(Math.abs(loss.contribution))}).`,
      why: classifyContext({ holding: lossHolding, holdings })?.detail,
      evidence: [
        { label: loss.ticker, value: `-${movePct.toFixed(1)}%` },
        { label: "Took off today's move", value: zar(Math.abs(loss.contribution)) },
      ],
      action: rowAction(loss),
    });
  }

  const { driver } = buildDriver({ holdings, attribution });
  if (driver) {
    records.push({
      id: 'daily.driver',
      category: 'daily',
      severity: 'neutral',
      magnitude: 0.5,
      type: 'driver',
      text: driver.text,
      why: "Ranked by each holding's Rand contribution to today's move, not long-term gain or sector weight.",
      evidence: [
        {
          label: "Today's move",
          value: `${attribution.todayReturn >= 0 ? '+' : ''}${zar(attribution.todayReturn ?? 0)}`,
        },
        ...(driver.tickers.length
          ? [{ label: 'Driven by', value: driver.tickers.join(', ') }]
          : []),
      ],
      action: null,
    });
  }

  return records;
}
const VISIBLE_INSIGHTS = 8;
const PER_CATEGORY_CAP = 2;
/** @type {Record<string, number>} */
const CATEGORY_CAP = { daily: 3 };

/**
 * @param {{
 *   holdings: any[],
 *   attribution: { contributors: { ticker: string, contribution: number }[], drags: { ticker: string, contribution: number }[], todayReturn: number },
 *   sectorData?: { name: string, value: number }[],
 *   sectorAllocation?: any[],
 *   returns?: any,
 *   health?: any,
 *   thresholds?: any,
 *   perfSeries?: any[],
 *   contributionSeries?: any[],
 *   cgt?: any,
 *   statementDate?: string | null,
 *   accountType?: string | null,
 *   benchmarkLabel?: string,
 *   events?: any,
 *   eventStudy?: any,
 * }} args
 * @returns {{ insights: any[], more: any[] }}
 */
export function buildInsights({ holdings, attribution, sectorData = [], ...rest }) {
  if (!holdings.length) return { insights: [], more: [] };

  const ctx = { holdings, attribution, sectorData, ...rest };
  const candidates = [...TEMPLATES.map((t) => t.build(ctx)), ...dailyRecords(ctx)].filter(Boolean);

  candidates.sort(
    (/** @type {any} */ a, /** @type {any} */ b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.magnitude - a.magnitude,
  );

  /** @type {Record<string, number>} */
  const seen = {};
  const ranked = candidates.filter((/** @type {any} */ r) => {
    const cap = CATEGORY_CAP[r.category] ?? PER_CATEGORY_CAP;
    seen[r.category] = (seen[r.category] ?? 0) + 1;
    return seen[r.category] <= cap;
  });

  const withAsk = ranked.map((/** @type {any} */ r) => {
    const own = r.action ? [r.action] : [];
    return {
      ...r,
      actions: own.some((/** @type {any} */ a) => a.question)
        ? own
        : [...own, askAiWhy(`${r.text} Why does this matter for my portfolio?`)],
    };
  });

  return { insights: withAsk.slice(0, VISIBLE_INSIGHTS), more: withAsk.slice(VISIBLE_INSIGHTS) };
}

/** @param {string} question */
export const askAiWhy = (question) => ({
  label: 'Ask AI Why',
  question,
  to: `/ai?q=${encodeURIComponent(question)}`,
});

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   attribution: { contributors: any[], drags: any[] },
 *   chartStats: { diff: string, diffPct: number, benchAvailable: boolean },
 *   dailyChangePct: number,
 *   benchmarkLabel?: string,
 *   thresholds?: { low: number, high: number },
 * }} args
 * @returns {{
 *   headline: string,
 *   supportingText: string[],
 *   severity: 'risk'|'opportunity'|'neutral',
 *   badge: string,
 *   suggestedActions: { label: string, to?: string, target?: string, question?: string }[],
 *   benchmark: { available: boolean, diffPct: number, label: string } | null,
 *   signals: { id: string, rank: number, severity: 'risk'|'opportunity'|'neutral', badge: string, text: string, actions: { label: string, to?: string, target?: string, question?: string }[] }[],
 * }}
 */
export function buildSummary({
  holdings,
  sectorData,
  attribution,
  chartStats,
  dailyChangePct,
  benchmarkLabel = 'JSE ALSI',
  thresholds,
}) {
  if (!holdings.length) {
    return {
      headline: 'Import a portfolio to see your executive summary.',
      supportingText: [],
      severity: 'neutral',
      badge: 'Overview',
      suggestedActions: [{ label: 'Import Portfolio', to: '/portfolio' }],
      benchmark: null,
      signals: [],
    };
  }

  const topSector = sectorData[0] ?? { name: 'None', value: 0 };
  const { topHolding, topPct } = getTopHolding(holdings);
  const sectorRisk = getConcRisk(topSector.value, thresholds);
  const holdingRisk = getConcRisk(topPct, thresholds);
  const diffPct = chartStats.diffPct ?? 0;
  const positive = dailyChangePct >= 0;
  const driver = positive ? attribution.contributors[0] : attribution.drags[0];
  /** @type {{ id: string, rank: number, severity: 'risk'|'opportunity'|'neutral', badge: string, text: string, actions: { label: string, to?: string, target?: string, question?: string }[] }[]} */
  const signals = [];

  if (holdingRisk.level === 'high') {
    signals.push({
      id: 'conc.top-holding',
      rank: 1,
      severity: 'risk',
      badge: 'Concentration',
      text: isFund(topHolding)
        ? `${topPct.toFixed(0)}% of your portfolio sits in one fund, ${topHolding.ticker}, concentrating you in ${topHolding.sector || topHolding.region || 'a single market'}.`
        : `${topPct.toFixed(0)}% of your portfolio is in ${topHolding.ticker}, making it your biggest source of risk.`,
      actions: [
        { label: 'View Holdings', target: 'holdings-table' },
        askAiWhy(`Why is my ${topHolding.ticker} concentration considered a risk?`),
      ],
    });
  }

  if (sectorRisk.level === 'high') {
    signals.push({
      id: 'sector.largest',
      rank: 2,
      severity: 'risk',
      badge: 'Concentration',
      text: `${topSector.value.toFixed(0)}% of your book is in ${topSector.name}, adding sector concentration risk.`,
      actions: [
        { label: 'Explore Sector Allocation', target: 'sector-allocation' },
        askAiWhy(`Why is my ${topSector.name} concentration considered a risk?`),
      ],
    });
  }

  if (holdings.length <= POOR_DIVERSIFICATION_COUNT) {
    signals.push({
      id: 'conc.position-count',
      rank: 3,
      severity: 'risk',
      badge: 'Diversification',
      text: `Only ${holdings.length} position${holdings.length === 1 ? ' makes' : 's make'} up your entire book.`,
      actions: [{ label: 'Review Diversification', to: '/portfolio' }],
    });
  }

  if (chartStats.benchAvailable && diffPct <= -NOTABLE_BENCHMARK_GAP_PCT) {
    signals.push({
      id: 'perf.behind-benchmark',
      rank: 4,
      severity: 'risk',
      badge: PERFORMANCE_BADGE,
      text: `You're underperforming the ${benchmarkLabel} by ${Math.abs(diffPct).toFixed(1)}%.`,
      actions: [{ label: 'Compare Against Benchmark', target: 'performance-vs-benchmark' }],
    });
  }

  if (chartStats.benchAvailable && diffPct >= NOTABLE_BENCHMARK_GAP_PCT) {
    signals.push({
      id: 'perf.ahead-of-benchmark',
      rank: 5,
      severity: 'opportunity',
      badge: PERFORMANCE_BADGE,
      text: `You're outperforming the ${benchmarkLabel} by ${diffPct.toFixed(1)}%.`,
      actions: [{ label: 'Compare Against Benchmark', target: 'performance-vs-benchmark' }],
    });
  }

  if (Math.abs(dailyChangePct) >= NOTABLE_DAILY_MOVE_PCT && driver) {
    const holding = holdings.find((h) => h.ticker === driver.ticker);
    const sector = holding?.sector ? ` in ${holding.sector}` : '';
    signals.push({
      id: 'daily.driver',
      rank: 6,
      severity: 'neutral',
      badge: 'Market',
      text: `${driver.ticker}${sector} is driving most of today's ${positive ? 'gain' : 'decline'} - you're ${positive ? 'up' : 'down'} ${Math.abs(dailyChangePct).toFixed(1)}% overall.`,
      actions: [
        { label: 'Read Related News', target: 'correlated-news' },
        askAiWhy(`Why did ${driver.ticker} move my portfolio today?`),
      ],
    });
  }

  signals.sort((a, b) => a.rank - b.rank);

  const benchmark = {
    available: Boolean(chartStats.benchAvailable),
    diffPct,
    label: benchmarkLabel,
  };
  const headlineSignals = signals.filter((s) => s.badge !== PERFORMANCE_BADGE);

  if (headlineSignals.length === 0) {
    return {
      headline: `Your holdings are well diversified, no company is more than ${topPct.toFixed(0)}% of your book.`,
      supportingText:
        chartStats.benchAvailable && signals.length === 0
          ? [
              `Performance is tracking the ${benchmarkLabel} closely (${chartStats.diff} this period).`,
            ]
          : [],
      severity: 'neutral',
      badge: 'Overview',
      suggestedActions: [askAiWhy('What should I be watching in my portfolio right now?')],
      benchmark,
      signals,
    };
  }

  const [primary, ...rest] = headlineSignals;

  /** @type {{ label: string, to?: string, target?: string, question?: string }[]} */
  const actions = [];
  for (const signal of headlineSignals) {
    for (const action of signal.actions) {
      if (!actions.some((a) => a.label === action.label)) actions.push(action);
    }
  }

  return {
    headline: primary.text,
    supportingText: rest.slice(0, 2).map((s) => s.text),
    severity: primary.severity,
    badge: primary.badge,
    suggestedActions: actions.slice(0, 3),
    benchmark,
    signals,
  };
}

/**
 * @param {{
 *   stats: { diff: string, diffPct: number, benchAvailable: boolean },
 *   attribution: { contributors: any[], drags: any[], todayReturn?: number },
 * }} args
 * @returns {{ explanation: string | null }}
 */
export function buildExplanation({ stats, attribution }) {
  if (!stats.benchAvailable) {
    return { explanation: null };
  }
  const diffPct = stats.diffPct ?? 0;
  if (Math.abs(diffPct) < 1) {
    return { explanation: null };
  }

  const positive = (attribution.todayReturn ?? 0) >= 0;
  const driver = positive ? attribution.contributors[0] : attribution.drags[0];
  if (driver) {
    return {
      explanation: `${driver.ticker} was today's biggest ${positive ? 'contributor' : 'drag'}.`,
    };
  }

  return { explanation: null };
}

/**
 * @param {{ holding: any, holdings: any[] }} args
 * @returns {{ level: 'normal'|'market'|'sector'|'unusual', label: string, detail: string } | null}
 */
function classifyContext({ holding, holdings }) {
  const changePct = num(holding.daily_change_pct);
  if (changePct === null) return null;

  if (Math.abs(changePct) < MOVE_LIM) {
    return {
      level: 'normal',
      label: 'Normal volatility',
      detail: `${Math.abs(changePct).toFixed(1)}% is within typical movement.`,
    };
  }

  const direction = Math.sign(changePct);
  const sectorPeers = holdings.filter(
    (h) => h.sector === holding.sector && h.ticker !== holding.ticker,
  );
  const knownPeers = sectorPeers.filter((h) => num(h.daily_change_pct) !== null);
  const sectorPeersAligned = knownPeers.filter(
    (h) => Math.sign(h.daily_change_pct) === direction && Math.abs(h.daily_change_pct) >= 1,
  );
  if (knownPeers.length >= 2 && sectorPeersAligned.length === knownPeers.length) {
    return {
      level: 'sector',
      label: 'Sector-driven',
      detail: `Other ${holding.sector} holdings moved the same way today - likely a sector-wide rather than specific to ${holding.ticker}.`,
    };
  }

  const knownMovers = holdings.filter((h) => num(h.daily_change_pct) !== null);
  const movedWithDirection = knownMovers.filter(
    (h) => Math.sign(h.daily_change_pct) === direction && Math.abs(h.daily_change_pct) >= 1,
  );
  const breadth = knownMovers.length ? movedWithDirection.length / knownMovers.length : 0;
  if (knownMovers.length >= 3 && breadth >= MARKET_WIDE_BREADTH) {
    return {
      level: 'market',
      label: 'Market-wide move',
      detail: `Most of your holdings moved the same direction today - broader market conditions, not ${holding.ticker} alone.`,
    };
  }

  return {
    level: 'unusual',
    label: 'Unusually large move',
    detail: `A ${Math.abs(changePct).toFixed(1)}% move with no obvious sector/market pattern behind it.`,
  };
}

/**
 * @param {{ holdings: any[], attribution: { contributors: any[], drags: any[], todayReturn: number } }} args
 * @returns {{ driver: { text: string, tickers: string[] } | null }}
 */
function buildDriver({ holdings, attribution }) {
  if (!holdings.length) return { driver: null };

  const totalAbs = [...attribution.contributors, ...attribution.drags].reduce(
    (s, r) => s + Math.abs(r.contribution),
    0,
  );
  if (totalAbs === 0) {
    return { driver: { text: 'Your portfolio was flat today.', tickers: [] } };
  }

  const positive = attribution.todayReturn >= 0;
  const word = positive ? 'gain' : 'decline';
  const pool = positive ? attribution.contributors : attribution.drags;
  const poolAbs = pool.reduce((s, r) => s + Math.abs(r.contribution), 0);

  const ranked = [...pool].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = [];
  let covered = 0;
  for (const row of ranked) {
    top.push(row);
    covered += Math.abs(row.contribution);
    if (covered / totalAbs >= MARKET_WIDE_BREADTH || top.length >= 2) break;
  }
  const pct = Math.round((covered / totalAbs) * 100);
  const displayPct = Math.round((covered / poolAbs) * 100);

  if (top.length && pct >= 50) {
    const names =
      top.length === 1
        ? top[0].ticker
        : `${top
            .slice(0, -1)
            .map((r) => r.ticker)
            .join(', ')} and ${top[top.length - 1].ticker}`;
    return {
      driver: {
        text: `${displayPct}% of today's ${word} came from ${names}.`,
        tickers: top.map((r) => r.ticker),
      },
    };
  }

  /** @type {Record<string, number>} */
  const sectorTotals = {};
  for (const h of holdings.filter((x) => num(x.daily_change_pct) !== null)) {
    const contribution = ((num(h.value) ?? 0) * h.daily_change_pct) / 100;
    const sector = h.sector || 'Other';
    sectorTotals[sector] = (sectorTotals[sector] ?? 0) + Math.abs(contribution);
  }
  const [topSector, topSectorAbs] =
    Object.entries(sectorTotals).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topSector && topSectorAbs / totalAbs >= DRIVER_LIM) {
    return {
      driver: { text: `${topSector} accounted for most of today's movement.`, tickers: [] },
    };
  }

  return {
    driver: {
      text: `${word} was spread broadly across your holdings - no single position or sector dominated.`,
      tickers: [],
    },
  };
}

const HERO_STRONG_MOVE_PCT = 2;
const HERO_FLAT_MOVE_PCT = 0.1;

/**
 * @param {{ dailyChangeValue: number, dailyChangePct: number, unrealisedGain: number, gainKnown: boolean }} args
 * @returns {string}
 */
export function buildHeroSummary({ dailyChangeValue, dailyChangePct, unrealisedGain, gainKnown }) {
  const absPct = Math.abs(dailyChangePct);
  const changeText = `${zar(Math.abs(dailyChangeValue))} (${absPct.toFixed(2)}%)`;
  const overallUp = gainKnown && unrealisedGain > 0;

  if (absPct < HERO_FLAT_MOVE_PCT) {
    return "Quiet day out there - your portfolio's sitting pretty much where it was yesterday.";
  }

  if (dailyChangePct >= HERO_STRONG_MOVE_PCT) {
    return `Strong day out there - you're up ${changeText} since yesterday.`;
  }

  if (dailyChangePct > 0) {
    return `A steady gain today, up ${changeText}.`;
  }

  if (dailyChangePct <= -HERO_STRONG_MOVE_PCT) {
    return overallUp
      ? `A rough day, down ${changeText} - though you're still up ${zar(unrealisedGain)} overall, so this isn't the full picture.`
      : `A rough day, down ${changeText}. Worth keeping an eye on, not a reason to panic.`;
  }

  return `A small dip today, down ${changeText} - nothing that changes the bigger picture.`;
}

// card mascot trigger (backlog 3.2) question builders - each takes the same data the card
// itself already renders, so the suggestions the dock opens with are never a fixed list

/**
 * @param {{ name: string, value: number }[]} sectorData
 * @returns {string[]}
 */
export function buildSectorQuestions(sectorData) {
  const topSector = sectorData[0];
  if (!topSector) return [];
  const pct = topSector.value.toFixed(0);
  return [
    `Why is ${topSector.name} ${pct}% of my portfolio?`,
    `Should I diversify away from ${topSector.name}?`,
    'What sectors am I missing exposure to?',
  ];
}

/**
 * @param {{ score: number|null, subscores: { key: string, label: string, value: number }[] }} health
 * @returns {string[]}
 */
export function buildHealthQuestions(health) {
  if (health.score === null || !health.subscores.length) return [];
  const sorted = [...health.subscores].sort((a, b) => a.value - b.value);
  const questions = [`Why is my portfolio health ${health.score.toFixed(1)}/10?`];

  const weak = sorted.filter((s) => s.value < 7);

  if (weak.length === 0) {
    questions.push(
      'My score looks healthy across the board - how do I stay this diversified as my portfolio grows?',
    );
    return questions;
  }

  for (const factor of weak) {
    questions.push(`How can I improve my ${factor.label} score?`);
  }
  return questions.slice(0, 4);
}

/**
 * @param {{ diffPct: number, benchAvailable: boolean, benchmarkLabel: string }} args
 * @returns {string[]}
 */
export function buildPerformanceQuestions({ diffPct, benchAvailable, benchmarkLabel }) {
  if (!benchAvailable) {
    return [
      "What's driving my portfolio's performance right now?",
      'How is my time-weighted return calculated?',
    ];
  }

  const pct = Math.abs(diffPct).toFixed(1);
  if (Math.abs(diffPct) < NOTABLE_BENCHMARK_GAP_PCT) {
    return [
      `Why is my portfolio tracking the ${benchmarkLabel} so closely?`,
      `What would make me diverge from the ${benchmarkLabel}?`,
    ];
  }

  return diffPct >= 0
    ? [
        `Why am I outperforming the ${benchmarkLabel} by ${pct}%?`,
        'Is this outperformance likely to continue?',
      ]
    : [
        `Why am I underperforming the ${benchmarkLabel} by ${pct}%?`,
        'What would it take to catch up to the benchmark?',
      ];
}

/**
 * @param {any[]} holdings
 * @returns {string[]}
 */
/**
 * @param {any[]} holdings
 * @param {{ low: number, high: number }} [thresholds]
 */
export function buildHoldingsQuestions(holdings, thresholds) {
  if (!holdings.length) return [];
  const { topHolding, topPct } = getTopHolding(holdings);
  if (!topHolding) return [];
  const holdingRisk = getConcRisk(topPct, thresholds);

  if (holdingRisk.level === 'low') {
    return [
      `My biggest position is ${topHolding.ticker} at ${topPct.toFixed(0)}% - am I well diversified?`,
      'What should I be watching in my portfolio right now?',
    ];
  }

  const questions = [
    `Why is ${topHolding.ticker} ${topPct.toFixed(0)}% of my portfolio?`,
    `Should I trim my ${topHolding.ticker} position?`,
  ];

  const { sectors } = buildSectors(holdings);
  const topSector = sectors[0];
  if (topSector && getConcRisk(topSector.value, thresholds).level === 'high') {
    questions.push(
      `My ${topSector.name} exposure is ${topSector.value.toFixed(0)}% of my portfolio - is that too concentrated?`,
    );
  }

  return questions.slice(0, 4);
}
