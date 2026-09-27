import { describe, it, expect } from 'vitest';

import {
  afterEventFor,
  breadthFor,
  buildEventQuestion,
  buildWorkingEquation,
  buildWorkingRows,
  carSentence,
  chanceFor,
  collectedFor,
  detailRowsFor,
  headlineFor,
  impactFor,
  longDate,
  marketFor,
  newsFor,
  provenanceFor,
  unusualnessFor,
} from './eventNarrative';

const EVENT = {
  ticker: 'NPN.JO',
  name: 'Naspers',
  date: '2026-08-14',
  return_pct: -8.43,
  z_score: -3.42,
  direction: 'down',
  annualised_volatility_pct: 31.37,
  observations: 246,
};

const DETAIL = {
  available: true,
  ticker: 'NPN.JO',
  date: '2026-08-14',
  benchmark_label: 'Satrix 40',
  observations: 99,
  alpha: 0.000214,
  beta: 0.4812,
  r_squared: 0.4127,
  residual_sigma: 0.0142,
  estimation_window: { from: '2026-02-19', to: '2026-07-17', offsets: [-120, -21] },
  abnormal_returns: [
    {
      date: '2026-08-14', offset: 0,
      stock_return_pct: -8.43, market_return_pct: -1.1, abnormal_return_pct: -7.9,
      cumulative_abnormal_return_pct: -7.9, car_lower_pct: -9.6, car_upper_pct: -6.2,
      significant: true,
    },
    {
      date: '2026-08-28', offset: 10,
      stock_return_pct: 0.4, market_return_pct: 0.2, abnormal_return_pct: 0.3,
      cumulative_abnormal_return_pct: -6.21, car_lower_pct: -9.9, car_upper_pct: -2.5,
      significant: true,
    },
  ],};

const MTN = {
  ticker: 'MTN.JO',
  date: '2026-07-31',
  return_pct: -10.8,
  z_score: -5.83,
  direction: 'down',
  annualised_volatility_pct: 29.6,
  observations: 246,
  band: 'extremely_unusual',
  times_normal: 5.8,
  daily_sigma_pct: 1.86,
  rank_in_period: 1,
  period_days: 246,
};

const MTN_DETAIL = {
  available: true,
  ticker: 'MTN.JO',
  benchmark_label: 'Satrix 40',
  observations: 100,
  alpha: 0.000001,
  alpha_se: 0.000303,
  alpha_t: 0.0,
  beta: 0.48,
  r_squared: 0.31,
  sigma_ar: 0.003015,
  move_type: 'company',
  tracks_benchmark: false,
  decomposition: {
    stock_return_pct: -10.8,
    market_return_pct: -0.4,
    beta: 0.48,
    market_component_pct: -0.19,
    company_component_pct: -10.61,
  },
  decomposition_reason: null,
  estimation_window: { from: '2026-02-05', to: '2026-06-30', offsets: [-120, -21] },
  event_window: { from: '2026-07-24', to: '2026-08-14', length: 16 },
  abnormal_returns: [
    {
      date: '2026-08-14', offset: 10, stock_return_pct: 0, market_return_pct: 0,
      abnormal_return_pct: 0, cumulative_abnormal_return_pct: -10.61,
      car_lower_pct: -12.97, car_upper_pct: -8.25, significant: true,
    },
  ],
  after_event: { days: 10, car_pct: -10.61, lower_pct: -12.97, upper_pct: -8.25, significant: true },
  portfolio_impact: {
    held_on_date: true, weight_pct: 8.8, contribution_pct: -0.95, basis: 'holdings_on_date',
  },
  possible_explanations: [],
};

describe('longDate', () => {
  it('reads the calendar date the backend sent, not a UTC instant', () => {
    expect(longDate('2026-08-14')).toBe('14 August 2026');
    expect(longDate('2026-01-05')).toBe('5 January 2026');
  });

  it('passes anything that is not an ISO date straight through', () => {
    expect(longDate('Aug 01')).toBe('Aug 01');
    expect(longDate(/** @type {any} */ (null))).toBe('');
  });
});

describe('buildEventQuestion', () => {
  it('carries every figure the assistant needs, and the instruction not to invent a cause', () => {
    const q = buildEventQuestion(MTN, MTN_DETAIL);

    expect(q).toContain('MTN.JO fell sharply: -10.8% on 31 July 2026.');
    expect(q).toContain('about -0.2% of the move is what the market would predict');
    expect(q).toContain('leaving -10.6% specific to MTN.JO');
    expect(q).toContain('5.8 standard deviations out');
    expect(q).toContain('Do not state a specific cause; you have not been given one.');
  });

  it('drops the fitted figures rather than inventing them when there is no model', () => {
    const q = buildEventQuestion(EVENT, { available: false, abnormal_returns: [], decomposition: null });
    expect(q).not.toContain('beta');
    expect(q).toContain('3.4 standard deviations out');
    expect(q).toContain('Do not state a specific cause; you have not been given one.');
  });});

describe('buildWorkingRows', () => {
  it('quotes alpha in a unit a person can interpret', () => {
    const rows = buildWorkingRows({ ...DETAIL, alpha: 0.00080 });
    const alpha = rows?.find((r) => r.label === 'alpha');

    expect(alpha?.value).toBe('0.00080 a day (about 22.3% a year)');
    expect(alpha?.reading).toContain('compounds to roughly 22.3%');});

  it('gives beta a referent, and says which way it cuts', () => {
    const steady = buildWorkingRows({ ...DETAIL, beta: 0.66 })?.find((r) => r.label === 'beta');
    expect(steady?.reading).toContain('moved about 0.66%');
    expect(steady?.reading).toContain('steadier of the two');

    const amplifying = buildWorkingRows({ ...DETAIL, beta: 1.4 })?.find((r) => r.label === 'beta');
    expect(amplifying?.reading).toContain('amplifies market moves');
  });

  it('reads a low R-squared as the point of the exercise, not as a failing grade', () => {
    const r2 = buildWorkingRows({ ...DETAIL, r_squared: 0.38 })?.find((r) => r.label === 'R²');

    expect(r2?.value).toBe('38%');
    expect(r2?.reading).toContain('The other 62% is specific to the company');
    expect(r2?.reading.toLowerCase()).not.toContain('poor');
    expect(r2?.reading.toLowerCase()).not.toContain('weak');});

  it('says the fit window ends before the event, reading the offset from the payload', () => {
    const window = buildWorkingRows(DETAIL)?.find((r) => r.label === 'fit window');

    expect(window?.value).toBe('99 trading days');
    expect(window?.reading).toContain('ending 21 trading days before the event');
    expect(window?.reading).toContain('could not influence the line');
  });

  it('has nothing to show without a fit', () => {
    expect(buildWorkingRows({ available: false })).toBeNull();
    expect(buildWorkingRows(undefined)).toBeNull();
  });});

describe('buildWorkingEquation', () => {
  it('substitutes the backend\'s own split, with alpha shown but not used', () => {
    const worked = buildWorkingEquation(MTN_DETAIL);

    expect(worked?.formula).toBe('expected = β × benchmark return; abnormal = actual − expected');
    expect(worked?.substituted).toBe('0.48 × -0.40% = -0.19%');
    expect(worked?.result).toBe(
      'MTN.JO actually returned -10.80%, so the abnormal move is -10.80% − (-0.19%) = -10.61%.',
    );
    expect(worked?.alpha).toBe(
      'α = 0.00000 (± 0.00030), not used — too noisy over 100 days to count as expected return',
    );
  });

  it('has nothing to show without a fit or an event-day row', () => {
    expect(buildWorkingEquation({ available: false })).toBeNull();
    expect(buildWorkingEquation(undefined)).toBeNull();
    expect(buildWorkingEquation({ ...MTN_DETAIL, decomposition: null })).toBeNull();
  });});
describe('headlineFor', () => {
  it('says sharply for the two strongest bands and gives the number and date on their own', () => {
    expect(headlineFor(MTN)).toEqual({
      headline: 'MTN.JO fell sharply',
      move: '-10.8%',
      date: '31 July 2026',
    });
    expect(headlineFor({ ...MTN, band: 'very_unusual' })?.headline).toBe('MTN.JO fell sharply');
  });

  it('says an unusual rise or fall for the lowest band', () => {
    const up = { ...MTN, band: 'unusual', return_pct: 3.24 };
    expect(headlineFor(up)).toEqual({
      headline: 'MTN.JO had an unusual rise',
      move: '+3.2%',
      date: '31 July 2026',
    });
    expect(headlineFor({ ...MTN, band: 'unusual' })?.headline).toBe('MTN.JO had an unusual fall');
  });

  it('has no headline without a ticker or a move', () => {
    expect(headlineFor({ ...MTN, return_pct: null })).toBeNull();
    expect(headlineFor(null)).toBeNull();
  });
});

describe('impactFor', () => {
  it('uses the weight on the day and the backend\'s contribution', () => {
    expect(impactFor(MTN_DETAIL)).toBe(
      'MTN.JO was 8.8% of your portfolio the day before, so this move took about 0.95% off '
        + 'your portfolio that day.',
    );
  });

  it('says it added to the portfolio on a rise', () => {
    const rise = { ...MTN_DETAIL, portfolio_impact: { ...MTN_DETAIL.portfolio_impact, contribution_pct: 0.4 } };
    expect(impactFor(rise)).toContain('this move added about 0.40% to your portfolio');
  });

  it('says so when it had to fall back to today\'s weight', () => {
    const fallback = {
      ...MTN_DETAIL,
      portfolio_impact: { held_on_date: true, weight_pct: 8.8, contribution_pct: -0.95, basis: 'current_weight' },
    };
    expect(impactFor(fallback)).toMatch(
      /took about 0\.95% off your portfolio that day\. \(Based on today's weight: we don't have your portfolio's value for that day\.\)$/,
    );
  });

  it('tells you when you did not hold it', () => {
    const notHeld = { ...MTN_DETAIL, portfolio_impact: { held_on_date: false, basis: 'not_held' } };
    expect(impactFor(notHeld)).toBe(
      "You didn't hold MTN.JO on this date, so this move didn't affect your portfolio.",
    );
  });

  it('says nothing without an impact from the backend', () => {
    expect(impactFor({ ...MTN_DETAIL, portfolio_impact: null })).toBeNull();
    expect(impactFor({ ...MTN_DETAIL, portfolio_impact: { basis: 'holdings_on_date', weight_pct: null } })).toBeNull();
  });
});

describe('unusualnessFor', () => {
  it.each([
    ['unusual', 3.0, 'Unusual'],
    ['very_unusual', 4.0, 'Very unusual'],
    ['extremely_unusual', 5.0, 'Extremely unusual'],
  ])('labels the %s band at its %s boundary', (band, times, label) => {
    const read = unusualnessFor({ ...MTN, band, times_normal: times, rank_in_period: 2 });
    expect(read?.label).toBe(label);
    expect(read?.lines).toEqual([`About ${times.toFixed(1)}× MTN.JO's normal daily movement.`]);
  });

  it('adds the record line only for the biggest move of the period', () => {
    expect(unusualnessFor(MTN)?.lines).toEqual([
      "About 5.8× MTN.JO's normal daily movement.",
      'Its biggest one-day fall in the past 246 trading days.',
    ]);
    expect(unusualnessFor({ ...MTN, rank_in_period: 2 })?.lines).toHaveLength(1);
  });

  it('has nothing to say without the backend\'s multiple', () => {
    expect(unusualnessFor({ ...MTN, times_normal: undefined })).toBeNull();
  });
});

describe('marketFor', () => {
  it('shows parts that add up to the move for the client\'s day', () => {
    const market = marketFor(MTN_DETAIL);
    expect(market?.lines).toEqual([
      "The Satrix 40 fell only 0.4% that day. Most of MTN.JO's move was specific to MTN.JO, "
        + 'not the wider market.',
      'Market-adjusted move: -10.6%',
    ]);
    expect(market?.why).toBe(
      'MTN.JO typically moves about 0.48× the market. On a -0.4% market day that predicts about '
        + "-0.2%, leaving -10.6% that the market doesn't explain.",
    );
  });

  it('describes a market move, a mixed one and one against the market', () => {
    const parts = { stock_return_pct: -4.0, market_return_pct: -3.0, beta: 1.2, market_component_pct: -3.6, company_component_pct: -0.4 };
    expect(marketFor({ ...MTN_DETAIL, move_type: 'market', decomposition: parts })?.lines[0]).toBe(
      'The whole market moved: the Satrix 40 fell 3.0%, which explains most of this move.',
    );

    const mixed = { ...parts, market_component_pct: -2.0, company_component_pct: -2.0 };
    expect(marketFor({ ...MTN_DETAIL, move_type: 'mixed', decomposition: mixed })?.lines[0]).toBe(
      'Part of this was the market (-2.0%) and part was specific to MTN.JO (-2.0%).',
    );

    const against = { ...parts, market_return_pct: 0.8, market_component_pct: 0.4, company_component_pct: -4.4 };
    expect(marketFor({ ...MTN_DETAIL, move_type: 'against_market', decomposition: against })?.lines[0]).toBe(
      'MTN.JO fell while the Satrix 40 rose 0.8%, so this move went against the market.',
    );
  });

  it('rounds each part the same way so the shown pair still adds up', () => {
    const parts = { stock_return_pct: -5.26, market_return_pct: -0.54, beta: 0.48, market_component_pct: -0.26, company_component_pct: -5.0 };
    expect(marketFor({ ...MTN_DETAIL, decomposition: parts })?.lines[1]).toBe('Market-adjusted move: -5.0%');
  });

  it('gives one line of reason when there is no split, and nothing when there is no detail', () => {
    const missing = { ...MTN_DETAIL, decomposition: null, decomposition_reason: 'benchmark_missing_day' };
    expect(marketFor(missing)?.lines).toEqual([
      "We can't split this move into market and company parts: the Satrix 40 has no price for "
        + 'the day before.',
    ]);
    expect(marketFor({ ...MTN_DETAIL, available: false, decomposition: null })?.kind).toBe('none');
    expect(marketFor(null)).toBeNull();
  });

  it('keeps the meaning for a holding that is its own benchmark', () => {
    const self = { ticker: 'STX40.JO', reason: 'benchmark_is_self', benchmark_label: 'Satrix 40' };
    expect(marketFor(self)?.lines[0]).toContain('is the Satrix 40 itself, so this was the market moving');
  });
});

describe('afterEventFor', () => {
  it('says where it stood when the gap outlasted the band', () => {
    expect(afterEventFor(MTN_DETAIL)).toBe(
      '10 trading days later, MTN.JO was still 10.6% below where its usual relationship with '
        + 'the market would put it.',
    );
  });

  it('says nothing when it is inside the band or not there yet', () => {
    const inside = { ...MTN_DETAIL, after_event: { ...MTN_DETAIL.after_event, significant: false } };
    expect(afterEventFor(inside)).toBeNull();
    expect(afterEventFor({ ...MTN_DETAIL, after_event: null })).toBeNull();
  });
});

describe('newsFor', () => {
  it('says plainly when there is no article, and that the move was the company\'s own', () => {
    const news = newsFor(MTN_DETAIL);
    expect(news?.warning).toBe('No matching news found');
    expect(news?.body).toBe(
      "We don't have a stored news article close enough to this date to point to a possible "
        + 'cause. The move is still unusually large and mostly specific to MTN.JO; we just '
        + "can't link it to a news event.",
    );
  });

  it('lists why each article is there, and never that it caused the move', () => {
    const withNews = {
      ...MTN_DETAIL,
      possible_explanations: [{
        article_id: 'a', title: 'MTN shares slide', url: 'https://example.com/a',
        source_name: 'Moneyweb', published_at: '2026-07-30T06:00:00Z', relevance: 'close',
        evidence: { named_in_headline: true, days_from_event: -1, highlight: 'MTN fell after a court ruling' },
      }],
    };
    const news = newsFor(withNews);
    expect(news?.articles[0]).toEqual({
      id: 'a',
      title: 'MTN shares slide',
      url: 'https://example.com/a',
      source: 'Moneyweb',
      published: '30 July 2026',
      reasons: ['Names MTN.JO in the headline', 'Published 1 day before'],
      quote: 'MTN fell after a court ruling',
      relevance: 'Closely related',
    });
    expect(news?.caption).toBe(
      "These articles were published around the move and mention MTN.JO. That doesn't mean they "
        + 'caused it.',
    );
  });

  it.each([
    [0, 'Published the same day'],
    [1, 'Published the day after'],
    [-3, 'Published 3 days before'],
  ])('reads %s days from the event as "%s"', (days, words) => {
    const one = { ...MTN_DETAIL, possible_explanations: [{ article_id: 'a', title: 't', relevance: 'related', evidence: { days_from_event: days } }] };
    expect(newsFor(one)?.articles[0].reasons).toEqual([words]);
    expect(newsFor(one)?.articles[0].relevance).toBe('Related');
  });

  it('still lists an article stored before evidence existed, with no reasons or label', () => {
    const old = { ...MTN_DETAIL, possible_explanations: [{ article_id: 'a', title: 'Old story', source_name: 'X', published_at: '2026-07-31T06:00:00Z' }] };
    const article = newsFor(old)?.articles[0];
    expect(article?.reasons).toEqual([]);
    expect(article?.relevance).toBeNull();
    expect(article?.quote).toBeNull();
  });

  it('waits for the detail', () => {
    expect(newsFor(null)).toBeNull();
  });
});

describe('the details panel', () => {
  const SCAN = {
    k_sigma: 3,
    coverage: {
      scored_days_total: 1000,
      expected_by_chance: 2.7,
      chance_note: 'if daily moves were normally distributed; real returns have fatter tails, so expect more',
      news_last_collected_at: '2026-09-25T00:41:12Z',
    },
  };

  it('lists the detector and the fit, alpha with its error', () => {
    const rows = Object.fromEntries(detailRowsFor(MTN, MTN_DETAIL, SCAN).map((r) => [r.label, r.value]));
    expect(rows['normal daily move (σ)']).toBe('1.86%');
    expect(rows.detector).toBe('EWMA, λ 0.94, flagged beyond k = 3.0σ');
    expect(rows['α ± SE']).toBe('0.00000 ± 0.00030 (t = 0.00)');
    expect(rows['σ of abnormal returns']).toBe('0.30%');
    expect(rows['expected from the market']).toBe('-0.19%');
    expect(rows['abnormal move']).toBe('-10.61%');
    expect(rows['estimation window']).toBe('[-120, -21] trading days, 2026-02-05 to 2026-06-30');
  });

  it('keeps only the detector rows when the model was not fitted', () => {
    expect(detailRowsFor(MTN, { available: false }, null).map((r) => r.label)).toEqual([
      'normal daily move (σ)', 'annualised volatility', 'detector',
    ]);
  });

  it('explains the band, the chance baseline and when news was collected', () => {
    expect(carSentence(MTN_DETAIL)).toBe(
      'By t+10 the cumulative abnormal return was -10.61%, outside its 95% band of -12.97% to '
        + '-8.25%. The band is the range the market model expects nineteen times out of twenty.',
    );
    expect(chanceFor(SCAN)).toBe(
      "Across 1000 scored holding-days we'd expect about 2.7 flags by chance alone if daily moves "
        + 'were normally distributed; real returns have fatter tails, so expect more.',
    );
    expect(collectedFor(SCAN)).toBe('News last collected 25 September 2026.');
    expect(chanceFor({ coverage: {} })).toBeNull();
    expect(collectedFor({ coverage: { news_last_collected_at: null } })).toBeNull();
  });

  it('says where each article came from', () => {
    const article = { evidence: { ingest_mode: 'backfill', collected_at: '2026-09-27T13:05:00Z' } };
    expect(provenanceFor(article)).toBe('Collected by historical backfill on 27 September 2026.');
    expect(provenanceFor({ evidence: { ingest_mode: null } })).toBeNull();
  });
});

describe('breadthFor', () => {
  /** @param {any} sameDay */
  const withDay = (sameDay, moveType = 'mixed') => ({ ...MTN_DETAIL, move_type: moveType, same_day: sameDay });
  const SIX = {
    scanned: 48, unusual: 7, same_direction: 6, expected_by_chance: 0.13,
    tickers: ['SBK.JO', 'FSR.JO', 'NED.JO', 'ABG.JO', 'CPI.JO'],
  };

  it('says the move was shared, and names the first three that went the same way', () => {
    expect(breadthFor(MTN, withDay(SIX))).toBe(
      "It wasn't alone: 6 of the 48 large caps we track also fell unusually that day "
        + '(SBK.JO, FSR.JO, NED.JO).',
    );
  });

  it('points at a sector the index missed when a company-sized move was shared', () => {
    expect(breadthFor(MTN, withDay(SIX, 'company'))).toBe(
      "It wasn't alone: 6 of the 48 large caps we track also fell unusually that day "
        + '(SBK.JO, FSR.JO, NED.JO), so this may have been a sector or market shock that the '
        + 'index did not fully capture.',
    );
  });

  it('says rose for a rise', () => {
    expect(breadthFor({ ...MTN, return_pct: 7.2 }, withDay(SIX))).toMatch(/also rose unusually/);
  });

  it('needs three the same way: two is not a shock', () => {
    expect(breadthFor(MTN, withDay({ ...SIX, same_direction: 3 }))).toMatch(/^It wasn't alone: 3 of/);
    expect(breadthFor(MTN, withDay({ ...SIX, unusual: 2, same_direction: 2 }))).toBeNull();
  });

  it('says a quiet day was quiet only when enough were scanned for that to mean something', () => {
    const quiet = { scanned: 20, unusual: 0, same_direction: 0, expected_by_chance: 0.05, tickers: [] };
    expect(breadthFor(MTN, withDay(quiet))).toBe(
      'None of the other 20 large caps we track moved unusually that day.',
    );
    expect(breadthFor(MTN, withDay({ ...quiet, scanned: 19 }))).toBeNull();
  });

  it('says nothing when the backend sent no count', () => {
    expect(breadthFor(MTN, withDay(null))).toBeNull();
    expect(breadthFor(MTN, null)).toBeNull();
  });

  it('always shows the count and the chance baseline in the details', () => {
    const one = { scanned: 48, unusual: 1, same_direction: 0, expected_by_chance: 0.13, tickers: [] };
    const rows = Object.fromEntries(detailRowsFor(MTN, withDay(one), null).map((r) => [r.label, r.value]));
    expect(rows['same day']).toBe(
      '1 of 48 unusual that day (0 the same way); about 0.13 expected by chance if moves were '
        + 'independent.',
    );
    expect(detailRowsFor(MTN, withDay(null), null).map((r) => r.label)).not.toContain('same day');
  });
});