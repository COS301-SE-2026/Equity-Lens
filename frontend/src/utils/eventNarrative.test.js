import { describe, it, expect } from 'vitest';

import {
  longDate,
  buildEventNarrative,
  buildEventQuestion,
  buildWorkingEquation,
  buildWorkingRows,
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

describe('buildEventNarrative', () => {
  it('splits the move into the part the market explains and the part it does not', () => {
    const n = buildEventNarrative(EVENT, DETAIL);

    expect(n.headline).toBe('NPN.JO fell 8.4% on 14 August 2026');
    expect(n.tone).toBe('down');
    expect(n.marketPart).toBe(
      'The Satrix 40 moved -1.1% that day, and NPN.JO usually moves about 0.48 times as much ' +
        'as the market, so roughly -0.5% of the move was the market.',
    );
    expect(n.companyPart).toBe('The remaining -7.9% was specific to NPN.JO.');
    expect(n.abnormalPart).toBe(
      "That is 3.4 times NPN.JO's own normal daily swing, measured against 31.4% a year over " +
        '246 trading days.',
    );
    expect(n.confidence).toBe(
      '10 trading days later it was still -6.2% away from where its relationship to the ' +
        'Satrix 40 put it, outside the range you would expect nineteen times out of twenty.',
    );});

  it('reads the window length it actually got rather than assuming ten days', () => {
    const clamped = {
      ...DETAIL,
      abnormal_returns: [
        DETAIL.abnormal_returns[0],
        { ...DETAIL.abnormal_returns[1], offset: 3, cumulative_abnormal_return_pct: -7.04, significant: false },
      ],
    };
    expect(buildEventNarrative(EVENT, clamped).confidence).toBe(
      '3 trading days later it was still -7.0% away from where its relationship to the ' +
        'Satrix 40 put it, which is inside the range you would expect from ordinary variation.',
    );
  });

  it('still describes the move when the model could not be fitted', () => {
    const refused = { available: false, reason: 'insufficient_history', observations: 0, abnormal_returns: [] };
    const n = buildEventNarrative(EVENT, refused);

    expect(n.headline).toBe('NPN.JO fell 8.4% on 14 August 2026');
    expect(n.abnormalPart).toContain('3.4 times');
    expect(n.marketPart).toBeNull();
    expect(n.companyPart).toBeNull();
    expect(n.confidence).toBeNull();
  });

  it('says rose for an up move', () => {
    const up = { ...EVENT, direction: 'up', return_pct: 6.18, z_score: 3.05 };
    const n = buildEventNarrative(up, null);
    expect(n.headline).toBe('NPN.JO rose 6.2% on 14 August 2026');
    expect(n.tone).toBe('up');
  });
});

describe('buildEventQuestion', () => {
  it('carries every figure the assistant needs, and the instruction not to invent a cause', () => {
    const q = buildEventQuestion(EVENT, DETAIL);

    expect(q).toContain('NPN.JO fell 8.4% on 14 August 2026.');
    expect(q).toContain('has a beta of 0.48 and an R-squared of 0.41');
    expect(q).toContain('leaving an abnormal return of -7.9%');
    expect(q).toContain('3.4 standard deviations out');
    expect(q).toContain('annualised volatility of 31.4% over 246 trading days');
    expect(q).toContain('Do not state a specific cause; you have not been given one.');
  });

  it('drops the fitted figures rather than inventing them when there is no model', () => {
    const q = buildEventQuestion(EVENT, { available: false, abnormal_returns: [] });
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
  it('substitutes this event\'s numbers into the model', () => {
    const worked = buildWorkingEquation({
      ...DETAIL,
      alpha: 0.00080,
      beta: 0.66,
      abnormal_returns: [{ ...DETAIL.abnormal_returns[0], market_return_pct: -1.10 }],
    });

    expect(worked?.formula).toBe('expected return = alpha + beta × benchmark return');
    expect(worked?.substituted).toBe('0.08% + 0.66 × -1.10% = -0.65%');
    expect(worked?.result).toContain('so the abnormal return is -7.90%');
  });

  it('has nothing to show without a fit or an event-day row', () => {
    expect(buildWorkingEquation({ available: false })).toBeNull();
    expect(buildWorkingEquation(undefined)).toBeNull();
    expect(buildWorkingEquation({ ...DETAIL, abnormal_returns: [] })).toBeNull();
  });});