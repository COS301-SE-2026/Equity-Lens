const TRADING_DAYS = 252;
const MS_PER_DAY = 86400000;

/** @param {any} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @param {{ value?: number|null }[]} holdings
 */
export function bookTotal(holdings) {
  if (!Array.isArray(holdings)) return 0;
  return holdings.reduce((sum, h) => sum + (num(h.value) ?? 0), 0);}

/**
 * @param {any} value
 * @param {any} total
 * @returns {number | null}
 */
export function shareOfBook(value, total) {
  const v = num(value);
  const t = num(total);
  if (v === null || t === null || t <= 0) return null;
  return (v / t) * 100;}

/**
 * @param {{ date?: string, value?: number, twr_index?: number, benchmark?: number }[]} series
 * @param {string} [key]
 */
export function seriesKey(series, key) {
  if (key) return key;
  return series.some((p) => num(p.twr_index) !== null) ? 'twr_index' : 'value';}

/**
 * @param {Record<string, any>[]} series
 * @param {string} [key]
 * @returns {number[] | null} decimal returns, not percentages
 */
export function dailyReturnsFromIndex(series, key) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const field = seriesKey(series, key);

  const returns = [];
  for (let i = 1; i < series.length; i++) {
    const prev = num(series[i - 1][field]);
    const now = num(series[i][field]);
    if (prev === null || now === null || prev === 0) continue;
    returns.push((now - prev) / prev);
  }
  return returns.length ? returns : null;}

/**
 * @param {number[] | null} returns
 * @returns {number | null} percentage points
 */
export function annualisedVolatility(returns) {
  if (!returns || returns.length < 2) return null;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS) * 100;}

/**
 * @param {Record<string, any>[]} series
 * @param {string} [key]
 * @returns {{ pct: number, peakDate: string | null, troughDate: string | null, recovered: boolean } | null}
 */
export function maxDrawdown(series, key) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const field = seriesKey(series, key);
  let peak = null;
  let peakDate = null;
  let worst = { pct: 0, peakDate: null, troughDate: null };

  for (const point of series) {
    const v = num(point[field]);
    if (v === null || v <= 0) continue;
    if (peak === null || v > peak) {
      peak = v;
      peakDate = point.date ?? null;
      continue;}
    const fall = ((v - peak) / peak) * 100;
    if (fall < worst.pct) worst = { pct: fall, peakDate, troughDate: point.date ?? null };}

  if (worst.pct === 0) return null;

  const troughIndex = series.findIndex((p) => (p.date ?? null) === worst.troughDate);
  const peakValue = num(series.find((p) => (p.date ?? null) === worst.peakDate)?.[field]);
  const recovered =
    troughIndex >= 0 && peakValue !== null
      ? series.slice(troughIndex + 1).some((p) => (num(p[field]) ?? 0) >= peakValue)
      : false;

  return { ...worst, recovered };}

/**
 * @param {Record<string, any>[]} series
 * @param {string} [key]
 * @returns {{ pct: number, peakDate: string | null, daysSincePeak: number | null } | null}
 */
export function currentDrawdown(series, key) {
  if (!Array.isArray(series) || series.length < 2) return null;
  const field = seriesKey(series, key);

  let peak = null;
  let peakDate = null;
  for (const point of series) {
    const v = num(point[field]);
    if (v === null || v <= 0) continue;
    if (peak === null || v > peak) {
      peak = v;
      peakDate = point.date ?? null;}}

  const last = [...series].reverse().find((p) => num(p[field]) !== null);
  const latest = last ? num(last[field]) : null;
  if (peak === null || latest === null) return null;

  const pct = ((latest - peak) / peak) * 100;
  const daysSincePeak =
    peakDate && last?.date
      ? Math.round((new Date(last.date).getTime() - new Date(peakDate).getTime()) / MS_PER_DAY)
      : null;

  return { pct, peakDate, daysSincePeak };}

/**
 * @param {Record<string, any>[]} series
 * @param {number} pointsBack
 * @returns {{ nowPct: number, thenPct: number, widening: boolean } | null}
 */
export function benchmarkGapTrend(series, pointsBack) {
  if (!Array.isArray(series) || series.length < pointsBack + 1) return null;
  const field = seriesKey(series);

  /** @param {Record<string, any>} start @param {Record<string, any>} end */
  const gap = (start, end) => {
    const p0 = num(start[field]);
    const p1 = num(end[field]);
    const b0 = num(start.benchmark);
    const b1 = num(end.benchmark);
    if (p0 === null || p1 === null || b0 === null || b1 === null || !p0 || !b0) return null;
    return ((p1 - p0) / p0) * 100 - ((b1 - b0) / b0) * 100;};

  const start = series[0];
  const nowPct = gap(start, series[series.length - 1]);
  const thenPct = gap(start, series[series.length - 1 - pointsBack]);
  if (nowPct === null || thenPct === null) return null;

  return { nowPct, thenPct, widening: Math.abs(nowPct) > Math.abs(thenPct) };}

/**
 * @param {Record<string, any>[]} series
 * @param {string | undefined} key
 * @param {number} window
 * @returns {(number | null)[] | null}
 */
export function movingAverage(series, key, window) {
  if (!Array.isArray(series) || series.length < window || window < 1) return null;
  const field = seriesKey(series, key);

  return series.map((_, i) => {
    if (i < window - 1) return null;
    const slice = series.slice(i - window + 1, i + 1).map((p) => num(p[field]));
    if (slice.some((v) => v === null)) return null;
    return /** @type {number[]} */ (slice).reduce((sum, v) => sum + v, 0) / window;
  });}

/**
 * @param {Record<string, any>[]} series
 * @param {number} window
 * @param {string} [key]
 * @returns {{ above: boolean, latest: number, average: number, distancePct: number } | null}
 */
export function versusMovingAverage(series, window, key) {
  const averages = movingAverage(series, key, window);
  if (!averages) return null;

  const field = seriesKey(series, key);
  const average = averages[averages.length - 1];
  const latest = num(series[series.length - 1][field]);
  if (average === null || latest === null || average === 0) return null;

  return {
    above: latest >= average,
    latest,
    average,
    distancePct: ((latest - average) / average) * 100,};}

/**
 * @template {{ value?: number, benchmark?: number }} T
 * @param {T[]} series
 * @returns {T[]}
 */
export function rebaseBenchmarkToSlice(series) {
  if (!Array.isArray(series) || series.length === 0) return series;

  const first = series.find((row) => num(row.value) !== null && num(row.benchmark) !== null);
  const portfolio = num(first?.value);
  const benchmark = num(first?.benchmark);
  if (portfolio === null || !benchmark) return series;

  const scale = portfolio / benchmark;
  if (scale === 1) return series;

  return series.map((row) => {
    const value = num(row.benchmark);
    return value === null ? row : { ...row, benchmark: value * scale };
  });}

/**
 * @param {Record<string, any>[]} visible
 * @param {{ ticker: string, points?: { date: string, close: number }[] }[]} holdings
 * @returns {Record<string, (number | null)[]>}
 */
function fillDownRange(visible, holdings) {
  /** @type {Record<string, (number | null)[]>} */
  const filled = {};
  for (const h of holdings) {
    const lookup = new Map((h.points ?? []).map((p) => [p.date, num(p.close)]));
    let carried = /** @type {number | null} */ (null);
    filled[h.ticker] = visible.map((row) => {
      const today = lookup.get(row.date) ?? null;
      if (today !== null) carried = today;
      return carried;
    });
  }
  return filled;}

/** @param {(number | null)[]} values */
const firstRealValue = (values) => values.find((v) => v !== null && v !== 0) ?? null;

/**
 * @param {Record<string, any>[]} visible portfolio rows already filtered to the chosen range
 * @param {{ ticker: string, points?: { date: string, close: number }[] }[]} holdingSeries
 * @param {{ id: string, name: string, members: { ticker: string, value: number, currentPrice?: number }[] }[]} groups
 * @returns {{
 *   columns: Record<string, (number | null)[]>,
 *   drawn: string[],
 *   undrawn: Record<string, string[]>,
 *   weightBasis: Record<string, 'start'|'current'>,
 * }}
 */
export function buildGroupSeries(visible, holdingSeries = [], groups = []) {
  /** @type {Record<string, (number | null)[]>} */
  const columns = {};
  /** @type {string[]} */
  const drawn = [];
  /** @type {Record<string, string[]>} */
  const undrawn = {};
  /** @type {Record<string, 'start'|'current'>} */
  const weightBasis = {};
  if (!Array.isArray(visible) || visible.length === 0) {
    return { columns, drawn, undrawn, weightBasis };
  }

  const filled = fillDownRange(visible, holdingSeries);

  for (const group of groups) {
    const members = group.members ?? [];
    undrawn[group.id] = members
      .filter((m) => firstRealValue(filled[m.ticker] ?? []) === null)
      .map((m) => m.ticker);

    const priced = members
      .map((m) => ({ ...m, series: filled[m.ticker] ?? [] }))
      .map((m) => ({ ...m, base: firstRealValue(m.series) }))
      .filter((m) => m.base !== null);
    const weightAt = (/** @type {any} */ m) => {
      const price = num(m.currentPrice) ?? 0;
      if (price <= 0) return null;
      return ((num(m.value) ?? 0) / price) * /** @type {number} */ (m.base);
    };

    const startWeighted = priced.map((m) => ({ ...m, weight: weightAt(m) }));
    const usable = startWeighted.filter((m) => m.weight !== null);
    const basis = usable.length === priced.length ? 'start' : 'current';
    const weighted = basis === 'start'
      ? usable
      : priced.map((m) => ({ ...m, weight: num(m.value) ?? 0 }));

    const totalWeight = weighted.reduce((sum, m) => sum + (m.weight ?? 0), 0);
    if (weighted.length === 0 || totalWeight <= 0) continue;
    weightBasis[group.id] = basis;

    columns[group.id] = visible.map((_row, i) => {
      let index = 0;
      for (const m of weighted) {
        const close = m.series[i];
        if (close === null) return null;
        index += ((m.weight ?? 0) / totalWeight) * (close / /** @type {number} */ (m.base));
      }
      return index * 100;
    });
    drawn.push(group.id);
  }

  return { columns, drawn, undrawn, weightBasis };
}

/**
 * @param {Record<string, any>[]} visible portfolio rows already filtered to the chosen range
 * @param {{ ticker: string, points: { date: string, close: number }[] }[]} [holdings]
 * @returns {{ rows: Record<string, any>[], baseDate: string | null, drawn: string[], undrawn: string[] }}
 */
export function rebaseForRange(visible, holdings = []) {
  if (!Array.isArray(visible) || visible.length === 0) {
    return { rows: [], baseDate: null, drawn: [], undrawn: holdings.map((h) => h.ticker) };
  }

  const portfolioKey = seriesKey(visible);
  const filled = fillDownRange(visible, holdings);
  const firstReal = firstRealValue;

  const portfolioValues = visible.map((row) => num(row[portfolioKey]));
  const benchmarkValues = visible.map((row) => num(row.benchmark));
  const portfolioBase = firstReal(portfolioValues);
  const benchmarkBase = firstReal(benchmarkValues);

  /** @type {Record<string, number | null>} */
  const bases = {};
  /** @type {string[]} */
  const drawn = [];
  /** @type {string[]} */
  const undrawn = [];
  for (const h of holdings) {
    const base = firstReal(filled[h.ticker]);
    bases[h.ticker] = base;
    (base === null ? undrawn : drawn).push(h.ticker);
  }

  /** @param {number | null} value @param {number | null} base */
  const indexed = (value, base) => (value === null || !base ? null : (value / base) * 100);

  const rows = visible.map((row, i) => {
    /** @type {Record<string, any>} */
    const out = {
      date: row.date,
      name: row.name,
      value: indexed(portfolioValues[i], portfolioBase),
      benchmark: indexed(benchmarkValues[i], benchmarkBase),
    };
    for (const ticker of drawn) out[ticker] = indexed(filled[ticker][i], bases[ticker]);
    return out;
  });

  return { rows, baseDate: visible[0].date ?? null, drawn, undrawn };
}
