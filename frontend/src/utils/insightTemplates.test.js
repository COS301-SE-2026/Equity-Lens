import { describe, it, expect } from 'vitest';

import { SEVERITY_RANK, TEMPLATES } from './insightTemplates';

/** @param {number} days */
const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const PERF_SERIES = Array.from({ length: 120 }, (_, i) => {
  const rise = 100 + i * 0.6;
  const value = i < 90 ? rise : rise - (i - 89) * 1.1;
  return {
    date: isoDaysAgo(120 - i),
    name: `d${i}`,
    twr_index: Number(value.toFixed(4)),
    value: Number((value * 900).toFixed(2)),
    benchmark: Number((100 + i * 0.4).toFixed(4)),
  };
});

const HOLDINGS = [
  {
    ticker: 'NPN.JO', name: 'Naspers', sector: 'Technology', value: 52000,
    gain_loss: 14000, gain_loss_pct: 36.8, daily_change_pct: 1.4,
    first_purchase_date: isoDaysAgo(400), priced_live: true,
  },
  {
    ticker: 'PRX.JO', name: 'Prosus', sector: 'Technology', value: 21000,
    gain_loss: 3200, gain_loss_pct: 18.0, daily_change_pct: 0.6,
    first_purchase_date: isoDaysAgo(20), priced_live: true,
  },
  {
    ticker: 'SBK.JO', name: 'Standard Bank', sector: 'Financials', value: 14000,
    gain_loss: -4500, gain_loss_pct: -24.3, daily_change_pct: -2.1,
    first_purchase_date: isoDaysAgo(15), priced_live: true,
  },
  {
    ticker: 'AGL.JO', name: 'Anglo American', sector: 'Resources', value: 9000,
    gain_loss: 900, gain_loss_pct: 11.1, daily_change_pct: -0.4,
    first_purchase_date: isoDaysAgo(10), priced_live: false,
  },
  {
    ticker: 'CPI.JO', name: 'Capitec', sector: 'Financials', value: 4000,
    gain_loss: 2600, gain_loss_pct: 185.7, daily_change_pct: 0.2,
    first_purchase_date: isoDaysAgo(900), priced_live: true,
  },
];

const CTX = {
  holdings: HOLDINGS,
  sectorData: [
    { name: 'Technology', value: 73 },
    { name: 'Financials', value: 18 },
    { name: 'Resources', value: 9 },
  ],
  attribution: { contributors: [], drags: [], todayReturn: 0 },
  thresholds: { low: 25, high: 45 },
  returns: {
    holdings_count: 5,
    priced_live_count: 4,
    priced_count: 5,
    history_days: 120,
    net_contributions: 64000,
    invested_capital: 84000,
  },
  health: {
    score: 5.2,
    label: 'Mixed',
    subscores: [
      { key: 'sectorConcentration', label: 'Sector Concentration', weight: 0.4, value: 3.1 },
      { key: 'singleStockRisk', label: 'Single-Stock Risk', weight: 0.35, value: 5.0 },
      { key: 'portfolioBreadth', label: 'Portfolio Breadth', weight: 0.25, value: 6.2 },
    ],
  },
  perfSeries: PERF_SERIES,
  contributionSeries: [
    { date: isoDaysAgo(120), portfolio_value: 60000, cumulative_net_contributions: 60000, cumulative_market_gain: 0 },
    { date: isoDaysAgo(0), portfolio_value: 100000, cumulative_net_contributions: 64000, cumulative_market_gain: 36000 },
  ],
  cgt: {
    available: true,
    taxable_capital_gain: 18400,
    net_unrealised_gain: 16200,
    assumptions: { tax_year: '2026/27', cost_basis_method: 'average_cost' },
  },
  statementDate: isoDaysAgo(70),
  accountType: 'taxable',
  benchmarkLabel: 'JSE ALSI',
};

/** @param {any} ctx @returns {any[]} */
const fired = (ctx) => TEMPLATES.map((t) => t.build(ctx)).filter(Boolean);

const NO_FIGURE_EXEMPT = new Set(['sector.missing', 'dq.no-live-prices']);

describe('the registry as a whole', () => {
  it('never emits a sentence without a figure it computed, and never an empty evidence trail', () => {

    const records = fired(CTX);
    expect(records.length).toBeGreaterThan(8);

    for (const record of records) {
      expect(record.evidence.length, `${record.id} has no evidence`).toBeGreaterThanOrEqual(1);
      expect(record.why.length, `${record.id} has no why`).toBeGreaterThan(0);
      if (NO_FIGURE_EXEMPT.has(record.id)) continue;
      expect(record.text, `${record.id} quotes no figure`).toMatch(/\d/);
    }
  });

  it('still puts figures in the evidence of the two templates exempt from the text rule', () => {
    const bare = fired({ holdings: HOLDINGS.map((h) => ({ ...h, daily_change_pct: null })), sectorData: [], attribution: CTX.attribution });
    for (const id of NO_FIGURE_EXEMPT) {
      const record = bare.find((r) => r.id === id);
      if (!record) throw new Error(`expected ${id} to fire on this fixture`);
      expect(record.evidence.some((/** @type {any} */ e) => /\d/.test(e.value)), id).toBe(true);
    }
  });

  it('gives every record a known severity and a magnitude inside 0-1', () => {
    for (const record of fired(CTX)) {
      expect(Object.keys(SEVERITY_RANK), record.id).toContain(record.severity);
      expect(record.magnitude, record.id).toBeGreaterThanOrEqual(0);
      expect(record.magnitude, record.id).toBeLessThanOrEqual(1);
    }
  });

  it('uses a unique id per template so the summary strip can dedupe against it', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns nothing at all rather than guessing when the payload is bare', () => {
    const records = fired({ holdings: HOLDINGS, sectorData: [], attribution: CTX.attribution });
    for (const record of records) {
      expect(record.evidence.length).toBeGreaterThanOrEqual(1);
      if (NO_FIGURE_EXEMPT.has(record.id)) continue;
      expect(record.text, `${record.id} quotes no figure`).toMatch(/\d/);
    }
    const ids = records.map((r) => r.id);
    expect(ids).not.toContain('drawdown.current');
    expect(ids).not.toContain('vol.vs-benchmark');
    expect(ids).not.toContain('contrib.deposits-vs-growth');
    expect(ids).not.toContain('perf.moving-average');
  });
});

describe('the arithmetic each template quotes', () => {
  /** @param {string} id @param {any} [ctx] */
  const one = (id, ctx = CTX) => fired(ctx).find((r) => r.id === id);

  it('computes effective positions from the squared weights, not the raw count', () => {
    expect(one('conc.effective-count')).toBeUndefined();

    const lopsided = {
      ...CTX,
      holdings: [
        { ticker: 'BIG', sector: 'Technology', value: 90000 },
        { ticker: 'A', sector: 'Financials', value: 3000 },
        { ticker: 'B', sector: 'Financials', value: 3000 },
        { ticker: 'C', sector: 'Resources', value: 2000 },
        { ticker: 'D', sector: 'Resources', value: 2000 },
      ],
    };
    const record = one('conc.effective-count', lopsided);
    if (!record) throw new Error('expected an effective-count insight');
    expect(record.text).toMatch(/You hold 5 positions, but weighted by size that is only 1\.2/);
  });

  it('adds the top three and states the sum', () => {
    const record = one('conc.top-three');
    if (!record) throw new Error('expected a top-three insight');
    expect(record.text).toMatch(/87% of the book/);
    expect(record.evidence).toHaveLength(3);
  });

  it('splits deposits from market gain rather than calling the whole increase growth', () => {
    const record = one('contrib.deposits-vs-growth');
    if (!record) throw new Error('expected a contributions insight');
    expect(record.text).toMatch(/64% of your portfolio's value is money you put in/);
    expect(record.text).toMatch(/36% is market gain/);
  });

  it('says nothing about deposits versus growth when the book is worth less than what went in', () => {
    const series = [
      { date: isoDaysAgo(120), portfolio_value: 100, cumulative_net_contributions: 100, cumulative_market_gain: 0 },
      { date: isoDaysAgo(0), portfolio_value: 60, cumulative_net_contributions: 100, cumulative_market_gain: -40 },
    ];
    const records = fired({ ...CTX, contributionSeries: series });

    expect(records.map((r) => r.id)).not.toContain('contrib.deposits-vs-growth');
  });

  it('splits the two when there is real gain to split off', () => {
    const series = [
      { date: isoDaysAgo(120), portfolio_value: 100, cumulative_net_contributions: 100, cumulative_market_gain: 0 },
      { date: isoDaysAgo(0), portfolio_value: 150, cumulative_net_contributions: 100, cumulative_market_gain: 50 },
    ];
    const record = fired({ ...CTX, contributionSeries: series })
      .find((r) => r.id === 'contrib.deposits-vs-growth');
    if (!record) throw new Error('expected a contributions insight');

    expect(record.text).toMatch(/67% of your portfolio's value is money you put in/);
    expect(record.text).toMatch(/33% is market gain/);
  });

  it('ranks the subscore costing the most and shows the multiplication', () => {
    const record = one('risk.weakest-subscore');
    if (!record) throw new Error('expected a risk insight');
    expect(record.text).toMatch(/Sector Concentration is costing your health score 2\.8 points/);
    expect(record.evidence.map((/** @type {any} */ e) => e.value)).toContain('0.40 x 6.9 = 2.8');
  });

  it('separates the best percentage from the best Rand figure', () => {
    const record = one('wl.percent-vs-rands');
    if (!record) throw new Error('expected a percent-vs-rands insight');
    expect(record.text).toMatch(/CPI\.JO is your best performer at 185\.7%/);
    expect(record.text).toMatch(/NPN\.JO has made you more money/);
  });

  it('counts the holdings carried at cost', () => {
    const record = one('dq.priced-at-cost');
    if (!record) throw new Error('expected a pricing insight');
    expect(record.text).toMatch(/1 of your 5 holdings is valued at cost/);
  });

  it('reports the statement age in days', () => {
    const record = one('dq.stale-statement');
    if (!record) throw new Error('expected a stale-statement insight');
    const days = Math.round((Date.now() - new Date(CTX.statementDate).getTime()) / 86400000);
    expect(record.text).toContain(`${days} days old`);
    expect(days).toBeGreaterThanOrEqual(70);
  });

  it('notices the recent purchases piling into what is already the largest sector', () => {
    const record = one('composition.recent-pile-in');
    expect(record).toBeUndefined();

    const piledIn = {
      ...CTX,
      holdings: HOLDINGS.map((h) =>
        ['PRX.JO', 'SBK.JO', 'AGL.JO'].includes(h.ticker) ? { ...h, sector: 'Technology' } : h,
      ),
    };
    const hit = fired(piledIn).find((r) => r.id === 'composition.recent-pile-in');
    if (!hit) throw new Error('expected a pile-in insight once the three share a sector');
    expect(hit.text).toMatch(/AGL\.JO, SBK\.JO, PRX\.JO/);
    expect(hit.text).toMatch(/already your largest sector at 73%/);
  });
});

describe('the position-count template the signals strip used to own', () => {
  /** @param {number} n */
  const bookOf = (n) =>
    Array.from({ length: n }, (_, i) => ({ ticker: `T${i}`, value: 10000, sector: 'Technology' }));

  it('fires on a book of two positions and names the total', () => {
    const record = fired({ ...CTX, holdings: bookOf(2) }).find((r) => r.id === 'conc.position-count');
    if (!record) throw new Error('expected conc.position-count to fire');

    expect(record.text).toBe('Only 2 positions make up your entire book.');
    expect(record.severity).toBe('risk');
    expect(record.evidence).toContainEqual({ label: 'Positions held', value: '2' });
  });

  it('uses the singular for a one-position book', () => {
    const record = fired({ ...CTX, holdings: bookOf(1) }).find((r) => r.id === 'conc.position-count');
    expect(record?.text).toBe('Only 1 position makes up your entire book.');
  });

  it('is silent one position above the threshold', () => {
    const ids = fired({ ...CTX, holdings: bookOf(3) }).map((r) => r.id);
    expect(ids).not.toContain('conc.position-count');
  });
});

describe('templates that must stay silent', () => {
  it('says nothing about tax-free room on a taxable account', () => {
    expect(fired(CTX).map((r) => r.id)).not.toContain('tax.tfsa-room');
    const tfsa = fired({ ...CTX, accountType: 'tfsa' }).map((r) => r.id);
    expect(tfsa).toContain('tax.tfsa-room');
  });

  it('does not offer a loss to offset when there is no taxable gain to offset it against', () => {
    const noGain = { ...CTX, cgt: { available: false, reason: 'no_cost_basis' } };
    expect(fired(noGain).map((r) => r.id)).not.toContain('wl.loss-offset');
  });

  it('does not call two days of history a benchmark comparison', () => {
    const short = {
      ...CTX,
      perfSeries: PERF_SERIES.slice(0, 2),
      returns: { ...CTX.returns, history_days: 2 },
    };
    const ids = fired(short).map((r) => r.id);
    expect(ids).toContain('dq.short-history');
    expect(ids).not.toContain('perf.moving-average');
    expect(ids).not.toContain('perf.streak');
    expect(ids).not.toContain('vol.recent-shift');
  });
});

describe('the templates that needed the events endpoint', () => {
  const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

  const EVENTS = {
    events: [
      { ticker: 'NPN.JO', name: 'Naspers', date: recent, return_pct: -8.2, z_score: -3.4,
        direction: 'down', annualised_volatility_pct: 31.4, observations: 246 },
      { ticker: 'SBK.JO', name: 'Standard Bank', date: recent, return_pct: 4.1, z_score: 3.05,
        direction: 'up', annualised_volatility_pct: 18.2, observations: 246 },
    ],
    coverage: {
      holdings_total: 3, holdings_scanned: 2, holdings_skipped: [],
      holdings: [
        { ticker: 'NPN.JO', name: 'Naspers', observations: 246, annualised_volatility_pct: 31.4 },
        { ticker: 'SBK.JO', name: 'Standard Bank', observations: 246, annualised_volatility_pct: 18.2 },
      ],
      events_found: 2, events_returned: 2,
    },
  };

  /** @param {string} id @param {any} ctx */
  const build = (id, ctx) => TEMPLATES.find((t) => t.id === id)?.build(ctx) ?? null;

  it('names the biggest recent move, with the working beside it', () => {
    const record = build('events.unusual-movement', { ...CTX, events: EVENTS });

    expect(record?.text).toContain('NPN.JO');
    expect(record?.text).toContain('8.2%');
    expect(record?.text).toContain('3.4 sigma');
    const labels = record?.evidence.map((/** @type {any} */ e) => e.label) ?? [];
    expect(labels).toContain('Its volatility');
    expect(labels).toContain('Days measured');
  });

  it('ignores an unusual move that is older than the window', () => {
    const old = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const stale = { ...EVENTS, events: [{ ...EVENTS.events[0], date: old }] };

    expect(build('events.unusual-movement', { ...CTX, events: stale })).toBeNull();
  });

  it('compares the bumpiest holding against the portfolio, not against itself', () => {
    const record = build('events.holding-volatility', { ...CTX, events: EVENTS });

    expect(record?.text).toContain('NPN.JO');
    expect(record?.text).toContain('31.4%');
    expect(record?.evidence.map((/** @type {any} */ e) => e.label)).toContain('Portfolio');
  });

  const DIVERGENCE = {
    date: recent, portfolio_return_pct: 4.8, benchmark_return_pct: 0.7,
    relative_return_pct: 4.07, z_score: 3.42, annualised_volatility_pct: 9.6,
    observations: 214, direction: 'ahead',
  };

  it('names the day the book came apart from the index, with both legs and the gap', () => {
    const record = build('events.benchmark-divergence', {
      ...CTX,
      benchmarkLabel: 'JSE Top 40',
      events: { ...EVENTS, divergences: [DIVERGENCE] },
    });

    expect(record?.text).toContain('4.1% ahead of the JSE Top 40');
    expect(record?.text).toContain('you returned 4.8% that day and it returned 0.7%');

    const evidence = Object.fromEntries(
      (record?.evidence ?? []).map((/** @type {any} */ e) => [e.label, e.value]),
    );
    expect(evidence['Your return']).toBe('4.8%');
    expect(evidence['JSE Top 40']).toBe('0.7%');
    expect(evidence.Gap).toBe('4.1%');
    expect(evidence['Standard deviations']).toBe('3.42');
    expect(evidence['Its volatility']).toBe('9.6% a year');
  });

  it('picks the largest gap, not the most recent one', () => {
    const smaller = { ...DIVERGENCE, relative_return_pct: -1.2, z_score: -3.1, direction: 'behind' };
    const record = build('events.benchmark-divergence', {
      ...CTX,
      benchmarkLabel: 'JSE Top 40',
      events: { ...EVENTS, divergences: [smaller, DIVERGENCE] },
    });

    expect(record?.text).toContain('4.1% ahead of');
  });

  it('says nothing when the scan found no divergence, or when it is out of the window', () => {
    expect(
      build('events.benchmark-divergence', { ...CTX, events: EVENTS }),
    ).toBeNull();

    const old = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    expect(
      build('events.benchmark-divergence', {
        ...CTX,
        events: { ...EVENTS, divergences: [{ ...DIVERGENCE, date: old }] },
      }),
    ).toBeNull();
  });

  it('stays silent on the event study until the user has opened one', () => {
    expect(build('events.event-study', { ...CTX, events: EVENTS })).toBeNull();
    expect(
      build('events.event-study', {
        ...CTX,
        eventStudy: { available: false, reason: 'insufficient_history' },
      }),
    ).toBeNull();
  });

  it('only speaks about an event study whose cumulative figure left the band', () => {
    const inside = {
      available: true, ticker: 'NPN.JO', date: recent, benchmark_label: 'JSE Top 40',
      beta: 1.18, r_squared: 0.41,
      abnormal_returns: [{ offset: 10, cumulative_abnormal_return_pct: -2.1,
        car_lower_pct: -9.0, car_upper_pct: 4.8, significant: false }],
    };
    expect(build('events.event-study', { ...CTX, eventStudy: inside })).toBeNull();

    const outside = {
      ...inside,
      abnormal_returns: [{ offset: 10, cumulative_abnormal_return_pct: -11.4,
        car_lower_pct: -9.0, car_upper_pct: 4.8, significant: true }],
    };
    const record = build('events.event-study', { ...CTX, eventStudy: outside });
    expect(record?.text).toContain('11.4%');
    expect(record?.text).toContain('JSE Top 40');
  });

  it('returns null for all three while the events fetch is unresolved or empty', () => {
    for (const ctx of [CTX, { ...CTX, events: null }, { ...CTX, events: { events: [], coverage: { holdings: [] } } }]) {
      expect(build('events.unusual-movement', ctx)).toBeNull();
      expect(build('events.holding-volatility', ctx)).toBeNull();
      expect(build('events.event-study', ctx)).toBeNull();
    }
  });

  it('holds every registry invariant once they do fire', () => {
    const records = /** @type {any[]} */ (
      TEMPLATES
        .map((t) => t.build({ ...CTX, events: EVENTS }))
        .filter(Boolean)
    ).filter((r) => r.id.startsWith('events.'));

    expect(records.length).toBeGreaterThanOrEqual(2);
    for (const record of records) {
      expect(record.evidence.length, record.id).toBeGreaterThanOrEqual(1);
      expect(record.text, record.id).toMatch(/\d/);
      expect(Object.keys(SEVERITY_RANK), record.id).toContain(record.severity);
      expect(record.magnitude, record.id).toBeGreaterThanOrEqual(0);
      expect(record.magnitude, record.id).toBeLessThanOrEqual(1);
    }
  });
});
