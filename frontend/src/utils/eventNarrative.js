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
const signed = (n) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}`;

/** @param {number} n */
const round1 = (n) => Math.round(n * 10) / 10;

const BAND_LABEL = {
  unusual: 'Unusual',
  very_unusual: 'Very unusual',
  extremely_unusual: 'Extremely unusual',
};

/**
 * @param {any} event a row from /portfolio/events
 * @returns {{ headline: string, move: string, date: string } | null}
 */
export function headlineFor(event) {
  const move = num(event?.return_pct);
  if (!event?.ticker || move === null) return null;

  const fell = move < 0;
  const sharp = event.band === 'very_unusual' || event.band === 'extremely_unusual';
  const headline = sharp
    ? `${event.ticker} ${fell ? 'fell' : 'rose'} sharply`
    : `${event.ticker} had an unusual ${fell ? 'fall' : 'rise'}`;
  return { headline, move: `${signed(move)}%`, date: longDate(event.date) };
}

/**
 * @param {any} detail the /portfolio/events/{ticker}/{date} payload
 * @returns {string|null}
 */
export function impactFor(detail) {
  const impact = detail?.portfolio_impact;
  const ticker = detail?.ticker;
  if (!impact || !ticker) return null;

  if (impact.basis === 'not_held') {
    return `You didn't hold ${ticker} on this date, so this move didn't affect your portfolio.`;
  }
  const weight = num(impact.weight_pct);
  const contribution = num(impact.contribution_pct);
  if (weight === null || contribution === null) return null;

  const size = Math.abs(contribution).toFixed(2);
  const effect = contribution < 0 ? `took about ${size}% off` : `added about ${size}% to`;
  const sentence =
    `${ticker} was ${weight.toFixed(1)}% of your portfolio the day before, so this move `
    + `${effect} your portfolio that day.`;

  return impact.basis === 'current_weight'
    ? `${sentence} (Based on today's weight: we don't have your portfolio's value for that day.)`
    : sentence;
}

/**
 * @param {any} event
 * @returns {{ label: string|null, lines: string[] } | null}
 */
export function unusualnessFor(event) {
  const times = num(event?.times_normal);
  if (times === null || !event?.ticker) return null;

  const lines = [`About ${times.toFixed(1)}× ${event.ticker}'s normal daily movement.`];
  if (event.rank_in_period === 1 && num(event.period_days) !== null) {
    const way = num(event.return_pct) !== null && event.return_pct < 0 ? 'fall' : 'rise';
    lines.push(`Its biggest one-day ${way} in the past ${event.period_days} trading days.`);
  }
  return { label: BAND_LABEL[/** @type {keyof BAND_LABEL} */ (event.band)] ?? null, lines };
}

/**
 * @param {any} detail
 * @returns {{ kind: string, lines: string[], why: string|null } | null}
 */
export function marketFor(detail) {
  if (!detail) return null;
  const ticker = detail.ticker ?? 'This holding';
  const label = detail.benchmark_label ?? 'the benchmark';

  if (detail.reason === 'benchmark_is_self') {
    return {
      kind: 'market',
      lines: [
        `${ticker} is the ${label} itself, so this was the market moving. There is no separate `
        + 'company part to measure.',
      ],
      why: null,
    };
  }

  const parts = detail.decomposition;
  if (!parts) {
    let reason = null;
    if (detail.decomposition_reason === 'benchmark_missing_day') {
      reason = `We can't split this move into market and company parts: the ${label} has no `
        + 'price for the day before.';
    } else if (detail.available === false) {
      reason = `Not enough price history for ${ticker} to separate the market from the company.`;
    }
    return reason ? { kind: 'none', lines: [reason], why: null } : null;
  }

  const stock = round1(parts.stock_return_pct);
  const benchmark = round1(parts.market_return_pct);
  const market = round1(parts.market_component_pct);
  const company = round1(stock - market);
  const benchWay = benchmark < 0 ? 'fell' : 'rose';
  const size = Math.abs(benchmark).toFixed(1);

  /** @type {string[]} */
  let lines;
  switch (detail.move_type) {
    case 'company':
      lines = [
        `The ${label} ${benchWay} only ${size}% that day. Most of ${ticker}'s move was specific `
        + `to ${ticker}, not the wider market.`,
        `Market-adjusted move: ${signed(company)}%`,
      ];
      break;
    case 'market':
      lines = [
        `The whole market moved: the ${label} ${benchWay} ${size}%, which explains most of this `
        + 'move.',
      ];
      break;
    case 'mixed':
      lines = [
        `Part of this was the market (${signed(market)}%) and part was specific to ${ticker} `
        + `(${signed(company)}%).`,
      ];
      break;
    case 'against_market':
      lines = [
        `${ticker} ${stock < 0 ? 'fell' : 'rose'} while the ${label} ${benchWay} ${size}%, so `
        + 'this move went against the market.',
      ];
      break;
    default:
      lines = [];
  }
  if (detail.tracks_benchmark) {
    lines.push(
      `${ticker} exists to track the ${label}, so almost all of its movement is the market's. `
      + 'That is the fund working as designed.',
    );
  }

  const beta = num(parts.beta);
  const why = beta === null
    ? null
    : `${ticker} typically moves about ${beta.toFixed(2)}× the market. On a ${signed(benchmark)}% `
      + `market day that predicts about ${signed(market)}%, leaving ${signed(company)}% that the `
      + "market doesn't explain.";

  return { kind: detail.move_type ?? 'unknown', lines, why };
}

/**
 * @param {any} event
 * @param {any} detail
 * @returns {string|null}
 */
export function breadthFor(event, detail) {
  const day = detail?.same_day;
  if (!day || !event) return null;

  if (day.same_direction >= 3) {
    const way = event.return_pct < 0 ? 'fell' : 'rose';
    const shock = detail.move_type === 'company'
      ? ', so this may have been a sector or market shock that the index did not fully capture'
      : '';
    return `It wasn't alone: ${day.same_direction} of the ${day.scanned} large caps we track `
      + `also ${way} unusually that day (${day.tickers.slice(0, 3).join(', ')})${shock}.`;
  }
  if (day.unusual === 0 && day.scanned >= 20) {
    return `None of the other ${day.scanned} large caps we track moved unusually that day.`;
  }
  return null;
}

/**
 * @param {any} detail
 * @returns {string|null}
 */
export function afterEventFor(detail) {
  const after = detail?.after_event;
  const car = num(after?.car_pct);
  if (!after?.significant || car === null || !detail?.ticker) return null;

  return `${after.days} trading days later, ${detail.ticker} was still ${Math.abs(car).toFixed(1)}% `
    + `${car < 0 ? 'below' : 'above'} where its usual relationship with the market would put it.`;
}

/** @param {number} days */
const publishedWhen = (days) => {
  if (days === 0) return 'Published the same day';
  if (days === 1) return 'Published the day after';
  if (days > 1) return `Published ${days} days after`;
  return `Published ${-days} day${days === -1 ? '' : 's'} before`;
};

/**
 * @param {any} detail
 * @returns {{
 *   warning: string|null,
 *   body: string|null,
 *   articles: { id: string, title: string, url: string|null, source: string, published: string,
 *     reasons: string[], quote: string|null, relevance: string|null }[],
 *   caption: string|null,
 * } | null}
 */
export function newsFor(detail) {
  if (!detail || !detail.ticker) return null;
  const ticker = detail.ticker;
  const found = detail.possible_explanations ?? [];

  if (found.length === 0) {
    const specific = detail.move_type === 'company' ? ` and mostly specific to ${ticker}` : '';
    return {
      warning: 'No matching news found',
      body:
        "We don't have a stored news article close enough to this date to point to a possible "
        + `cause. The move is still unusually large${specific}; we just can't link it to a news `
        + 'event.',
      articles: [],
      caption: null,
    };
  }

  const articles = found.map((/** @type {any} */ article) => {
    const evidence = article.evidence ?? null;
    const reasons = [];
    if (evidence?.named_in_headline) reasons.push(`Names ${ticker} in the headline`);
    if (num(evidence?.days_from_event) !== null) reasons.push(publishedWhen(evidence.days_from_event));

    return {
      id: article.article_id,
      title: article.title,
      url: article.url ?? null,
      source: article.source_name ?? 'Unknown source',
      published: longDate(String(article.published_at ?? '').slice(0, 10)),
      reasons,
      quote: evidence?.highlight ?? null,
      relevance:
        article.relevance === 'close' ? 'Closely related'
          : article.relevance === 'related' ? 'Related' : null,
    };
  });

  return {
    warning: null,
    body: null,
    articles,
    caption:
      `These articles were published around the move and mention ${ticker}. That doesn't mean `
      + 'they caused it.',
  };
}

/**
 * @param {any} event
 * @param {any} detail
 * @returns {string}
 */
export function buildEventQuestion(event, detail) {
  const ticker = event?.ticker ?? 'this holding';
  const top = headlineFor(event);
  const lines = [top ? `${top.headline}: ${top.move} on ${top.date}.` : `${ticker} moved unusually.`];

  const parts = detail?.decomposition;
  if (parts) {
    const label = detail.benchmark_label ?? 'the benchmark';
    const market = round1(parts.market_component_pct);
    lines.push(
      `The ${label} moved ${signed(round1(parts.market_return_pct))}% that day. With a beta of `
        + `${num(parts.beta)?.toFixed(2)} over ${detail.observations} trading days, about `
        + `${signed(market)}% of the move is what the market would predict, leaving `
        + `${signed(round1(round1(parts.stock_return_pct) - market))}% specific to ${ticker}.`,
    );
  }

  lines.push(
    `The move was ${Math.abs(num(event?.z_score) ?? 0).toFixed(1)} standard deviations out, `
      + 'measured against an annualised volatility of '
      + `${(num(event?.annualised_volatility_pct) ?? 0).toFixed(1)}% over ${event?.observations} `
      + 'trading days.',
  );

  lines.push(
    'Explain in plain language what this means for me as an investor, what kinds of '
      + 'company-specific news typically produce a move of this size, and '
      + (num(event?.return_pct) !== null && event.return_pct < 0
        ? 'what I could have done to reduce my exposure to a single-company shock like this.'
        : 'how a holding like this contributes when it runs.')
      + ' Do not state a specific cause; you have not been given one.',
  );

  return lines.join(' ');
}

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
        + `roughly ${annualPct}%. It is reported but not taken off the move: over a few months `
        + 'of data it is mostly noise.',
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
 * @returns {{ formula: string, substituted: string, result: string, alpha: string|null } | null}
 */
export function buildWorkingEquation(detail) {
  const parts = detail?.decomposition;
  const beta = num(parts?.beta);
  if (!detail?.available || !parts || beta === null) return null;

  const ticker = detail.ticker ?? 'This holding';
  const expected = parts.market_component_pct;
  const alpha = num(detail.alpha);
  const se = num(detail.alpha_se);

  return {
    formula: 'expected = β × benchmark return; abnormal = actual − expected',
    substituted:
      `${beta.toFixed(2)} × ${parts.market_return_pct.toFixed(2)}% = ${expected.toFixed(2)}%`,
    result:
      `${ticker} actually returned ${parts.stock_return_pct.toFixed(2)}%, so the abnormal move `
      + `is ${parts.stock_return_pct.toFixed(2)}% − (${expected.toFixed(2)}%) = `
      + `${parts.company_component_pct.toFixed(2)}%.`,
    alpha: alpha === null
      ? null
      : `α = ${alpha.toFixed(5)}${se === null ? '' : ` (± ${se.toFixed(5)})`}, not used — too `
        + `noisy over ${detail.observations} days to count as expected return`,
  };
}

const INGEST_LABEL = {
  nightly: 'the nightly job',
  backfill: 'historical backfill',
  on_demand: 'when the news page loaded',
};

/** @param {string|null|undefined} iso */
const dayOf = (iso) => (iso ? longDate(String(iso).slice(0, 10)) : null);

/**
 * @param {any} event
 * @param {any} detail
 * @param {any} scan the /portfolio/events payload the event came from
 * @returns {{ label: string, value: string }[]}
 */
export function detailRowsFor(event, detail, scan) {
  const rows = [];
  const sigma = num(event?.daily_sigma_pct);
  const vol = num(event?.annualised_volatility_pct);
  const k = num(scan?.k_sigma);
  if (sigma !== null) rows.push({ label: 'normal daily move (σ)', value: `${sigma.toFixed(2)}%` });
  if (vol !== null) rows.push({ label: 'annualised volatility', value: `${vol.toFixed(1)}%` });
  rows.push({
    label: 'detector',
    value: `EWMA, λ 0.94${k === null ? '' : `, flagged beyond k = ${k.toFixed(1)}σ`}`,
  });
  const day = detail?.same_day;
  if (day) {
    rows.push({
      label: 'same day',
      value: `${day.unusual} of ${day.scanned} unusual that day (${day.same_direction} the same `
        + `way); about ${day.expected_by_chance} expected by chance if moves were independent.`,
    });
  }
  if (!detail?.available) return rows;

  const beta = num(detail.beta);
  const alpha = num(detail.alpha);
  const se = num(detail.alpha_se);
  const t = num(detail.alpha_t);
  const r2 = num(detail.r_squared);
  const sigmaAr = num(detail.sigma_ar);
  if (beta !== null) rows.push({ label: 'β', value: beta.toFixed(2) });
  if (alpha !== null) {
    rows.push({
      label: 'α ± SE',
      value: `${alpha.toFixed(5)}${se === null ? '' : ` ± ${se.toFixed(5)}`}`
        + `${t === null ? '' : ` (t = ${t.toFixed(2)})`}`,
    });
  }
  if (r2 !== null) rows.push({ label: 'R²', value: r2.toFixed(2) });
  if (sigmaAr !== null) rows.push({ label: 'σ of abnormal returns', value: `${(sigmaAr * 100).toFixed(2)}%` });

  const parts = detail.decomposition;
  if (parts) {
    rows.push({ label: 'market move', value: `${parts.market_return_pct.toFixed(2)}%` });
    rows.push({ label: 'expected from the market', value: `${parts.market_component_pct.toFixed(2)}%` });
    rows.push({ label: 'abnormal move', value: `${parts.company_component_pct.toFixed(2)}%` });
  }

  const est = detail.estimation_window;
  if (est?.offsets?.length === 2) {
    rows.push({
      label: 'estimation window',
      value: `[${est.offsets[0]}, ${est.offsets[1]}] trading days, ${est.from} to ${est.to}`,
    });
  }
  if (detail.event_window) {
    rows.push({
      label: 'event window',
      value: `${detail.event_window.from} to ${detail.event_window.to} (${detail.event_window.length} days)`,
    });
  }
  return rows;
}

/**
 * @param {any} detail
 * @returns {string|null}
 */
export function carSentence(detail) {
  const rows = detail?.abnormal_returns ?? [];
  const last = rows[rows.length - 1];
  const car = num(last?.cumulative_abnormal_return_pct);
  const lower = num(last?.car_lower_pct);
  const upper = num(last?.car_upper_pct);
  if (car === null || lower === null || upper === null) return null;

  return `By t${last.offset >= 0 ? '+' : ''}${last.offset} the cumulative abnormal return was `
    + `${car.toFixed(2)}%, ${last.significant ? 'outside' : 'inside'} its 95% band of `
    + `${lower.toFixed(2)}% to ${upper.toFixed(2)}%. The band is the range the market model `
    + 'expects nineteen times out of twenty.';
}

/**
 * @param {any} scan
 * @returns {string|null}
 */
export function chanceFor(scan) {
  const coverage = scan?.coverage;
  const days = num(coverage?.scored_days_total);
  const expected = num(coverage?.expected_by_chance);
  if (days === null || expected === null) return null;
  return `Across ${days} scored holding-days we'd expect about ${expected} flags by chance alone`
    + `${coverage.chance_note ? ` ${coverage.chance_note}` : ''}.`;
}

/**
 * @param {any} article
 * @returns {string|null}
 */
export function provenanceFor(article) {
  const how = INGEST_LABEL[/** @type {keyof INGEST_LABEL} */ (article?.evidence?.ingest_mode)];
  const when = dayOf(article?.evidence?.collected_at);
  if (!how || !when) return null;
  return `Collected by ${how} on ${when}.`;
}

/**
 * @param {any} scan
 * @returns {string|null}
 */
export function collectedFor(scan) {
  const when = dayOf(scan?.coverage?.news_last_collected_at);
  return when ? `News last collected ${when}.` : null;
}

