import {
  annualisedVolatility,
  benchmarkGapTrend,
  currentDrawdown,
  dailyReturnsFromIndex,
  maxDrawdown,
  versusMovingAverage,
} from './portfolioStats';

import { zar } from './currency';

const COMMON_SECTORS = [
  'Financials',
  'Technology',
  'Healthcare',
  'Consumer',
  'Industrials',
  'Telecommunications',
];

const RECENT_PURCHASE_DAYS = 30;
export const POOR_DIVERSIFICATION_COUNT = 2;
const TOP_THREE_TRIGGER_PCT = 50;
const GAIN_SHARE_TRIGGER = 0.5;
const BENCHMARK_GAP_PCT = 2;
const GAP_SHIFT_PCT = 2;
const DRAWDOWN_TRIGGER_PCT = 5;
const VOL_WINDOW_DAYS = 30;
const VOL_SHIFT_RATIO = 1.3;
const CGT_TRIGGER_ZAR = 5000;
const LOSS_OFFSET_TRIGGER_ZAR = 2000;
const STALE_STATEMENT_DAYS = 45;
const MIN_HISTORY_DAYS = 30;
const MA_WINDOW = 50;
const MS_PER_DAY = 86400000;
const HEALTHY_SUBSCORE = 10;

/** @param {number} n */
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** @param {number} n @param {number} [places] */
const pct = (n, places = 1) => `${n.toFixed(places)}%`;

/** @param {any} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** @param {any[]} holdings */
const bookTotal = (holdings) => holdings.reduce((sum, h) => sum + (num(h.value) ?? 0), 0);

/** @param {any[]} holdings */
const byValue = (holdings) => [...holdings].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

/** @param {any[]} holdings */
function effectiveCount(holdings) {
  const total = bookTotal(holdings);
  if (!total) return null;
  const hhi = holdings.reduce((sum, h) => sum + ((num(h.value) ?? 0) / total) ** 2, 0);
  return hhi > 0 ? 1 / hhi : null;
}

/** @param {string | null | undefined} iso */
function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.round((Date.now() - then) / MS_PER_DAY);
}

/** @param {any} ctx */
const sectors = (ctx) =>
  ctx.sectorData?.length
    ? ctx.sectorData
    : (ctx.sectorAllocation ?? []).map((/** @type {any} */ s) => ({
        name: s.sector,
        value: s.percentage,
      }));

/** @param {any} ctx */
const thresholdsOf = (ctx) => ({
  low: num(ctx.thresholds?.low) ?? num(ctx.thresholds?.concentration_low) ?? 25,
  high: num(ctx.thresholds?.high) ?? num(ctx.thresholds?.concentration_high) ?? 45,
});

const holdingsTable = { label: 'View Holdings', target: 'holdings-table' };
const sectorTarget = { label: 'Explore Sector Allocation', target: 'sector-allocation' };
const performanceTarget = { label: 'Compare Against Benchmark', target: 'performance-vs-benchmark' };
const healthTarget = { label: 'Review Portfolio Health', target: 'portfolio-health' };
const rebalanceTarget = { label: 'Open Rebalancing Tools', target: 'concentration-rebalancing' };

const concentration = [
  {
    id: 'conc.top-holding-high',
    category: 'concentration',
    /** @param {any} ctx */
    build(ctx) {
      const total = bookTotal(ctx.holdings);
      const top = byValue(ctx.holdings)[0];
      if (!total || !top) return null;
      const share = ((num(top.value) ?? 0) / total) * 100;
      const { high } = thresholdsOf(ctx);
      if (share < high) return null;

      return {
        id: 'conc.top-holding',
        category: 'concentration',
        severity: 'risk',
        magnitude: clamp01((share - high) / (100 - high)),
        text: `${top.ticker} is ${pct(share, 0)} of your book, past the ${pct(high, 0)} mark where concentration stops being a choice and starts being the main risk.`,
        why: `Your scoring settings treat anything above ${pct(high, 0)} in one holding as high concentration. One company's result now decides most of what your portfolio does.`,
        evidence: [
          { label: top.ticker, value: zar(num(top.value) ?? 0) },
          { label: 'Share of book', value: pct(share, 1) },
          { label: 'Your high threshold', value: pct(high, 0) },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'conc.top-holding-moderate',
    category: 'concentration',
    /** @param {any} ctx */
    build(ctx) {
      const total = bookTotal(ctx.holdings);
      const top = byValue(ctx.holdings)[0];
      if (!total || !top) return null;
      const share = ((num(top.value) ?? 0) / total) * 100;
      const { low, high } = thresholdsOf(ctx);
      if (share < low || share >= high) return null;

      return {
        id: 'conc.top-holding-moderate',
        category: 'concentration',
        severity: 'neutral',
        magnitude: clamp01((share - low) / (high - low)),
        text: `${top.ticker} is ${pct(share, 0)} of your book - above your ${pct(low, 0)} watch level but still short of the ${pct(high, 0)} high-concentration mark.`,
        why: 'Worth knowing rather than acting on. It is the size at which one holding starts to matter more than the rest put together.',
        evidence: [
          { label: top.ticker, value: pct(share, 1) },
          { label: 'Watch level', value: pct(low, 0) },
          { label: 'High level', value: pct(high, 0) },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'conc.top-three',
    category: 'concentration',
    /** @param {any} ctx */
    build(ctx) {
      const total = bookTotal(ctx.holdings);
      const sorted = byValue(ctx.holdings);
      if (!total || sorted.length < 3) return null;
      const three = sorted.slice(0, 3);
      const share = (three.reduce((sum, h) => sum + (num(h.value) ?? 0), 0) / total) * 100;
      if (share <= TOP_THREE_TRIGGER_PCT) return null;

      return {
        id: 'conc.top-three',
        category: 'concentration',
        severity: 'risk',
        magnitude: clamp01((share - TOP_THREE_TRIGGER_PCT) / (100 - TOP_THREE_TRIGGER_PCT)),
        text: `Your three largest positions are ${pct(share, 0)} of the book between them - ${three.map((h) => h.ticker).join(', ')}.`,
        why: `A single dominant holding is easy to spot. Three that add to ${pct(share, 0)} carry much the same risk and usually go unnoticed.`,
        evidence: three.map((h) => ({
          label: h.ticker,
          value: pct(((num(h.value) ?? 0) / total) * 100, 1),
        })),
        action: holdingsTable,
      };
    },
  },
  {
    id: 'conc.position-count',
    category: 'concentration',
    /** @param {any} ctx */
    build(ctx) {
      const count = ctx.holdings.length;
      if (!count || count > POOR_DIVERSIFICATION_COUNT) return null;

      return {
        id: 'conc.position-count',
        category: 'concentration',
        severity: 'risk',
        magnitude: clamp01(1 - (count - 1) / POOR_DIVERSIFICATION_COUNT),
        text: `Only ${count} position${count === 1 ? ' makes' : 's make'} up your entire book.`,
        why: 'With a book this small there is nothing to average against - one company having a bad week is the whole portfolio having a bad week. This is the raw count, so it fires however evenly the money is split between them.',
        evidence: [
          { label: 'Positions held', value: String(count) },
          { label: 'Total book value', value: zar(bookTotal(ctx.holdings)) },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'conc.effective-count',
    category: 'concentration',
    /** @param {any} ctx */
    build(ctx) {
      const count = ctx.holdings.length;
      const effective = effectiveCount(ctx.holdings);
      if (effective === null || count < 3 || effective >= count / 2) return null;

      return {
        id: 'conc.effective-count',
        category: 'concentration',
        severity: 'risk',
        magnitude: clamp01(1 - effective / count),
        text: `You hold ${count} positions, but weighted by size that is only ${effective.toFixed(1)} effective positions.`,
        why: 'Effective count is 1 divided by the sum of squared weights. It answers how many holdings you would need at equal size to carry the same risk, which is the number that matters rather than the raw count.',
        evidence: [
          { label: 'Positions held', value: String(count) },
          { label: 'Effective positions', value: effective.toFixed(1) },
        ],
        action: holdingsTable,
      };
    },
  },
];

const sector = [
  {
    id: 'sector.largest',
    category: 'sector',
    /** @param {any} ctx */
    build(ctx) {
      const top = sectors(ctx)[0];
      if (!top || num(top.value) === null) return null;
      const { high } = thresholdsOf(ctx);
      if (top.value < high) return null;

      return {
        id: 'sector.largest',
        category: 'sector',
        severity: 'risk',
        magnitude: clamp01((top.value - high) / (100 - high)),
        text: `${pct(top.value, 0)} of your book sits in ${top.name}, above your ${pct(high, 0)} sector ceiling.`,
        why: 'Sector risk moves together. When one sector is this large, a sector-wide event moves the whole portfolio rather than part of it.',
        evidence: [
          { label: top.name, value: pct(top.value, 1) },
          { label: 'Your ceiling', value: pct(high, 0) },
        ],
        action: rebalanceTarget,
      };
    },
  },
  {
    id: 'sector.missing',
    category: 'sector',
    /** @param {any} ctx */
    build(ctx) {
      const list = sectors(ctx);
      const canJudge = ctx.holdings.some((/** @type {any} */ h) => h.kind !== 'etf');
      if (!canJudge) return null;
      const missing = COMMON_SECTORS.find((s) => !list.some((/** @type {any} */ x) => x.name === s));
      if (!missing) return null;

      return {
        id: 'sector.missing',
        category: 'sector',
        severity: 'opportunity',
        magnitude: clamp01((COMMON_SECTORS.length - list.length) / COMMON_SECTORS.length),
        type: 'opportunity',
        text: `You have no ${missing} exposure - a common gap in balanced JSE portfolios.`,
        why: `Checked against the usual JSE sector spread: ${COMMON_SECTORS.join(', ')}.`,
        evidence: [
          { label: 'Missing sector', value: missing },
          { label: 'Sectors held', value: `${list.length} of ${COMMON_SECTORS.length}` },
        ],
        action: sectorTarget,
      };
    },
  },
  {
    id: 'sector.gain-concentration',
    category: 'sector',
    /** @param {any} ctx */
    build(ctx) {
      const gains = new Map();
      let totalGain = 0;
      for (const h of ctx.holdings) {
        const g = num(h.gain_loss);
        if (g === null || g <= 0) continue;
        const name = h.sector || 'Other';
        gains.set(name, (gains.get(name) ?? 0) + g);
        totalGain += g;
      }
      if (!totalGain || gains.size < 2) return null;

      const [name, value] = [...gains.entries()].sort((a, b) => b[1] - a[1])[0];
      const share = value / totalGain;
      if (share <= GAIN_SHARE_TRIGGER) return null;

      return {
        id: 'sector.gain-concentration',
        category: 'sector',
        severity: 'neutral',
        magnitude: clamp01((share - GAIN_SHARE_TRIGGER) / (1 - GAIN_SHARE_TRIGGER)),
        text: `${pct(share * 100, 0)} of your unrealised gain comes from ${name} alone (${zar(value)} of ${zar(totalGain)}).`,
        why: 'Where the gain is concentrated is not the same question as where the money is. A sector can be a small share of the book and still be carrying the performance.',
        evidence: [
          { label: `${name} gain`, value: zar(value) },
          { label: 'Total unrealised gain', value: zar(totalGain) },
          { label: 'Share', value: pct(share * 100, 0) },
        ],
        action: sectorTarget,
      };
    },
  },
  {
    id: 'sector.too-few',
    category: 'sector',
    /** @param {any} ctx */
    build(ctx) {
      const list = sectors(ctx);
      if (!list.length || list.length > 2 || ctx.holdings.length < 2) return null;

      return {
        id: 'sector.too-few',
        category: 'sector',
        severity: 'risk',
        magnitude: list.length === 1 ? 1 : 0.6,
        text: `Your whole book sits in ${list.length} sector${list.length === 1 ? '' : 's'}: ${list.map((/** @type {any} */ s) => `${s.name} ${pct(s.value, 0)}`).join(', ')}.`,
        why: 'With this few sectors represented there is no spread left to absorb a sector-wide move - the portfolio and the sector are the same bet.',
        evidence: list.map((/** @type {any} */ s) => ({ label: s.name, value: pct(s.value, 1) })),
        action: sectorTarget,
      };
    },
  },
];

const composition = [
  {
    id: 'composition.recent-pile-in',
    category: 'composition',
    /** @param {any} ctx */
    build(ctx) {
      const dated = ctx.holdings
        .filter((/** @type {any} */ h) => h.first_purchase_date && h.sector)
        .sort(
          (/** @type {any} */ a, /** @type {any} */ b) =>
            new Date(b.first_purchase_date).getTime() - new Date(a.first_purchase_date).getTime(),
        );
      if (dated.length < 3) return null;

      const recent = dated.slice(0, 3);
      const shared = recent[0].sector;
      if (!recent.every((/** @type {any} */ h) => h.sector === shared)) return null;

      const top = sectors(ctx)[0];
      if (!top || top.name !== shared) return null;

      return {
        id: 'composition.recent-pile-in',
        category: 'composition',
        severity: 'risk',
        magnitude: clamp01(top.value / 100),
        text: `Your last three purchases - ${recent.map((/** @type {any} */ h) => h.ticker).join(', ')} - were all ${shared}, which is already your largest sector at ${pct(top.value, 0)}.`,
        why: 'Buying into what is already the biggest position is how concentration builds without a decision ever being made to concentrate.',
        evidence: recent.map((/** @type {any} */ h) => ({
          label: h.ticker,
          value: h.first_purchase_date,
        })),
        action: rebalanceTarget,
      };
    },
  },
  {
    id: 'composition.new-and-largest',
    category: 'composition',
    /** @param {any} ctx */
    build(ctx) {
      const total = bookTotal(ctx.holdings);
      const top = byValue(ctx.holdings)[0];
      if (!total || !top) return null;
      const age = daysSince(top.first_purchase_date);
      if (age === null || age > RECENT_PURCHASE_DAYS) return null;

      const share = ((num(top.value) ?? 0) / total) * 100;
      return {
        id: 'composition.new-and-largest',
        category: 'composition',
        severity: 'risk',
        magnitude: clamp01(share / 100),
        text: `${top.ticker} was bought ${age} day${age === 1 ? '' : 's'} ago and is already your largest position at ${pct(share, 0)}.`,
        why: 'A position that reached the top of the book that fast got there by size of purchase, not by growth - worth checking it was the intended size.',
        evidence: [
          { label: 'First bought', value: top.first_purchase_date },
          { label: 'Days held', value: String(age) },
          { label: 'Share of book', value: pct(share, 1) },
        ],
        action: holdingsTable,
      };
    },
  },
];

const performance = [
  {
    id: 'perf.vs-benchmark',
    category: 'performance',
    /** @param {any} ctx */
    build(ctx) {
      const gap = benchmarkGapTrend(ctx.perfSeries ?? [], 0);
      if (!gap || Math.abs(gap.nowPct) < BENCHMARK_GAP_PCT) return null;
      const ahead = gap.nowPct > 0;
      const label = ctx.benchmarkLabel ?? 'the benchmark';

      return {
        id: ahead ? 'perf.ahead-of-benchmark' : 'perf.behind-benchmark',
        category: 'performance',
        severity: ahead ? 'opportunity' : 'risk',
        magnitude: clamp01(Math.abs(gap.nowPct) / 20),
        text: `You are ${pct(Math.abs(gap.nowPct))} ${ahead ? 'ahead of' : 'behind'} the ${label} over the full history shown.`,
        why: 'Measured on the time-weighted index, so deposits and withdrawals are taken out and the comparison is like for like.',
        evidence: [
          { label: 'Gap', value: `${gap.nowPct > 0 ? '+' : ''}${pct(gap.nowPct)}` },
          { label: 'Benchmark', value: String(label) },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'perf.gap-trend',
    category: 'performance',
    /** @param {any} ctx */
    build(ctx) {
      const gap = benchmarkGapTrend(ctx.perfSeries ?? [], MIN_HISTORY_DAYS);
      if (!gap) return null;
      const shift = gap.nowPct - gap.thenPct;
      if (Math.abs(shift) < GAP_SHIFT_PCT) return null;

      return {
        id: 'perf.gap-trend',
        category: 'performance',
        severity: shift > 0 ? 'opportunity' : 'risk',
        magnitude: clamp01(Math.abs(shift) / 10),
        text: `Your gap to the benchmark moved ${pct(Math.abs(shift))} ${shift > 0 ? 'in your favour' : 'against you'} over the last ${MIN_HISTORY_DAYS} trading days shown, from ${pct(gap.thenPct)} to ${pct(gap.nowPct)}.`,
        why: `Both figures are measured from the same start of the series, so this is the gap changing rather than the market moving.`,
        evidence: [
          { label: `${MIN_HISTORY_DAYS} trading days ago`, value: pct(gap.thenPct) },
          { label: 'Now', value: pct(gap.nowPct) },
          { label: 'Change', value: `${shift > 0 ? '+' : ''}${pct(shift)}` },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'perf.moving-average',
    category: 'performance',
    /** @param {any} ctx */
    build(ctx) {
      const ma = versusMovingAverage(ctx.perfSeries ?? [], MA_WINDOW);
      if (!ma || Math.abs(ma.distancePct) < 1) return null;

      return {
        id: 'perf.moving-average',
        category: 'performance',
        severity: 'neutral',
        magnitude: clamp01(Math.abs(ma.distancePct) / 15),
        text: `Your portfolio index is ${pct(Math.abs(ma.distancePct))} ${ma.above ? 'above' : 'below'} its ${MA_WINDOW}-day average.`,
        why: `The ${MA_WINDOW}-day average smooths out single days. Sitting above or below it says which way the medium-term trend has been running, not what happens next.`,
        evidence: [
          { label: 'Index now', value: ma.latest.toFixed(2) },
          { label: `${MA_WINDOW}-day average`, value: ma.average.toFixed(2) },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'perf.streak',
    category: 'performance',
    /** @param {any} ctx */
    build(ctx) {
      const series = ctx.perfSeries ?? [];
      const returns = dailyReturnsFromIndex(series);
      if (!returns || returns.length < 14) return null;

      const weeks = [];
      for (let i = returns.length; i > 0; i -= 5) {
        const slice = returns.slice(Math.max(0, i - 5), i);
        if (slice.length < 5) break;
        weeks.unshift(slice.reduce((acc, r) => acc * (1 + r), 1) - 1);
      }
      if (weeks.length < 2) return null;

      const direction = weeks[weeks.length - 1] >= 0 ? 1 : -1;
      let streak = 0;
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (Math.sign(weeks[i] || 1) !== direction) break;
        streak++;
      }
      if (streak < 3) return null;

      const cumulative = weeks.slice(-streak).reduce((acc, w) => acc * (1 + w), 1) - 1;
      return {
        id: 'perf.streak',
        category: 'performance',
        severity: direction > 0 ? 'opportunity' : 'risk',
        magnitude: clamp01(streak / 8),
        text: `${streak} consecutive ${direction > 0 ? 'up' : 'down'} weeks, ${pct(cumulative * 100)} in total over that run.`,
        why: 'Weeks are five trading days off the time-weighted index. A run says what has happened, not what happens next.',
        evidence: [
          { label: 'Consecutive weeks', value: String(streak) },
          { label: 'Total over the run', value: `${cumulative > 0 ? '+' : ''}${pct(cumulative * 100)}` },
        ],
        action: performanceTarget,
      };
    },
  },
];

const contributions = [
  {
    id: 'contrib.deposits-vs-growth',
    category: 'contributions',
    /** @param {any} ctx */
    build(ctx) {
      const series = ctx.contributionSeries ?? [];
      if (series.length < 2) return null;
      const last = series[series.length - 1];
      const net = num(last.cumulative_net_contributions);
      const gain = num(last.cumulative_market_gain);
      if (net === null || gain === null) return null;

      const growth = net + gain;
      if (growth <= 0 || gain <= 0) return null;
      const depositShare = (net / growth) * 100;

      return {
        id: 'contrib.deposits-vs-growth',
        category: 'contributions',
        severity: 'neutral',
        magnitude: clamp01(Math.abs(depositShare - 50) / 50),
        text: `${pct(depositShare, 0)} of your portfolio's value is money you put in; the other ${pct(100 - depositShare, 0)} is market gain.`,
        why: 'A portfolio can grow because it is being fed rather than because it is performing. Splitting the two is the difference between saving well and investing well.',
        evidence: [
          { label: 'Net contributions', value: zar(net) },
          { label: 'Market gain', value: zar(gain) },
          { label: 'Portfolio value', value: zar(num(last.portfolio_value) ?? growth) },
        ],
        action: performanceTarget,
      };
    },
  },
];

const drawdown = [
  {
    id: 'drawdown.current',
    category: 'drawdown',
    /** @param {any} ctx */
    build(ctx) {
      const dd = currentDrawdown(ctx.perfSeries ?? []);
      if (!dd || dd.pct > -DRAWDOWN_TRIGGER_PCT) return null;

      const days = dd.daysSincePeak;
      return {
        id: 'drawdown.current',
        category: 'drawdown',
        severity: 'risk',
        magnitude: clamp01(Math.abs(dd.pct) / 40),
        text: `You are ${pct(Math.abs(dd.pct))} below your peak${days ? `, which was ${days} days ago` : ''}.`,
        why: 'Measured off the time-weighted index, so this is a fall in what the money did rather than a withdrawal.',
        evidence: [
          { label: 'Below peak', value: pct(dd.pct) },
          ...(days ? [{ label: 'Days since peak', value: String(days) }] : []),
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'drawdown.max',
    category: 'drawdown',
    /** @param {any} ctx */
    build(ctx) {
      const dd = maxDrawdown(ctx.perfSeries ?? []);
      if (!dd || Math.abs(dd.pct) < DRAWDOWN_TRIGGER_PCT) return null;

      return {
        id: 'drawdown.max',
        category: 'drawdown',
        severity: dd.recovered ? 'neutral' : 'risk',
        magnitude: clamp01(Math.abs(dd.pct) / 40),
        text: `Your worst fall over this history was ${pct(Math.abs(dd.pct))}, and it has ${dd.recovered ? 'since recovered' : 'not recovered'}.`,
        why: 'The largest peak-to-trough fall in the period. It is the number worth knowing before deciding what size of fall you can sit through.',
        evidence: [
          { label: 'Worst fall', value: pct(dd.pct) },
          ...(dd.peakDate ? [{ label: 'From', value: dd.peakDate }] : []),
          ...(dd.troughDate ? [{ label: 'To', value: dd.troughDate }] : []),
        ],
        action: performanceTarget,
      };
    },
  },
];

const volatility = [
  {
    id: 'vol.vs-benchmark',
    category: 'volatility',
    /** @param {any} ctx */
    build(ctx) {
      const series = ctx.perfSeries ?? [];
      const mine = annualisedVolatility(dailyReturnsFromIndex(series));
      const theirs = annualisedVolatility(dailyReturnsFromIndex(series, 'benchmark'));
      if (mine === null || theirs === null || theirs === 0) return null;

      const ratio = mine / theirs;
      if (ratio > 0.85 && ratio < 1.15) return null;

      return {
        id: 'vol.vs-benchmark',
        category: 'volatility',
        severity: ratio > 1 ? 'risk' : 'opportunity',
        magnitude: clamp01(Math.abs(ratio - 1)),
        text: `Your portfolio's volatility is ${pct(mine)} a year against the ${ctx.benchmarkLabel ?? 'benchmark'}'s ${pct(theirs)} - ${ratio > 1 ? 'a bumpier' : 'a smoother'} ride.`,
        why: 'Annualised standard deviation of daily returns, both computed off the same series so the comparison is fair.',
        evidence: [
          { label: 'Your volatility', value: pct(mine) },
          { label: 'Benchmark volatility', value: pct(theirs) },
          { label: 'Ratio', value: `${ratio.toFixed(2)}x` },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'vol.recent-shift',
    category: 'volatility',
    /** @param {any} ctx */
    build(ctx) {
      const series = ctx.perfSeries ?? [];
      if (series.length < VOL_WINDOW_DAYS + 2) return null;
      const full = annualisedVolatility(dailyReturnsFromIndex(series));
      const recent = annualisedVolatility(dailyReturnsFromIndex(series.slice(-VOL_WINDOW_DAYS)));
      if (full === null || recent === null || full === 0) return null;

      const ratio = recent / full;
      if (ratio < VOL_SHIFT_RATIO && ratio > 1 / VOL_SHIFT_RATIO) return null;

      return {
        id: 'vol.recent-shift',
        category: 'volatility',
        severity: ratio > 1 ? 'risk' : 'neutral',
        magnitude: clamp01(Math.abs(ratio - 1) / 2),
        text: `The last ${VOL_WINDOW_DAYS} days have been ${ratio > 1 ? 'choppier' : 'calmer'} than usual: ${pct(recent)} annualised against ${pct(full)} over the full period.`,
        why: 'Same calculation over two windows. A shift this size usually means something changed in the book or in the market, not in the maths.',
        evidence: [
          { label: `Last ${VOL_WINDOW_DAYS} days`, value: pct(recent) },
          { label: 'Full period', value: pct(full) },
        ],
        action: performanceTarget,
      };
    },
  },
];

const winnersLosers = [
  {
    id: 'wl.best-worst',
    category: 'winners_losers',
    /** @param {any} ctx */
    build(ctx) {
      const rated = ctx.holdings.filter((/** @type {any} */ h) => num(h.gain_loss_pct) !== null);
      if (rated.length < 2) return null;
      const sorted = [...rated].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      return {
        id: 'wl.best-worst',
        category: 'winners_losers',
        severity: 'neutral',
        magnitude: clamp01(Math.abs(best.gain_loss_pct - worst.gain_loss_pct) / 100),
        text: `${best.ticker} is your best position at ${pct(best.gain_loss_pct)} and ${worst.ticker} your worst at ${pct(worst.gain_loss_pct)} - a spread of ${(best.gain_loss_pct - worst.gain_loss_pct).toFixed(0)} percentage points.`,
        why: 'Percentage gain since purchase, so a position bought recently is judged on the same basis as one held for years.',
        evidence: [
          { label: best.ticker, value: pct(best.gain_loss_pct) },
          { label: worst.ticker, value: pct(worst.gain_loss_pct) },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'wl.percent-vs-rands',
    category: 'winners_losers',
    /** @param {any} ctx */
    build(ctx) {
      const rated = ctx.holdings.filter(
        (/** @type {any} */ h) => num(h.gain_loss_pct) !== null && num(h.gain_loss) !== null,
      );
      if (rated.length < 2) return null;

      const byPct = [...rated].sort((a, b) => b.gain_loss_pct - a.gain_loss_pct)[0];
      const byRand = [...rated].sort((a, b) => b.gain_loss - a.gain_loss)[0];
      if (byPct.ticker === byRand.ticker || byPct.gain_loss <= 0 || byRand.gain_loss <= 0) {
        return null;
      }

      return {
        id: 'wl.percent-vs-rands',
        category: 'winners_losers',
        severity: 'neutral',
        magnitude: clamp01((byRand.gain_loss - byPct.gain_loss) / Math.max(byRand.gain_loss, 1)),
        text: `${byPct.ticker} is your best performer at ${pct(byPct.gain_loss_pct)}, but ${byRand.ticker} has made you more money - ${zar(byRand.gain_loss)} against ${zar(byPct.gain_loss)}.`,
        why: 'Percentage return and Rand return answer different questions. A small position can top the percentage table while contributing very little to the book.',
        evidence: [
          { label: `${byPct.ticker} gain`, value: `${pct(byPct.gain_loss_pct)} · ${zar(byPct.gain_loss)}` },
          { label: `${byRand.ticker} gain`, value: `${pct(byRand.gain_loss_pct)} · ${zar(byRand.gain_loss)}` },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'wl.loss-offset',
    category: 'winners_losers',
    /** @param {any} ctx */
    build(ctx) {
      if (ctx.cgt?.available !== true) return null;
      const taxable = num(ctx.cgt.taxable_capital_gain);
      if (taxable === null || taxable <= 0) return null;

      const losers = ctx.holdings
        .filter((/** @type {any} */ h) => (num(h.gain_loss) ?? 0) < -LOSS_OFFSET_TRIGGER_ZAR)
        .sort((/** @type {any} */ a, /** @type {any} */ b) => a.gain_loss - b.gain_loss);
      if (!losers.length) return null;

      const worst = losers[0];
      return {
        id: 'wl.loss-offset',
        category: 'winners_losers',
        severity: 'opportunity',
        magnitude: clamp01(Math.abs(worst.gain_loss) / Math.max(taxable, 1)),
        text: `${worst.ticker} is down ${zar(Math.abs(worst.gain_loss))}, against an estimated ${zar(taxable)} of taxable gain if you sold everything today.`,
        why: 'A realised loss can be set against a realised gain in the same tax year. This is an arithmetic observation, not tax advice - EquityLens does not know your other disposals.',
        evidence: [
          { label: `${worst.ticker} unrealised loss`, value: zar(worst.gain_loss) },
          { label: 'Estimated taxable gain', value: zar(taxable) },
        ],
        action: holdingsTable,
      };
    },
  },
];

const risk = [
  {
    id: 'risk.weakest-subscore',
    category: 'risk',
    /** @param {any} ctx */
    build(ctx) {
      const subs = ctx.health?.subscores ?? [];
      const scored = subs.filter(
        (/** @type {any} */ s) => num(s.value) !== null && num(s.weight) !== null,
      );
      if (!scored.length || num(ctx.health?.score) === null) return null;

      const ranked = [...scored].sort(
        (a, b) => b.weight * (HEALTHY_SUBSCORE - b.value) - a.weight * (HEALTHY_SUBSCORE - a.value),
      );
      const worst = ranked[0];
      const cost = worst.weight * (HEALTHY_SUBSCORE - worst.value);
      if (cost <= 0) return null;

      return {
        id: 'risk.weakest-subscore',
        category: 'risk',
        severity: 'risk',
        magnitude: clamp01(cost / HEALTHY_SUBSCORE),
        text: `${worst.label} is costing your health score ${cost.toFixed(1)} points - more than any other factor. One point of improvement there would add ${worst.weight.toFixed(2)} to the composite.`,
        why: 'Ranked by weight multiplied by the distance from 10. A weak factor with a small weight matters less than a middling one carrying most of the score.',
        evidence: [
          { label: `${worst.label} score`, value: `${worst.value.toFixed(1)} / 10` },
          { label: 'Weight', value: pct(worst.weight * 100, 0) },
          { label: 'Points forgone', value: `${worst.weight.toFixed(2)} x ${(HEALTHY_SUBSCORE - worst.value).toFixed(1)} = ${cost.toFixed(1)}` },
        ],
        action: healthTarget,
      };
    },
  },
];

const tax = [
  {
    id: 'tax.cgt-estimate',
    category: 'tax',
    /** @param {any} ctx */
    build(ctx) {
      if (ctx.cgt?.available !== true) return null;
      const taxable = num(ctx.cgt.taxable_capital_gain);
      if (taxable === null || taxable < CGT_TRIGGER_ZAR) return null;

      return {
        id: 'tax.cgt-estimate',
        category: 'tax',
        severity: 'info',
        magnitude: clamp01(taxable / 100000),
        text: `Selling everything today would put an estimated ${zar(taxable)} of taxable capital gain on your return.`,
        why: `Estimated on ${ctx.cgt.assumptions?.cost_basis_method ?? 'average cost'} with the ${ctx.cgt.assumptions?.tax_year ?? 'current'} annual exclusion already applied. It is an estimate for planning, not a tax calculation.`,
        evidence: [
          { label: 'Taxable gain', value: zar(taxable) },
          ...(num(ctx.cgt.net_unrealised_gain) !== null
            ? [{ label: 'Net unrealised gain', value: zar(ctx.cgt.net_unrealised_gain) }]
            : []),
        ],
        action: null,
      };
    },
  },
  {
    id: 'tax.tfsa-room',
    category: 'tax',
    /** @param {any} ctx */
    build(ctx) {
      if (ctx.accountType !== 'tfsa') return null;
      const contributed = num(ctx.returns?.net_contributions);
      if (contributed === null || contributed <= 0) return null;

      return {
        id: 'tax.tfsa-room',
        category: 'tax',
        severity: 'info',
        magnitude: 0.4,
        text: `This is a tax-free account and ${zar(contributed)} of contributions have gone into it.`,
        why: 'Tax-free allowances are annual and lifetime, and over-contributing is penalised. The remaining room depends on contributions to any other tax-free accounts, which EquityLens cannot see.',
        evidence: [{ label: 'Net contributions', value: zar(contributed) }],
        action: null,
      };
    },
  },
];

const dataQuality = [
  {
    id: 'dq.no-live-prices',
    category: 'data_quality',
    /** @param {any} ctx */
    build(ctx) {
      const live = ctx.holdings.filter(
        (/** @type {any} */ h) => num(h.daily_change_pct) !== null,
      ).length;
      if (live > 0 || !ctx.holdings.length) return null;

      return {
        id: 'dq.no-live-prices',
        category: 'data_quality',
        severity: 'info',
        magnitude: 0.3,
        text: "Today's price moves aren't available right now, so your figures are shown at your statement's closing prices.",
        why: "Live pricing is temporarily unavailable. Position sizes, sector weights and Portfolio Health are unaffected - only today's movement is.",
        evidence: [
          { label: 'Holdings with a live move', value: `0 of ${ctx.holdings.length}` },
        ],
        action: null,
      };
    },
  },
  {
    id: 'dq.priced-at-cost',
    category: 'data_quality',
    /** @param {any} ctx */
    build(ctx) {
      const count = num(ctx.returns?.holdings_count);
      const live = num(ctx.returns?.priced_live_count);
      if (count === null || live === null || live >= count || count === 0) return null;

      const stale = count - live;
      return {
        id: 'dq.priced-at-cost',
        category: 'data_quality',
        severity: 'info',
        magnitude: clamp01(stale / count),
        text: `${stale} of your ${count} holdings ${stale === 1 ? 'is' : 'are'} valued at cost rather than a live price.`,
        why: 'A holding with no live quote is carried at what you paid for it, so its gain reads as zero and the book total is understated by whatever it has actually moved.',
        evidence: [
          { label: 'Priced live', value: `${live} of ${count}` },
          { label: 'At cost', value: String(stale) },
        ],
        action: holdingsTable,
      };
    },
  },
  {
    id: 'dq.stale-statement',
    category: 'data_quality',
    /** @param {any} ctx */
    build(ctx) {
      const age = daysSince(ctx.statementDate);
      if (age === null || age < STALE_STATEMENT_DAYS) return null;

      return {
        id: 'dq.stale-statement',
        category: 'data_quality',
        severity: 'info',
        magnitude: clamp01(age / 365),
        text: `Your last imported statement is ${age} days old, so any position you have opened or closed since then is missing.`,
        why: 'Quantities and cost bases come from the statement. Prices refresh on their own; the list of what you hold does not.',
        evidence: [
          { label: 'Statement date', value: String(ctx.statementDate) },
          { label: 'Age', value: `${age} days` },
        ],
        action: { label: 'Import a statement', to: '/portfolio' },
      };
    },
  },
  {
    id: 'dq.short-history',
    category: 'data_quality',
    /** @param {any} ctx */
    build(ctx) {
      const days = num(ctx.returns?.history_days);
      if (days === null || days === 0 || days >= MIN_HISTORY_DAYS) return null;

      return {
        id: 'dq.short-history',
        category: 'data_quality',
        severity: 'info',
        magnitude: clamp01(1 - days / MIN_HISTORY_DAYS),
        text: `There are only ${days} day${days === 1 ? '' : 's'} of history, which is too short for a benchmark comparison to mean much.`,
        why: `Return and volatility figures need roughly ${MIN_HISTORY_DAYS} days before they settle. Until then a single day's move dominates them.`,
        evidence: [
          { label: 'History', value: `${days} days` },
          { label: 'Useful from', value: `${MIN_HISTORY_DAYS} days` },
        ],
        action: null,
      };
    },
  },
];

const UNUSUAL_WINDOW_DAYS = 30;
const VOL_GAP_RATIO = 1.25;

/** @param {any} ctx */
const eventList = (ctx) => (Array.isArray(ctx.events?.events) ? ctx.events.events : []);

/** @param {any} ctx */
const divergenceList = (ctx) =>
  (Array.isArray(ctx.events?.divergences) ? ctx.events.divergences : []);

/** @param {string} iso */
const daysAgo = (iso) => {
  const then = new Date(iso).getTime();
  return Number.isNaN(then) ? null : Math.round((Date.now() - then) / MS_PER_DAY);
};

/** @param {string} iso */
const eventDate = (iso) => {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
};

const events = [
  {
    id: 'events.unusual-movement',
    category: 'unusual_movement',
    /** @param {any} ctx */
    build(ctx) {
      const recent = eventList(ctx).filter((/** @type {any} */ e) => {
        const age = daysAgo(e.date);
        return age !== null && age <= UNUSUAL_WINDOW_DAYS;
      });
      if (!recent.length) return null;

      const worst = recent.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
        Math.abs(b.z_score) > Math.abs(a.z_score) ? b : a);
      const vol = num(worst.annualised_volatility_pct);
      if (num(worst.z_score) === null || num(worst.return_pct) === null || vol === null) return null;

      return {
        id: 'events.unusual-movement',
        category: 'unusual_movement',
        severity: 'risk',
        magnitude: clamp01((Math.abs(worst.z_score) - 3) / 4),
        text: `${worst.ticker} ${worst.direction === 'down' ? 'fell' : 'rose'} ${pct(Math.abs(worst.return_pct))} on ${eventDate(worst.date)} - a ${Math.abs(worst.z_score).toFixed(1)} sigma move against its own volatility.`,
        why: 'Measured against an exponentially weighted volatility built only from the days before the move, so the move itself does not inflate the yardstick it is judged by.',
        evidence: [
          { label: 'Move', value: pct(worst.return_pct) },
          { label: 'Standard deviations', value: Math.abs(worst.z_score).toFixed(2) },
          { label: 'Its volatility', value: `${pct(vol)} a year` },
          { label: 'Days measured', value: String(worst.observations ?? 0) },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'events.benchmark-divergence',
    category: 'performance',
    /** @param {any} ctx */
    build(ctx) {
      const recent = divergenceList(ctx).filter((/** @type {any} */ d) => {
        const age = daysAgo(d.date);
        return age !== null && age <= UNUSUAL_WINDOW_DAYS;
      });
      if (!recent.length) return null;

      const worst = recent.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
        Math.abs(b.z_score) > Math.abs(a.z_score) ? b : a);

      const gap = num(worst.relative_return_pct);
      const mine = num(worst.portfolio_return_pct);
      const theirs = num(worst.benchmark_return_pct);
      const vol = num(worst.annualised_volatility_pct);
      const z = num(worst.z_score);
      if (gap === null || mine === null || theirs === null || vol === null || z === null) return null;

      const label = ctx.benchmarkLabel ?? 'the benchmark';
      const way = worst.direction === 'behind' ? 'behind' : 'ahead of';

      return {
        id: 'events.benchmark-divergence',
        category: 'performance',
        severity: 'neutral',
        magnitude: clamp01((Math.abs(z) - 3) / 4),
        text: `Your portfolio moved ${pct(Math.abs(gap))} ${way} the ${label} on ${eventDate(worst.date)} - you returned ${pct(mine)} that day and it returned ${pct(theirs)}.`,
        why: `Your holdings and the ${label} normally move together, so the gap between them on any given day is small. This day it was not, which points at something in your own book rather than at the market.`,
        evidence: [
          { label: 'Your return', value: pct(mine) },
          { label: label, value: pct(theirs) },
          { label: 'Gap', value: pct(gap) },
          { label: 'Standard deviations', value: Math.abs(z).toFixed(2) },
          { label: 'Its volatility', value: `${pct(vol)} a year` },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'events.holding-volatility',
    category: 'volatility',
    /** @param {any} ctx */
    build(ctx) {
      const scanned = ctx.events?.coverage?.holdings ?? [];
      const rated = scanned.filter((/** @type {any} */ h) => num(h.annualised_volatility_pct) !== null);
      if (!rated.length) return null;

      const mine = annualisedVolatility(dailyReturnsFromIndex(ctx.perfSeries ?? []));
      if (mine === null || mine === 0) return null;

      const worst = rated.reduce((/** @type {any} */ a, /** @type {any} */ b) =>
        b.annualised_volatility_pct > a.annualised_volatility_pct ? b : a);
      const ratio = worst.annualised_volatility_pct / mine;
      if (ratio < VOL_GAP_RATIO) return null;

      return {
        id: 'events.holding-volatility',
        category: 'volatility',
        severity: 'neutral',
        magnitude: clamp01((ratio - 1) / 3),
        text: `${worst.ticker} is your bumpiest holding at ${pct(worst.annualised_volatility_pct)} a year, against ${pct(mine)} for the portfolio as a whole.`,
        why: 'Holding a few volatile positions is not the same as a volatile portfolio - the rest of the book absorbs some of it. This is where the movement is coming from.',
        evidence: [
          { label: worst.ticker, value: `${pct(worst.annualised_volatility_pct)} a year` },
          { label: 'Portfolio', value: `${pct(mine)} a year` },
          { label: 'Ratio', value: `${ratio.toFixed(2)}x` },
        ],
        action: performanceTarget,
      };
    },
  },
  {
    id: 'events.event-study',
    category: 'event_study',
    /** @param {any} ctx */
    build(ctx) {
      const studied = ctx.eventStudy;
      if (!studied?.available) return null;

      const window = studied.abnormal_returns ?? [];
      const last = window[window.length - 1];
      if (!last || num(last.cumulative_abnormal_return_pct) === null) return null;
      if (!last.significant) return null;

      const car = last.cumulative_abnormal_return_pct;
      return {
        id: 'events.event-study',
        category: 'event_study',
        severity: 'risk',
        magnitude: clamp01(Math.abs(car) / 20),
        text: `${studied.ticker} was still ${pct(Math.abs(car))} ${car < 0 ? 'behind' : 'ahead of'} where its relationship to the ${studied.benchmark_label ?? 'benchmark'} put it, ten days after ${eventDate(studied.date)}.`,
        why: 'A market model fitted on the hundred trading days before the event predicts what this holding does on a given market day. This is what it did beyond that, and it sits outside the 95% band around the prediction.',
        evidence: [
          { label: 'Cumulative abnormal return', value: pct(car) },
          { label: '95% band', value: `${pct(last.car_lower_pct)} to ${pct(last.car_upper_pct)}` },
          { label: 'Beta', value: studied.beta?.toFixed(2) ?? '-' },
          { label: 'R squared', value: studied.r_squared?.toFixed(2) ?? '-' },
        ],
        action: performanceTarget,
      };
    },
  },
];

export const TEMPLATES = [
  ...concentration,
  ...sector,
  ...composition,
  ...performance,
  ...contributions,
  ...drawdown,
  ...volatility,
  ...winnersLosers,
  ...risk,
  ...tax,
  ...dataQuality,
  ...events,
];

/** @type {Record<string, number>} */
export const SEVERITY_RANK = { risk: 0, opportunity: 1, neutral: 2, info: 3 };
