import { zar } from './currency';

export const CONCENTRATION_LOW = 25;
export const CONCENTRATION_HIGH = 45;
const RANGE = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };
const SECTOR_LIM = 40;
const HOLDING_LIM = 30;
const BREADTH_LIM = 5;
const TARGET = 8;
const COMMON_SECTORS = ['Financials', 'Technology', 'Healthcare', 'Consumer', 'Industrials', 'Telecommunications'];
const NOTABLE_BENCHMARK_GAP_PCT = 2;
const NOTABLE_DAILY_MOVE_PCT = 1;
const POOR_DIVERSIFICATION_COUNT = 2;
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
export const isFund = (holding) => holding?.kind === 'etf';

/**
 * @param {any} holding
 */
export function concWording(holding) {
  if (isFund(holding)) {
    const exposure = holding?.sector || holding?.region || 'one market';
    return {
      label: 'Fund Concentration',
      risk: `Most of your portfolio sits in one fund so your result tracks ${exposure} rather than a spread of markets.`,
      fix: 'funds covering other markets',
      dominates: 'no single market carries your portfolio',
    };
  }
  return {
    label: 'Single-Stock Risk',
    risk: 'Single-stock risk this high means one earnings miss can dominate return.',
    fix: 'other positions',
    dominates: 'no single stock dominates your return',
  };
}

/** @param {number} pct */
export function getConcRisk(pct) {
  if (pct < CONCENTRATION_LOW) return { level: 'low', label: 'Low', color: 'var(--signal-positive)' };
  if (pct < CONCENTRATION_HIGH) return { level: 'moderate', label: 'Moderate', color: 'var(--signal-warning)' };
  return { level: 'high', label: 'High', color: 'var(--signal-negative)' };
}

/**
 * @param {any[]} holdings
 * @returns {{ topHolding: any, topPct: number }}
 */
export function getTopHolding(holdings) {
  const totalVal = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const topHolding = [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const topPct = totalVal ? ((topHolding?.value ?? 0) / totalVal) * 100 : 0;
  return { topHolding, topPct };
}

/**
 * @param {{ date: string, name: string, value: number, benchmark?: number }[]} series
 * @param {'1D'|'1W'|'1M'|'1Y'|'ALL'} range
 * @returns {{ series: { date: string, name: string, value: number, benchmark?: number }[] }}
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
 * @param {{ name: string, value: number, benchmark?: number }[]} series
 */
export function buildChartStats(series) {
  if (!series.length) {
    return { portReturn: '-', benchReturn: '-', diff: '-', diffPct: 0, bestDay: '-', worstDay: '-', benchAvailable: false };
  }

  const first = series[0];
  const last = series[series.length - 1];
  const portPct = first.value ? ((last.value - first.value) / first.value) * 100 : 0;

  const firstPnt = series.find((p) => p.benchmark != null && p.benchmark !== 0);
  const lastPnt = [...series].reverse().find((p) => p.benchmark != null);

  let benchAvailable = false;
  let benchPct = 0;
  if (firstPnt && lastPnt && firstPnt !== lastPnt) {
    const firstVal = firstPnt.benchmark;
    const lastVal = lastPnt.benchmark;
    if (firstVal != null && lastVal != null) {
      benchAvailable = true;
      benchPct = ((lastVal - firstVal) / firstVal) * 100;
    }
  }

  let best = { pct: -Infinity, name: '' };
  let worst = { pct: Infinity, name: '' };

  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    if (!prev) continue;
    const pct = ((series[i].value - prev) / prev) * 100;
    if (pct > best.pct) best = { pct, name: series[i].name };
    if (pct < worst.pct) worst = { pct, name: series[i].name };
  }

  /** @param {number} pct */
  const fmt = (pct) => `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  const diffPct = benchAvailable ? portPct - benchPct : 0;

  return {
    portReturn: fmt(portPct),
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
  const rows = holdings.map((h) => ({
    ticker: h.ticker,
    contribution: ((h.value ?? 0) * (h.daily_change_pct ?? 0)) / 100,
  }));
  const contributors = rows
    .filter((r) => r.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const drags = rows
    .filter((r) => r.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution);
  const todayReturn = rows.reduce((s, r) => s + r.contribution, 0);
  return { contributors, drags, todayReturn };
}

/** @param {number} n */
const clamp10 = (n) => Math.max(0, Math.min(10, n));
/** @param {number} n */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {number} score
 * @returns {{ label: string }}
 */
export function healthLabel(score) {
  if (score >= 8.5) return { label: 'Excellent' };
  if (score >= 7) return { label: 'Healthy' };
  if (score >= 5) return { label: 'Mixed' };
  return { label: 'Needs attention' };
}

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   chartStats: { diff: string, diffPct: number },
 *   benchmarkLabel?: string,
 * }} args
 */
export function buildHealth({ holdings, sectorData, chartStats, benchmarkLabel = 'JSE ALSI' }) {
  if (!holdings.length) {
    return { score: null, label: null, subscores: [], reasons: [] };
  }

  const topSector = sectorData[0] ?? { name: 'None', value: 0 };
  const { topHolding, topPct } = getTopHolding(holdings);
  const sectorRisk = getConcRisk(topSector.value);
  const holdingRisk = getConcRisk(topPct);
  const topWording = concWording(topHolding);
  const diffPct = chartStats.diffPct ?? 0;
  const diverseVal = clamp10(sectorData.length * 1.5);
  const exposureVal = clamp10(10 - topSector.value / 10);
  const stockVal = clamp10(10 - topPct / 10);
  const breadthVal = clamp10((holdings.length / TARGET) * 10);
  const benchmarkVal = clamp10(5 + (diffPct / 5) * 5);

  const subscores = [
    {
      key: 'diversification',
      label: 'Diversification',
      weight: 0.15,
      value: round1(diverseVal),
      detail: `Spread across ${sectorData.length} sector${sectorData.length === 1 ? '' : 's'}.`,
      target: '4+ sectors',
      improvement:
        sectorData.length < 4
          ? 'Add more sectors to spread the risk further.'
          : 'Sector breadth is good.',
    },
    {
      key: 'sectorExposure',
      label: 'Sector Exposure',
      weight: 0.2,
      value: round1(exposureVal),
      detail: `${topSector.name} is ${topSector.value.toFixed(0)}% of your book - ${sectorRisk.label.toLowerCase()} concentration.`,
      target: `Under ${CONCENTRATION_LOW}% in any one sector`,
      improvement:
        sectorRisk.level === 'low'
          ? 'No single sector dominates.'
          : `Trim ${topSector.name} or add positions elsewhere to bring it back under ${CONCENTRATION_LOW}%.`,
    },
    {
      key: 'singleStockRisk',
      label: topWording.label,
      weight: 0.25,
      value: round1(stockVal),
      detail: `${topHolding?.ticker ?? 'Your largest holding'} is ${topPct.toFixed(0)}% of your book - ${holdingRisk.label.toLowerCase()} concentration.`,
      target: `Under ${CONCENTRATION_LOW}% in any one holding`,
      improvement:
        holdingRisk.level === 'low'
          ? 'No single position is carrying outsized risk.'
          : `Trim ${topHolding?.ticker ?? 'this position'} or build up ${topWording.fix} so ${topWording.dominates}.`,
    },
    {
      key: 'portfolioBreadth',
      label: 'Portfolio Breadth',
      weight: 0.15,
      value: round1(breadthVal),
      detail: `${holdings.length} position${holdings.length === 1 ? '' : 's'} in your book.`,
      target: `${TARGET}-12 positions`,
      improvement:
        holdings.length < TARGET
          ? `Adding a few more positions reduces how much any one holding drives your return.`
          : 'Position count is in the target range for a diversified retail book.',
    },
    {
      key: 'benchmarkPerformance',
      label: 'Benchmark Performance',
      weight: 0.25,
      value: round1(benchmarkVal),
      detail: `${chartStats.diff} vs ${benchmarkLabel} over this window.`,
      target: `At or above the ${benchmarkLabel}`,
      improvement:
        diffPct >= 0
          ? 'Outperforming the benchmark - keep monitoring, no action needed.'
          : "Behind the benchmark - check Why Your Portfolio Moved Today for what's dragging it down.",
    },
  ];

  const score = subscores.reduce((s, d) => s + d.weight * d.value, 0);
  const sorted = [...subscores].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  const reasons = [];
  if (weakest.value < 6) {
    reasons.push({
      tone: 'bad',
      label: weakest.label,
      detail: weakest.detail,
      text: `${weakest.label} is the main drag right now - ${weakest.detail.toLowerCase()}`,
    });
  }
  if (strongest.value >= 7 && strongest.key !== weakest.key) {
    reasons.push({
      tone: 'good',
      label: strongest.label,
      detail: strongest.detail,
      text: `${strongest.label} is good - ${strongest.detail.toLowerCase()}`,
    });
  }

  return { score: round1(score), label: healthLabel(score).label, subscores, reasons };
}

/**
 * @param {{ key: string, weight: number, value: number }[] | undefined} subscores
 * @param {string} key
 * @param {number} estVal
 * @returns {{ improvement: number | null }}
 */
function estImprove(subscores, key, estVal) {
  const curr = subscores?.find((s) => s.key === key);
  if (!curr) { return { improvement: null }; }
  return { improvement: round1(Math.max(0, estVal - curr.value) * curr.weight) };
}

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   attribution: { drags: { ticker: string, contribution: number }[] },
 *   health?: { subscores: { key: string, weight: number, value: number }[] },
 * }} args
 */
export function buildActions({ holdings, sectorData, attribution, health }) {
  if (!holdings.length) { return { items: [] }; }

  const items = [];
  const topSector = sectorData[0];
  const { topHolding, topPct } = getTopHolding(holdings);
  const subscores = health?.subscores;

  if (topSector && topSector.value >= SECTOR_LIM) {
    const projected = clamp10(10 - SECTOR_LIM / 10);
    const { improvement: healthImprovement } = estImprove(subscores, 'sectorExposure', projected);
    items.push({
      id: 'sector-concentration',
      severity: 'risk',
      impact: getConcRisk(topSector.value).level === 'high' ? 'High' : 'Medium',
      title: `${topSector.name} is ${topSector.value.toFixed(0)}% of your portfolio`,
      detail: 'A single sector this large means sector-specific news can swing your whole book.',
      benefit: healthImprovement
        ? `Reducing ${topSector.name} below ${SECTOR_LIM}% could improve your Portfolio Health by +${healthImprovement.toFixed(1)}.`
        : "Reduces how much a sector's bad news can move your whole portfolio.",
      healthImprovement,
      cta: { label: 'Explore New Sectors', target: 'sector-allocation' },
    });
  }

  if (topPct >= HOLDING_LIM && topHolding) {
    const projected = clamp10(10 - HOLDING_LIM / 10);
    const { improvement: healthImprovement } = estImprove(subscores, 'singleStockRisk', projected);
    const wording = concWording(topHolding);
    items.push({
      id: 'holding-concentration',
      severity: 'risk',
      impact: getConcRisk(topPct).level === 'high' ? 'High' : 'Medium',
      title: `${topHolding.ticker} alone is ${topPct.toFixed(0)}% of your book`,
      detail: wording.risk,
      benefit: healthImprovement
        ? `Trimming ${topHolding.ticker} below ${HOLDING_LIM}% could improve your Portfolio Health by +${healthImprovement.toFixed(1)}.`
        : isFund(topHolding)
          ? 'Cuts how much one index decides your overall result.'
          : "Cuts your exposure to a company's earnings or a bad headline.",
      healthImprovement,
      cta: { label: 'Review Holdings', target: 'holdings-table' },
    });
  }

  if (holdings.length < BREADTH_LIM) {
    const projected = clamp10((BREADTH_LIM / TARGET) * 10);
    const { improvement: healthImprovement } = estImprove(subscores, 'portfolioBreadth', projected);
    items.push({
      id: 'low-diversification',
      severity: 'suggestion',
      impact: holdings.length <= 2 ? 'High' : 'Medium',
      title: `Only ${holdings.length} position${holdings.length === 1 ? '' : 's'} in your portfolio`,
      detail: `Ideal portfolios target ${TARGET}-12 positions to spread out what drives return.`,
      benefit: healthImprovement
        ? `Adding a few more positions could improve your Portfolio Health by +${healthImprovement.toFixed(1)}.`
        : 'Spreads your risk so no single holding decides your return.',
      healthImprovement,
      cta: { label: 'Fix Diversification', to: '/portfolio' },
    });
  }

  const worstDrag = attribution.drags[0];
  if (worstDrag && worstDrag.contribution < 0) {
    items.push({
      id: 'ask-about-drag',
      severity: 'info',
      impact: 'Low',
      title: `${worstDrag.ticker} is your biggest drag today`,
      detail: 'Ask the assistant what moved it.',
      benefit: "Understand what's driving today's move before deciding whether to hold or trim.",
      healthImprovement: null,
      cta: { label: `Ask AI About ${worstDrag.ticker}`, to: '/ai' },
    });
  }

  items.sort((a, b) => (b.healthImprovement ?? -1) - (a.healthImprovement ?? -1));

  return { items: items.slice(0, 3) };
}

/**
 * @param {any[]} holdings
 */
const canJudgeGaps = (holdings) => holdings.some((h) => !isFund(h));

/**
 * @param {any[]} holdings
 * @param {{ name: string }[]} sectorData
 * @returns {{ sector: string | null }}
 */
function findMissing(holdings, sectorData) {
  if (!canJudgeGaps(holdings)) return { sector: null };
  return { sector: COMMON_SECTORS.find((sector) => !sectorData.some((s) => s.name === sector)) ?? null };
}

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   attribution: { contributors: any[], drags: any[] },
 *   chartStats: { diff: string, diffPct: number, benchAvailable: boolean },
 *   totalGainLoss?: { pct: number, value: number },
 * }} args
 * @returns {{ insights: { type: string, text: string, why: string, action: { label: string, to?: string, target?: string } | null }[] }}
 */
export function buildInsights({ holdings, sectorData, attribution, chartStats, totalGainLoss }) {
  if (!holdings.length) return { insights: [] };

  const insights = [];

  if (totalGainLoss && Number.isFinite(totalGainLoss.pct) && Number.isFinite(totalGainLoss.value)) {
    const positive = totalGainLoss.pct >= 0;
    insights.push({
      type: positive ? 'gain' : 'loss',
      text: `${positive ? 'Up' : 'Down'} ${Math.abs(totalGainLoss.pct).toFixed(1)}% (${zar(Math.abs(totalGainLoss.value))}) since you started investing.`,
      why: "Total return since each position was opened, a different number to today's move shown up top.",
      action: null,
    });
  }

  const ranked = holdings.filter((h) => Number.isFinite(h.gain_loss_pct)).sort((a, b) => b.gain_loss_pct - a.gain_loss_pct);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  if (best) {
    insights.push({
      type: 'best-performer',
      text: `${best.ticker} has been your best long-term performer, up ${best.gain_loss_pct.toFixed(1)}% since purchase.`,
      why: "Based on total gain since purchase, not today's daily move.",
      action: { label: 'Review holdings', target: 'holdings-table' },
    });
  }

  if (worst && worst !== best) {
    const worstPositive = worst.gain_loss_pct >= 0;
    insights.push({
      type: worstPositive ? 'laggard' : 'loss',
      text: worstPositive
        ? `${worst.ticker} has gained the least since purchase, up just ${worst.gain_loss_pct.toFixed(1)}%.`
        : `${worst.ticker} is down ${Math.abs(worst.gain_loss_pct).toFixed(1)}% since you bought it.`,
      why: worstPositive
        ? "Still a gain, but worth understanding what's holding it back compared to the rest of your book."
        : 'Your only lifetime loser right now - worth understanding whether the original thesis still holds.',
      action: { label: `Ask AI About ${worst.ticker}`, to: '/ai' },
    });
  }

  const { sector: missingSector } = findMissing(holdings, sectorData);
  if (missingSector) {
    insights.push({
      type: 'missing-sector',
      text: `You currently have no ${missingSector} exposure.`,
      why: 'A common blind spot - most balanced JSE portfolios have some exposure here.',
      action: { label: 'Explore sectors', target: 'sector-allocation' },
    });
  }

  return { insights: insights.slice(0, 5) };
}

/** @param {string} question */
const askAiWhy = (question) => ({ label: 'Ask AI Why', to: '/ai', prefill: question });

/**
 * @param {{
 *   holdings: any[],
 *   sectorData: { name: string, value: number }[],
 *   attribution: { contributors: any[], drags: any[] },
 *   chartStats: { diff: string, diffPct: number, benchAvailable: boolean },
 *   dailyChangePct: number,
 *   benchmarkLabel?: string,
 * }} args
 * @returns {{
 *   headline: string,
 *   supportingText: string[],
 *   severity: 'risk'|'opportunity'|'neutral',
 *   badge: string,
 *   suggestedActions: { label: string, to?: string, target?: string, prefill?: string }[],
 * }}
 */
export function buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct, benchmarkLabel = 'JSE ALSI' }) {
  if (!holdings.length) {
    return {
      headline: 'Import a portfolio to see your executive summary.',
      supportingText: [],
      severity: 'neutral',
      badge: 'Overview',
      suggestedActions: [{ label: 'Import Portfolio', to: '/portfolio' }],
    };
  }

  const topSector = sectorData[0] ?? { name: 'None', value: 0 };
  const { topHolding, topPct } = getTopHolding(holdings);
  const sectorRisk = getConcRisk(topSector.value);
  const holdingRisk = getConcRisk(topPct);
  const diffPct = chartStats.diffPct ?? 0;
  const positive = dailyChangePct >= 0;
  const driver = positive ? attribution.contributors[0] : attribution.drags[0];
  /** @type {{ rank: number, severity: 'risk'|'opportunity'|'neutral', badge: string, text: string, actions: { label: string, to?: string, target?: string, prefill?: string }[] }[]} */
  const signals = [];

  if (holdingRisk.level === 'high') {
    signals.push({
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
      rank: 3,
      severity: 'risk',
      badge: 'Diversification',
      text: `Only ${holdings.length} position${holdings.length === 1 ? '' : 's'} make up your entire book.`,
      actions: [{ label: 'Review Diversification', to: '/portfolio' }],
    });
  }

  if (chartStats.benchAvailable && diffPct <= -NOTABLE_BENCHMARK_GAP_PCT) {
    signals.push({
      rank: 4,
      severity: 'risk',
      badge: 'Performance',
      text: `You're underperforming the ${benchmarkLabel} by ${Math.abs(diffPct).toFixed(1)}%.`,
      actions: [{ label: 'Compare Against Benchmark', target: 'performance-vs-benchmark' }],
    });
  }

  if (chartStats.benchAvailable && diffPct >= NOTABLE_BENCHMARK_GAP_PCT) {
    signals.push({
      rank: 5,
      severity: 'opportunity',
      badge: 'Performance',
      text: `You're outperforming the ${benchmarkLabel} by ${diffPct.toFixed(1)}%.`,
      actions: [{ label: 'Compare Against Benchmark', target: 'performance-vs-benchmark' }],
    });
  }

  if (Math.abs(dailyChangePct) >= NOTABLE_DAILY_MOVE_PCT && driver) {
    const holding = holdings.find((h) => h.ticker === driver.ticker);
    const sector = holding?.sector ? ` in ${holding.sector}` : '';
    signals.push({
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

  const { sector: missingSector } = findMissing(holdings, sectorData);
  if (missingSector) {
    signals.push({
      rank: 7,
      severity: 'opportunity',
      badge: 'Opportunity',
      text: `You have no ${missingSector} exposure - a common gap in balanced JSE portfolios.`,
      actions: [{ label: 'Explore Sector Allocation', target: 'sector-allocation' }],
    });
  }

  if (signals.length === 0) {
    return {
      headline: `Your holdings are well diversified, no company is more than ${topPct.toFixed(0)}% of your book.`,
      supportingText: chartStats.benchAvailable
        ? [`Performance is tracking the ${benchmarkLabel} closely (${chartStats.diff} this period).`]
        : [],
      severity: 'neutral',
      badge: 'Overview',
      suggestedActions: [askAiWhy('What should I be watching in my portfolio right now?')],
    };
  }

  signals.sort((a, b) => a.rank - b.rank);
  const [primary, ...rest] = signals;

  /** @type {{ label: string, to?: string, target?: string, prefill?: string }[]} */
  const actions = [];
  for (const signal of signals) {
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
  };
}

/**
 * @param {{
 *   stats: { diff: string, diffPct: number, benchAvailable: boolean },
 *   attribution: { contributors: any[], drags: any[] },
 *   anomalies?: { date: string, ticker: string, changePct: number }[],
 *   visibleSeries?: { date: string }[],
 * }} args
 * @returns {{ explanation: string | null }}
 */
export function buildExplanation({ stats, attribution, anomalies = [], visibleSeries = [] }) {
  if (!stats.benchAvailable) { return { explanation: null }; }
  const diffPct = stats.diffPct ?? 0;
  if (Math.abs(diffPct) < 1) { return { explanation: null }; }

  const word = diffPct >= 0 ? 'outperformance' : 'underperformance';
  const visibleDates = new Set(visibleSeries.map((p) => p.date));
  const relevantAnomaly = [...anomalies]
    .filter((a) => visibleDates.has(a.date))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];

  if (relevantAnomaly) {
    const direction = relevantAnomaly.changePct >= 0 ? 'gain' : 'drop';
    return {
      explanation: `Most of this ${word} traces back to ${relevantAnomaly.ticker}'s ${Math.abs(relevantAnomaly.changePct).toFixed(1)}% ${direction} on ${relevantAnomaly.date}.`,
    };
  }

  const driver = diffPct >= 0 ? attribution.contributors[0] : attribution.drags[0];
  if (driver) {
    return { explanation: `Today's biggest mover ${driver.ticker} is a contributor` };
  }

  return { explanation: null };
}

/** @param {number} changePct */
export function classifySignificance(changePct) {
  if (Math.abs(changePct) >= MOVE_LIM) {
    return { label: 'Worth monitoring', tone: 'warn' };
  }
  return { label: 'Likely short-term noise', tone: 'neutral' };
}

/**
 * @param {{ holding: any, holdings: any[], anomalies?: { date: string, ticker: string, headline: string }[] }} args
 * @returns {{ level: 'normal'|'market'|'sector'|'company'|'unusual', label: string, detail: string }}
 */
export function classifyContext({ holding, holdings, anomalies = [] }) {
  const changePct = holding?.daily_change_pct ?? 0;

  if (Math.abs(changePct) < MOVE_LIM) {
    return {
      level: 'normal',
      label: 'Normal volatility',
      detail: `${Math.abs(changePct).toFixed(1)}% is within typical movement.`,
    };
  }

  const direction = Math.sign(changePct);
  const sectorPeers = holdings.filter((h) => h.sector === holding.sector && h.ticker !== holding.ticker);
  const sectorPeersAligned = sectorPeers.filter(
    (h) => Math.sign(h.daily_change_pct ?? 0) === direction && Math.abs(h.daily_change_pct ?? 0) >= 1,
  );
  if (sectorPeers.length > 0 && sectorPeersAligned.length === sectorPeers.length) {
    return {
      level: 'sector',
      label: 'Sector-driven',
      detail: `Other ${holding.sector} holdings moved the same way today - likely a sector-wide rather than specific to ${holding.ticker}.`,
    };
  }

  const movedWithDirection = holdings.filter(
    (h) => Math.sign(h.daily_change_pct ?? 0) === direction && Math.abs(h.daily_change_pct ?? 0) >= 1,
  );
  const breadth = holdings.length ? movedWithDirection.length / holdings.length : 0;
  if (holdings.length >= 3 && breadth >= MARKET_WIDE_BREADTH) {
    return {
      level: 'market',
      label: 'Market-wide move',
      detail: `Most of your holdings moved the same direction today - broader market conditions, not ${holding.ticker} alone.`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysNews = anomalies.find((a) => a.ticker === holding.ticker && a.date === today);
  if (todaysNews) {
    return { level: 'company', label: 'Company-specific', detail: todaysNews.headline };
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
export function buildDriver({ holdings, attribution }) {
  if (!holdings.length) return { driver: null };

  const totalAbs = [...attribution.contributors, ...attribution.drags].reduce((s, r) => s + Math.abs(r.contribution), 0);
  if (totalAbs === 0) {
    return { driver: { text: "Your portfolio was flat today.", tickers: [] } };
  }

  const positive = attribution.todayReturn >= 0;
  const word = positive ? 'gain' : 'decline';
  const pool = positive ? attribution.contributors : attribution.drags;

  const ranked = [...pool].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = [];
  let covered = 0;
  for (const row of ranked) {
    top.push(row);
    covered += Math.abs(row.contribution);
    if (covered / totalAbs >= MARKET_WIDE_BREADTH || top.length >= 2) break;
  }
  const pct = Math.round((covered / totalAbs) * 100);

  if (top.length && pct >= 50) {
    const names =
      top.length === 1
        ? top[0].ticker
        : `${top.slice(0, -1).map((r) => r.ticker).join(', ')} and ${top[top.length - 1].ticker}`;
    return { driver: { text: `${pct}% of today's ${word} came from ${names}.`, tickers: top.map((r) => r.ticker) } };
  }

  /** @type {Record<string, number>} */
  const sectorTotals = {};
  for (const h of holdings) {
    const contribution = ((h.value ?? 0) * (h.daily_change_pct ?? 0)) / 100;
    const sector = h.sector || 'Other';
    sectorTotals[sector] = (sectorTotals[sector] ?? 0) + Math.abs(contribution);
  }
  const [topSector, topSectorAbs] = Object.entries(sectorTotals).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (topSector && topSectorAbs / totalAbs >= DRIVER_LIM) {
    return { driver: { text: `${topSector} accounted for most of today's movement.`, tickers: [] } };
  }

  return {
    driver: {
      text: `${word} was spread broadly across your holdings - no single position or sector dominated.`,
      tickers: [],
    },
  };
}
