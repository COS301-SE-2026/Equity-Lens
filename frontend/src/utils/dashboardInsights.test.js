import { describe, it, expect } from 'vitest';
import {
  buildSummary,
  buildSectors,
  buildInsights,
  buildAttrib,
  buildDriver,
  concWording,
  filterByRange,
  isFund,
  buildChartStats,
  buildSectorQuestions,
  buildHealthQuestions,
  buildPerformanceQuestions,
  buildHoldingsQuestions,
  buildGoalQuestions,
  buildTaxQuestions,
  buildContributionMessage,
} from './dashboardInsights';

/** @param {number} daysAgo */
const dateNDaysAgo = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const SERIES = [
  { date: dateNDaysAgo(400), name: 'old', value: 100000 },
  { date: dateNDaysAgo(60), name: '2mo', value: 105000 },
  { date: dateNDaysAgo(20), name: '3wk', value: 108000 },
  { date: dateNDaysAgo(3), name: 'recent', value: 110000 },
  { date: dateNDaysAgo(0), name: 'today', value: 111000 },
];

describe('filterByRange', () => {
  it('returns everything for ALL', () => {
    expect(filterByRange(SERIES, 'ALL').series).toHaveLength(5);
  });

  it('keeps only points within the last year for 1Y', () => {
    const { series: result } = filterByRange(SERIES, '1Y');
    expect(result.map((p) => p.name)).toEqual(['2mo', '3wk', 'recent', 'today']);
  });

  it('keeps only points within the last month for 1M', () => {
    const { series: result } = filterByRange(SERIES, '1M');
    expect(result.map((p) => p.name)).toEqual(['3wk', 'recent', 'today']);
  });

  it('falls back to the last two points instead of going blank when a narrow range has under two matches', () => {
    const { series: result } = filterByRange(SERIES, '1D');
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].name).toBe('today');
  });

  it('passes through an unrecognised range unfiltered rather than erroring', () => {
    // @ts-expect-error for NOTRIGHT (Not Right)
    expect(filterByRange(SERIES, 'NOTRIGHT').series).toHaveLength(5);
  });
});

describe('buildSummary', () => {
  it('ranks single-stock risk above sector risk', () => {
    const holdings = [
      { ticker: 'NPN', value: 45000, sector: 'Technology', daily_change_pct: 1.2 },
      { ticker: 'SBK', value: 32000, sector: 'Financials', daily_change_pct: 0.5 },
    ];
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [{ ticker: 'NPN', contribution: 540 }], drags: [] };
    const chartStats = { diff: '+4.0%', diffPct: 4.02, benchAvailable: true };

    const summary = buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct: 0 });

    expect(summary.headline).toBe(
      '58% of your portfolio is in NPN, making it your biggest source of risk.',
    );
    expect(summary.supportingText).toEqual([
      '58% of your book is in Technology, adding sector concentration risk.',
      'Only 2 positions make up your entire book.',
    ]);
    expect(summary.severity).toBe('risk');
    expect(summary.badge).toBe('Concentration');
  });

  it('dedupes "Ask AI Why" chips', () => {
    const holdings = [
      { ticker: 'NPN', value: 45000, sector: 'Technology', daily_change_pct: 1.2 },
      { ticker: 'SBK', value: 32000, sector: 'Financials', daily_change_pct: 0.5 },
    ];
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [{ ticker: 'NPN', contribution: 540 }], drags: [] };
    const chartStats = { diff: '+4.0%', diffPct: 4.02, benchAvailable: true };

    const summary = buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct: 0 });

    const askWhyChips = summary.suggestedActions.filter((a) => a.label === 'Ask AI Why');
    expect(askWhyChips).toHaveLength(1);
    expect(askWhyChips[0].prefill).toBe('Why is my NPN concentration considered a risk?');
    expect(summary.suggestedActions.length).toBeLessThanOrEqual(3);
  });

  it('falls back to a balanced overview', () => {
    const holdings = ['Financials', 'Technology', 'Healthcare', 'Consumer', 'Industrials', 'Telecommunications'].map(
      (sector, i) => ({ ticker: `T${i}`, value: 15000, sector, daily_change_pct: 0.1 }),
    );
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [{ ticker: 'T0', contribution: 15 }], drags: [] };
    const chartStats = { diff: '+0.5%', diffPct: 0.5, benchAvailable: true };

    const summary = buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct: 0.1 });

    expect(summary.headline).toBe(
      'Your holdings are well diversified, no company is more than 17% of your book.',
    );
    expect(summary.severity).toBe('neutral');
    expect(summary.badge).toBe('Overview');
    expect(summary.suggestedActions).toEqual([
      { label: 'Ask AI Why', to: '/ai', prefill: 'What should I be watching in my portfolio right now?' },
    ]);
  });

  it('prompts for import when there are no holdings', () => {
    const summary = buildSummary({
      holdings: [],
      sectorData: [],
      attribution: { contributors: [], drags: [] },
      chartStats: { diff: '-', diffPct: 0, benchAvailable: false },
      dailyChangePct: 0,
    });

    expect(summary.headline).toBe('Import a portfolio to see your executive summary.');
    expect(summary.suggestedActions).toEqual([{ label: 'Import Portfolio', to: '/portfolio' }]);
    expect(summary.signals).toEqual([]);
  });

  it('exposes the full ranked signal list, not just the collapsed headline', () => {
    const holdings = [
      { ticker: 'NPN', value: 45000, sector: 'Technology', daily_change_pct: 1.2 },
      { ticker: 'SBK', value: 32000, sector: 'Financials', daily_change_pct: 0.5 },
    ];
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [{ ticker: 'NPN', contribution: 540 }], drags: [] };
    const chartStats = { diff: '+4.0%', diffPct: 4.02, benchAvailable: true };

    const summary = buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct: 0 });

    expect(summary.signals.length).toBeGreaterThan(1);
    expect(summary.signals.map((s) => s.badge)).toContain('Concentration');
    expect(summary.signals.map((s) => s.badge)).toContain('Diversification');
  });
});

/** @param {string} ticker @param {number} value @param {string} sector */
const fund = (ticker, value, sector) => ({
  ticker,
  value,
  sector,
  kind: 'etf',
  region: 'South Africa',
  gain_loss_pct: 1,
  daily_change_pct: 0,
});

const ETF_BOOK = [fund('CTOP50.JO', 5100, 'SA Equity'), fund('EASYAI.JO', 4900, 'Global Equity')];

const FLAT_STATS = { diff: '-', diffPct: 0, benchAvailable: false };
const NO_ATTRIBUTION = { contributors: [], drags: [], todayReturn: 0 };

describe('isFund', () => {
  it('treats a missing kind as a stock so older payloads read unchanged', () => {
    expect(isFund({ ticker: 'NPN.JO' })).toBe(false);
    expect(isFund(undefined)).toBe(false);
    expect(isFund({ kind: 'etf' })).toBe(true);
  });
});

describe('concWording', () => {
  it('does not describe a fund as having single-stock or earnings risk', () => {
    const wording = concWording({ kind: 'etf' });
    expect(wording.label).toBe('Fund Concentration');
    expect(wording.risk).not.toMatch(/single-stock/i);
    expect(wording.risk).not.toMatch(/earnings/i);
  });

  it('keeps the single-stock framing for an actual share', () => {
    expect(concWording({ kind: 'stock' }).label).toBe('Single-Stock Risk');
  });
});

describe('buildSummary with funds', () => {
  it('describes a dominant fund as a fund rather than a source of stock risk', () => {
    const holdings = [
      { ticker: 'CTOP50.JO', value: 9000, sector: 'SA Equity', kind: 'etf', daily_change_pct: 0 },
      { ticker: 'EASYAI.JO', value: 1000, sector: 'Global Equity', kind: 'etf', daily_change_pct: 0 },
    ];
    const summary = buildSummary({
      holdings,
      sectorData: buildSectors(holdings).sectors,
      attribution: NO_ATTRIBUTION,
      chartStats: FLAT_STATS,
      dailyChangePct: 0,
    });

    expect(summary.headline).toMatch(/one fund/i);
  });
});

describe('buildInsights (today-focused)', () => {
  it('returns nothing when there are no holdings', () => {
    expect(buildInsights({ holdings: [], attribution: NO_ATTRIBUTION }).insights).toEqual([]);
  });

  it("surfaces today's biggest gainer, biggest drag and driver - not since-purchase copy", () => {
    const holdings = [
      { ticker: 'NPN.JO', value: 45000, sector: 'Technology', daily_change_pct: 2.5 },
      { ticker: 'SBK.JO', value: 32000, sector: 'Financials', daily_change_pct: -1.8 },
    ];
    const attribution = buildAttrib(holdings);
    const { sectors: sectorData } = buildSectors(holdings);
    const { insights } = buildInsights({ holdings, attribution, sectorData });

    const gain = insights.find((i) => i.type === 'gain');
    if (!gain) throw new Error('expected a gain insight');
    expect(gain.text).toMatch(/npn\.jo is today's biggest gainer, up 2\.5%/i);
    expect(gain.text).not.toMatch(/since (purchase|you started investing)/i);

    const loss = insights.find((i) => i.type === 'loss');
    if (!loss) throw new Error('expected a loss insight');
    expect(loss.text).toMatch(/sbk\.jo is today's biggest drag, down 1\.8%/i);

    expect(insights.find((i) => i.type === 'driver')).toBeDefined();
  });

  it('flags a missing sector as an opportunity - Rebalancing Insights used to own this signal', () => {
    const holdings = ['Financials', 'Technology', 'Consumer', 'Industrials', 'Telecommunications'].map((sector, i) => ({
      ticker: `T${i}`,
      value: 20000,
      sector,
      daily_change_pct: 0,
    }));
    const attribution = buildAttrib(holdings);
    const { sectors: sectorData } = buildSectors(holdings);
    const { insights } = buildInsights({ holdings, attribution, sectorData });

    const opportunity = insights.find((i) => i.type === 'opportunity');
    if (!opportunity) throw new Error('expected an opportunity insight');
    expect(opportunity.text).toBe('You have no Healthcare exposure - a common gap in balanced JSE portfolios.');
    expect(opportunity.action).toEqual({ label: 'Explore Sector Allocation', target: 'sector-allocation' });
  });

  it('degrades to just the driver insight on a flat day, no broken gain/loss cards', () => {
    const holdings = [{ ticker: 'NPN.JO', value: 45000, sector: 'Technology', daily_change_pct: 0 }];
    const attribution = buildAttrib(holdings);
    const { insights } = buildInsights({ holdings, attribution });

    expect(insights.some((i) => i.type === 'gain')).toBe(false);
    expect(insights.some((i) => i.type === 'loss')).toBe(false);
    const driver = insights.find((i) => i.type === 'driver');
    if (!driver) throw new Error('expected a driver insight');
    expect(driver.text).toBe('Your portfolio was flat today.');
  });

  it('adds an Ask AI Why action for an unusually large, unexplained move', () => {
    const holdings = [
      { ticker: 'NPN.JO', value: 45000, sector: 'Technology', daily_change_pct: 8 },
      { ticker: 'SBK.JO', value: 32000, sector: 'Financials', daily_change_pct: 0.2 },
    ];
    const attribution = buildAttrib(holdings);
    const { insights } = buildInsights({ holdings, attribution });
    const gain = insights.find((i) => i.type === 'gain');
    if (!gain?.action) throw new Error('expected the gain insight to carry an action');
    expect(gain.action.label).toBe('Ask AI Why');
    expect(gain.action.to).toContain('/ai?q=');
  });
});

describe('buildSectors with exposure buckets', () => {
  it('no longer collapses a book of ETFs into one Other slice', () => {
    const buckets = buildSectors(ETF_BOOK).sectors.map((s) => s.name);
    expect(buckets).not.toContain('Other');
    expect(buckets).toEqual(expect.arrayContaining(['SA Equity', 'Global Equity']));
  });
});

describe('buildChartStats', () => {
  const SERIES_WITH_BENCH = [
    { date: '2026-07-01', name: 'Jul 01', value: 100000, benchmark: 100000 },
    { date: '2026-08-01', name: 'Aug 01', value: 120000, benchmark: 104000 },
  ];

  it('derives both portfolio and benchmark return from the same series - no backend TWR needed', () => {
    const stats = buildChartStats(SERIES_WITH_BENCH);
    expect(stats.portAvailable).toBe(true);
    expect(stats.portReturn).toBe('+20.0%');
    expect(stats.benchAvailable).toBe(true);
    expect(stats.benchReturn).toBe('+4.0%');
    expect(stats.diffPct).toBeCloseTo(16, 5);
  });

  it('is unavailable with fewer than two data points', () => {
    const stats = buildChartStats([SERIES_WITH_BENCH[0]]);
    expect(stats.portAvailable).toBe(false);
    expect(stats.benchAvailable).toBe(false);
    expect(stats.diff).toBe('-');
  });

  it('still derives bestDay/worstDay from the visible series', () => {
    const stats = buildChartStats(SERIES_WITH_BENCH);
    expect(stats.bestDay).toContain('Aug 01');
  });
});

describe('buildSectorQuestions', () => {
  it('names the actual top sector and its real percentage, not a placeholder', () => {
    const questions = buildSectorQuestions([{ name: 'Technology', value: 26.4 }, { name: 'Financials', value: 20 }]);
    expect(questions[0]).toBe('Why is Technology 26% of my portfolio?');
    expect(questions.some((q) => q.includes('Technology'))).toBe(true);
  });

  it('reflects a different top sector when the data changes', () => {
    const questions = buildSectorQuestions([{ name: 'Healthcare', value: 41 }]);
    expect(questions[0]).toBe('Why is Healthcare 41% of my portfolio?');
    expect(questions.some((q) => q.includes('Technology'))).toBe(false);
  });

  it('returns no questions when there is no sector data', () => {
    expect(buildSectorQuestions([])).toEqual([]);
  });
});

describe('buildHealthQuestions', () => {
  it('leads with the overview question, then names the actual weakest subscore', () => {
    const health = {
      score: 6.2,
      subscores: [
        { key: 'sectorConcentration', label: 'Sector Concentration', value: 8 },
        { key: 'singleStockRisk', label: 'Single-Stock Risk', value: 3.5 },
        { key: 'portfolioBreadth', label: 'Portfolio Breadth', value: 7 },
      ],
    };
    const questions = buildHealthQuestions(health);
    expect(questions[0]).toBe('Why is my portfolio health 6.2/10?');
    expect(questions[1]).toBe('How can I improve my Single-Stock Risk score?');
    expect(questions).toHaveLength(2);
  });

  it('asks about every factor below the healthy cutoff, not just the single worst one', () => {
    const health = {
      score: 4.9,
      subscores: [
        { key: 'sectorConcentration', label: 'Sector Concentration', value: 1.5 },
        { key: 'singleStockRisk', label: 'Single-Stock Risk', value: 8 },
        { key: 'portfolioBreadth', label: 'Portfolio Breadth', value: 5 },
      ],
    };
    const questions = buildHealthQuestions(health);
    expect(questions[1]).toBe('How can I improve my Sector Concentration score?');
    expect(questions[2]).toBe('How can I improve my Portfolio Breadth score?');
    expect(questions.some((q) => q.includes('Single-Stock Risk'))).toBe(false);
  });

  it('asks a distinct "how do I stay this way" question when every factor is healthy', () => {
    const health = {
      score: 9.1,
      subscores: [
        { key: 'sectorConcentration', label: 'Sector Concentration', value: 8 },
        { key: 'singleStockRisk', label: 'Single-Stock Risk', value: 9 },
        { key: 'portfolioBreadth', label: 'Portfolio Breadth', value: 9.5 },
      ],
    };
    const questions = buildHealthQuestions(health);
    expect(questions).toHaveLength(2);
    expect(questions[1]).toMatch(/how do I stay this diversified/i);
  });

  it('returns no questions when there is no score yet', () => {
    expect(buildHealthQuestions({ score: null, subscores: [] })).toEqual([]);
  });
});

describe('buildPerformanceQuestions', () => {
  it('asks about outperformance with the real gap and benchmark name', () => {
    const questions = buildPerformanceQuestions({ diffPct: 3.2, benchAvailable: true, benchmarkLabel: 'JSE ALSI' });
    expect(questions[0]).toBe('Why am I outperforming the JSE ALSI by 3.2%?');
  });

  it('asks about underperformance when the gap is negative, using the real figure', () => {
    const questions = buildPerformanceQuestions({ diffPct: -5.7, benchAvailable: true, benchmarkLabel: 'JSE ALSI' });
    expect(questions[0]).toBe('Why am I underperforming the JSE ALSI by 5.7%?');
  });

  it('asks about close tracking instead of outperformance when the gap is negligible', () => {
    const questions = buildPerformanceQuestions({ diffPct: 0.3, benchAvailable: true, benchmarkLabel: 'JSE ALSI' });
    expect(questions[0]).toMatch(/tracking the JSE ALSI so closely/i);
  });

  it('still offers generic questions when there is nothing to compare against', () => {
    const questions = buildPerformanceQuestions({ diffPct: 0, benchAvailable: false, benchmarkLabel: 'JSE ALSI' });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.toLowerCase().includes('benchmark'))).toBe(false);
  });
});

describe('buildHoldingsQuestions', () => {
  it('names the actual top holding and its real weight', () => {
    const holdings = [
      { ticker: 'NPN', value: 45000 },
      { ticker: 'SBK', value: 32000 },
    ];
    const questions = buildHoldingsQuestions(holdings);
    expect(questions[0]).toBe('Why is NPN 58% of my portfolio?');
    expect(questions.some((q) => q.includes('NPN'))).toBe(true);
  });

  it('asks a "well diversified" question instead when concentration is low', () => {
    const holdings = [
      { ticker: 'NPN', value: 10000 },
      { ticker: 'SBK', value: 10000 },
      { ticker: 'FSR', value: 10000 },
      { ticker: 'MTN', value: 10000 },
      { ticker: 'AGL', value: 10000 },
    ];
    const questions = buildHoldingsQuestions(holdings);
    expect(questions.some((q) => q.includes('well diversified'))).toBe(true);
  });

  it('returns no questions with no holdings', () => {
    expect(buildHoldingsQuestions([])).toEqual([]);
  });
});

describe('buildGoalQuestions', () => {
  it('asks about the real target date and probability', () => {
    const questions = buildGoalQuestions({
      progress: { target_date: '2040-06-01' },
      simulation: { probability_pct: 72 },
    });
    expect(questions[0]).toBe('Am I on track to hit my target by Jun 2040?');
    expect(questions[1]).toBe('How can I improve my 72% probability of reaching my goal?');
  });

  it('asks a more direct question when the probability is genuinely off track', () => {
    const questions = buildGoalQuestions({
      progress: { target_date: '2040-06-01' },
      simulation: { probability_pct: 22 },
    });
    expect(questions[1]).toMatch(/only 22%.*what should I change/i);
  });

  it('skips the probability question when the simulation has none', () => {
    const questions = buildGoalQuestions({ progress: { target_date: '2040-06-01' }, simulation: null });
    expect(questions).toHaveLength(1);
  });

  it('returns no questions when there is no goal yet', () => {
    expect(buildGoalQuestions({ progress: null, simulation: null })).toEqual([]);
  });
});

describe('buildTaxQuestions', () => {
  it('asks about the real taxable gain when there is one', () => {
    const questions = buildTaxQuestions({ available: true, taxable_capital_gain: 15000, assessed_capital_loss: null });
    expect(questions[0]).toMatch(/15\s?000.*taxable capital gain/i);
  });

  it('asks about the assessed loss instead when the position is a loss', () => {
    const questions = buildTaxQuestions({ available: true, taxable_capital_gain: null, assessed_capital_loss: 4000 });
    expect(questions[0]).toMatch(/assessed capital loss of.*4\s?000/i);
  });

  it('adds a tax-loss harvesting question when a potential realised loss exists', () => {
    const questions = buildTaxQuestions({
      available: true,
      taxable_capital_gain: 15000,
      assessed_capital_loss: null,
      potential_realised_loss: 2000,
    });
    expect(questions.some((q) => q.toLowerCase().includes('tax-loss harvesting'))).toBe(true);
  });

  it('asks why tax is exempt instead of nothing for TFSA/RA accounts', () => {
    expect(buildTaxQuestions({ available: false, reason: 'tfsa_exempt' })).toEqual([
      "Why isn't tax shown for this account?",
    ]);
    expect(buildTaxQuestions({ available: false, reason: 'retirement_annuity_exempt' })).toEqual([
      "Why isn't tax shown for this account?",
    ]);
  });

  it('returns no questions when an estimate is unavailable for a fixable reason', () => {
    expect(buildTaxQuestions({ available: false, reason: 'account_type_unknown' })).toEqual([]);
    expect(buildTaxQuestions({ available: false })).toEqual([]);
  });
});

describe('buildContributionMessage', () => {
  it('asks the user to set a contribution when unset and one is still required', () => {
    const msg = buildContributionMessage({ requiredMonthly: 2500, monthlyContribution: null });
    expect(msg).toMatch(/set a monthly contribution/i);
  });

  it('does not ask the user to set a contribution when unset but required is already ~0 (backlog 5)', () => {
    const msg = buildContributionMessage({ requiredMonthly: 0, monthlyContribution: undefined });
    expect(msg).not.toMatch(/set a monthly contribution/i);
    expect(msg).toMatch(/on track/i);
  });

  it('treats a required amount rounding to 0 the same as an exact 0 in the unset case', () => {
    const msg = buildContributionMessage({ requiredMonthly: 0.4, monthlyContribution: null });
    expect(msg).not.toMatch(/set a monthly contribution/i);
  });

  it('tells the user to invest more when contributing below the required amount', () => {
    const msg = buildContributionMessage({ requiredMonthly: 3000, monthlyContribution: 1000 });
    expect(msg).toMatch(/invest about/i);
  });

  it('says on track when already contributing at least the required amount', () => {
    const msg = buildContributionMessage({ requiredMonthly: 1000, monthlyContribution: 1000 });
    expect(msg).toMatch(/on track/i);
  });
});

describe('buildDriver (dashboard data-integrity review, finding #1)', () => {
  it("shows the driver's share of the same-direction total, not gain+decline combined", () => {
    const holdings = [
      { ticker: 'NPN.JO', value: 103773, daily_change_pct: -0.43 },
      { ticker: 'SBK.JO', value: 25839, daily_change_pct: -0.61 },
      { ticker: 'STX40.JO', value: 16053, daily_change_pct: -1.0 },
      { ticker: 'AGL.JO', value: 13153, daily_change_pct: 0.96 },
      { ticker: 'MTN.JO', value: 8678, daily_change_pct: 2.65 },
    ];
    const attribution = buildAttrib(holdings);
    const { driver } = buildDriver({ holdings, attribution });

    if (!driver) throw new Error('expected a driver');
    expect(driver.text).toBe("79% of today's decline came from NPN.JO and STX40.JO.");
    expect(driver.text).not.toMatch(/54%/);
    expect(driver.tickers).toEqual(['NPN.JO', 'STX40.JO']);
  });

  it('still gates on the combined-total share before naming individual tickers', () => {
    const holdings = [
      { ticker: 'AGL.JO', value: 50000, daily_change_pct: -3 },
      { ticker: 'MTN.JO', value: 10000, daily_change_pct: 0.5 },
    ];
    const attribution = buildAttrib(holdings);
    const { driver } = buildDriver({ holdings, attribution });

    if (!driver) throw new Error('expected a driver');
    expect(driver.tickers).toEqual(['AGL.JO']);
    expect(driver.text).toMatch(/^100% of today's decline came from AGL\.JO\.$/);
  });
});
