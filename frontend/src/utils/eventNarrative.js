const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * @param {string} iso
 */
export function longDate(iso) {
  const [year, month, day] = String(iso ?? '').split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name || !day || !year) return String(iso ?? '');
  return `${Number(day)} ${name} ${year}`;
}

/**
 * @param {string} iso
 */
export function rowLabel(iso) {
  const [, month, day] = String(iso ?? '').split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name || !day) return String(iso ?? '');
  return `${name.slice(0, 3)} ${day}`;
}

/** @param {any} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** @param {number} n */
const signed = (n) => `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(1)}`;

/** @param {any} detail @param {number} offset */
const rowAt = (detail, offset) =>
  (detail?.abnormal_returns ?? []).find((/** @type {any} */ r) => r.offset === offset) ?? null;

/**
 * @param {any} event a row from /portfolio/events
 * @param {any} detail the /portfolio/events/{ticker}/{date} payload, or null before it loads
 * @returns {{
 *   headline: string,
 *   marketPart: string|null,
 *   companyPart: string|null,
 *   abnormalPart: string,
 *   confidence: string|null,
 *   tone: 'up'|'down',
 *   moveType: string,
 * }}
 */
export function buildEventNarrative(event, detail) {
  const ticker = event?.ticker ?? 'This holding';
  const fell = event?.direction === 'down';
  const move = Math.abs(num(event?.return_pct) ?? 0).toFixed(1);
  const headline = `${ticker} ${fell ? 'fell' : 'rose'} ${move}% on ${longDate(event?.date)}`;

  const z = Math.abs(num(event?.z_score) ?? 0).toFixed(1);
  const vol = (num(event?.annualised_volatility_pct) ?? 0).toFixed(1);
  const abnormalPart =
    `That is ${z} times ${ticker}'s own normal daily swing, measured against ` +
    `${vol}% a year over ${event?.observations} trading days.`;

  const base = {
    headline,
    marketPart: null,
    companyPart: null,
    abnormalPart,
    confidence: null,
    tone: /** @type {'up'|'down'} */ (fell ? 'down' : 'up'),
    moveType: detail?.move_type ?? 'unknown',
  };

  if (detail?.reason === 'benchmark_is_self') {
    const label = detail.benchmark_label ?? 'the benchmark';
    return {
      ...base,
      marketPart:
        `${ticker} tracks the ${label} - it is the yardstick, not something measured `
        + 'against it.',
      abnormalPart:
        `So this was the market moving ${move}%, not this holding moving on its own. It is `
        + `${z} times a normal day for the index, measured against ${vol}% a year over `
        + `${event?.observations} trading days.`,
      moveType: 'market',
    };
  }

  const eventDay = detail?.available ? rowAt(detail, 0) : null;
  if (!eventDay) return base;

  const beta = num(detail.beta);
  const market = num(eventDay.market_return_pct);
  const abnormal = num(eventDay.abnormal_return_pct);
  const label = detail.benchmark_label ?? 'the benchmark';

  const marketPart =
    beta === null || market === null
      ? null
      : `The ${label} moved ${signed(market)}% that day, and ${ticker} usually moves about ` +
        `${beta.toFixed(2)} times as much as the market, so roughly ${signed(beta * market)}% ` +
        'of the move was the market.';

  let companyPart =
    abnormal === null ? null : `The remaining ${signed(abnormal)}% was specific to ${ticker}.`;
  if (companyPart && detail.tracks_benchmark) {
    companyPart +=
      ` This fund exists to track the ${label}, so almost none of its movement is its own - `
      + 'that is the fund working as designed.';
  }

  return { ...base, marketPart, companyPart, confidence: buildConfidence(detail, label) };
}

/**
 * @param {any} detail
 * @param {string} label
 */
function buildConfidence(detail, label) {
  if (!num(detail?.residual_sigma)) return null;

  const rows = detail?.abnormal_returns ?? [];
  const last = rows[rows.length - 1];
  const car = num(last?.cumulative_abnormal_return_pct);
  const days = num(last?.offset);
  if (car === null || days === null || days <= 0) return null;

  const opening =
    `${days} trading day${days === 1 ? '' : 's'} later it was still ${signed(car)}% away from ` +
    `where its relationship to the ${label} put it, `;

  return last.significant
    ? `${opening}outside the range you would expect nineteen times out of twenty.`
    : `${opening}which is inside the range you would expect from ordinary variation.`;}

/**
 * @param {any} event
 * @param {any} detail
 * @returns {string}
 */
export function buildEventQuestion(event, detail) {
  const { headline } = buildEventNarrative(event, detail);
  const ticker = event?.ticker ?? 'this holding';
  const fell = event?.direction === 'down';

  const lines = [`${headline}.`];

  const eventDay = detail?.available ? rowAt(detail, 0) : null;
  if (eventDay) {
    const label = detail.benchmark_label ?? 'the benchmark';
    lines.push(
      `The ${label} moved ${signed(num(eventDay.market_return_pct) ?? 0)}% that day. ` +
        `Fitted against it over ${detail.observations} trading days, ${ticker} has a beta of ` +
        `${num(detail.beta)?.toFixed(2)} and an R-squared of ${num(detail.r_squared)?.toFixed(2)}, ` +
        `leaving an abnormal return of ${signed(num(eventDay.abnormal_return_pct) ?? 0)}%.`,
    );}

  lines.push(
    `The move was ${Math.abs(num(event?.z_score) ?? 0).toFixed(1)} standard deviations out, ` +
      `measured against an annualised volatility of ` +
      `${(num(event?.annualised_volatility_pct) ?? 0).toFixed(1)}% over ${event?.observations} ` +
      'trading days.',
  );

  lines.push(
    'Explain in plain language what this means for me as an investor, what kinds of ' +
      'company-specific news typically produce a move of this size, and ' +
      (fell
        ? 'what I could have done to reduce my exposure to a single-company shock like this.'
        : 'how a holding like this contributes when it runs.') +
      ' Do not state a specific cause; you have not been given one.',);

  return lines.join(' ');}

const TRADING_DAYS_PER_YEAR = 252;

/**
 * @param {any} detail
 * @returns {{ label: string, value: string, reading: string }[] | null}
 */
export function buildWorkingRows(detail) {
  if (!detail?.available) return null;

  const ticker = detail.ticker ?? 'this holding';
  const label = detail.benchmark_label ?? 'the benchmark';
  const beta = num(detail.beta);
  const alpha = num(detail.alpha);
  const r2 = num(detail.r_squared);
  if (beta === null || alpha === null || r2 === null) return null;

  const annualPct = ((Math.exp(alpha * TRADING_DAYS_PER_YEAR) - 1) * 100).toFixed(1);
  const r2Pct = r2 * 100;
  const endsBefore = Math.abs(num(detail.estimation_window?.offsets?.[1]) ?? 0);

  return [
    {
      label: 'beta',
      value: beta.toFixed(2),
      reading:
        `When the ${label} moves 1%, ${ticker} has historically moved about ${beta.toFixed(2)}%. `
        + (beta < 1
          ? 'Less than the index, so it is the steadier of the two.'
          : 'More than the index, so it amplifies market moves.'),
    },
    {
      label: 'alpha',
      value: `${alpha.toFixed(5)} a day (about ${annualPct}% a year)`,
      reading:
        'Drift the benchmark does not account for. Over a trading year that compounds to '
        + `roughly ${annualPct}%.`,
    },
    {
      label: 'R²',
      value: `${r2Pct.toFixed(0)}%`,
      reading:
        `How much of ${ticker}'s day-to-day movement the ${label} explains. The other `
        + `${(100 - r2Pct).toFixed(0)}% is specific to the company - and that is the part this `
        + 'study measures.',
    },
    {
      label: 'fit window',
      value: `${detail.observations} trading days`,
      reading:
        `Fitted on ${detail.observations} days ending ${endsBefore} trading days before the `
        + 'event, so the event itself could not influence the line it is being measured against.',
    },
    {
      label: 'benchmark',
      value: label,
      reading: "Chosen for this holding's region.",
    },];}

/**
 * @param {any} detail
 * @returns {{ formula: string, substituted: string, result: string } | null}
 */
export function buildWorkingEquation(detail) {
  if (!detail?.available) return null;

  const row = rowAt(detail, 0);
  const alpha = num(detail.alpha);
  const beta = num(detail.beta);
  const market = num(row?.market_return_pct);
  if (!row || alpha === null || beta === null || market === null) return null;

  const ticker = detail.ticker ?? 'This holding';
  const alphaPct = alpha * 100;
  const expectedPct = alphaPct + beta * market;

  return {
    formula: 'expected return = alpha + beta × benchmark return',
    substituted:
      `${alphaPct.toFixed(2)}% + ${beta.toFixed(2)} × ${market.toFixed(2)}% `
      + `= ${expectedPct.toFixed(2)}%`,
    result:
      `${ticker} actually returned ${row.stock_return_pct?.toFixed(2)}%, so the abnormal `
      + `return is ${row.abnormal_return_pct?.toFixed(2)}%.`,
  };}


/**
 * @param {any} scores
 * @returns {'strong'|'moderate'|'weak'}
 */
export function articleConfidence(scores) {
  const combined = num(scores?.combined) ?? 0;
  const entity = num(scores?.entity_match) ?? 0;
  if (combined >= 0.7 && entity >= 1) return 'strong';
  if (combined >= 0.45) return 'moderate';
  return 'weak';}