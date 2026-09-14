import { describe, it, expect } from 'vitest';
import {
  askAiWhy,
  buildSummary,
  buildSectors,
  buildInsights,
  buildAttrib,
  filterByRange,
  buildChartStats,
  buildExplanation,
  buildSectorQuestions,
  buildHealthQuestions,
  buildPerformanceQuestions,
  buildHoldingsQuestions,
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
    expect(askWhyChips[0].question).toBe('Why is my NPN concentration considered a risk?');
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
      {
        label: 'Ask AI Why',
        question: 'What should I be watching in my portfolio right now?',
        to: '/ai?q=What%20should%20I%20be%20watching%20in%20my%20portfolio%20right%20now%3F',
      },
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

  it('keeps the benchmark gap out of the headline but still reports it for the hero', () => {
    const holdings = ['Financials', 'Technology', 'Healthcare', 'Consumer', 'Industrials', 'Telecommunications'].map(
      (sector, i) => ({ ticker: `T${i}`, value: 15000, sector, daily_change_pct: 0.1 }),
    );
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [{ ticker: 'T0', contribution: 15 }], drags: [] };
    const chartStats = { diff: '-33.0%', diffPct: -33, benchAvailable: true };

    const summary = buildSummary({
      holdings,
      sectorData,
      attribution,
      chartStats,
      dailyChangePct: 0.1,
      benchmarkLabel: 'Satrix 40',
    });
    expect(summary.signals.map((s) => s.badge)).toEqual(['Performance']);
    expect(summary.headline).toBe(
      'Your holdings are well diversified, no company is more than 17% of your book.',
    );
    expect(summary.badge).toBe('Overview');
    expect(summary.supportingText).toEqual([]);
    expect(summary.suggestedActions.map((a) => a.label)).not.toContain('Compare Against Benchmark');
    expect(summary.benchmark).toEqual({ available: true, diffPct: -33, label: 'Satrix 40' });
  });

  it('gives every signal its own id, so the panel dedupe cannot suppress the wrong one', () => {
    const holdings = [
      { ticker: 'NPN.JO', value: 90000, sector: 'Technology', daily_change_pct: -2.1 },
      { ticker: 'SBK.JO', value: 10000, sector: 'Financials', daily_change_pct: -0.4 },
    ];
    const { sectors: sectorData } = buildSectors(holdings);

    const summary = buildSummary({
      holdings,
      sectorData,
      attribution: buildAttrib(holdings),
      chartStats: { diff: '-8.0%', diffPct: -8, benchAvailable: true },
      dailyChangePct: -1.9,
      benchmarkLabel: 'Satrix 40',
    });

    const ids = summary.signals.map((sig) => sig.id);
    expect(ids.length).toBeGreaterThan(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('perf.behind-benchmark');
  });

  it('reports no benchmark at all when there is nothing to compare against', () => {
    const empty = buildSummary({
      holdings: [],
      sectorData: [],
      attribution: { contributors: [], drags: [] },
      chartStats: { diff: '-', diffPct: 0, benchAvailable: false },
      dailyChangePct: 0,
    });
    expect(empty.benchmark).toBeNull();

    const holdings = [{ ticker: 'NPN', value: 45000, sector: 'Technology', daily_change_pct: 0 }];
    const unpriced = buildSummary({
      holdings,
      sectorData: buildSectors(holdings).sectors,
      attribution: { contributors: [], drags: [] },
      chartStats: { diff: '-', diffPct: 0, benchAvailable: false },
      dailyChangePct: 0,
    });
    expect(unpriced.benchmark?.available).toBe(false);
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
  // value climbs 20%, but R10,000 of that R20,000 was bought during the window. the
  // backend's twr_index has the purchase taken back out, so the return is 10%
  const SERIES_WITH_BENCH = [
    { date: '2026-07-01', name: 'Jul 01', value: 100000, benchmark: 100000, twr_index: 100 },
    { date: '2026-08-01', name: 'Aug 01', value: 120000, benchmark: 104000, twr_index: 110 },
  ];

  it('reads the portfolio return off the backend index, not off the change in value', () => {
    const stats = buildChartStats(SERIES_WITH_BENCH);
    expect(stats.portAvailable).toBe(true);
    expect(stats.portReturn).toBe('+10.0%');
  });

  it('compares the two over the same window, so the difference means something', () => {
    const stats = buildChartStats(SERIES_WITH_BENCH);
    expect(stats.benchAvailable).toBe(true);
    expect(stats.benchReturn).toBe('+4.0%');
    expect(stats.diffPct).toBeCloseTo(6, 5);
  });

  it('is unavailable with fewer than two data points', () => {
    const stats = buildChartStats([SERIES_WITH_BENCH[0]]);
    expect(stats.portAvailable).toBe(false);
    expect(stats.benchAvailable).toBe(false);
    expect(stats.diff).toBe('-');
  });

  it('measures both legs from the first day that has both, so the three numbers subtract', () => {
     const benchStartsLate = [
      { date: '2026-07-01', name: 'Jul 01', value: 90000, twr_index: 100 },
      { date: '2026-08-01', name: 'Aug 01', value: 100000, benchmark: 100000, twr_index: 110 },
      { date: '2026-09-01', name: 'Sep 01', value: 110000, benchmark: 104000, twr_index: 121 },
    ];

    const stats = buildChartStats(benchStartsLate);

    expect(stats.portReturn).toBe('+10.0%');
    expect(stats.benchReturn).toBe('+4.0%');
    expect(stats.diffPct).toBeCloseTo(6, 10);
    expect(stats.diffPct).toBeCloseTo(10 - 4, 10);
  });

  it('still reports the portfolio on its own range when no day carries a benchmark', () => {
    const noBench = [
      { date: '2026-07-01', name: 'Jul 01', value: 90000, twr_index: 100 },
      { date: '2026-08-01', name: 'Aug 01', value: 100000, twr_index: 110 },
    ];

    const stats = buildChartStats(noBench);

    expect(stats.portReturn).toBe('+10.0%');
    expect(stats.benchAvailable).toBe(false);
    expect(stats.diff).toBe('-');
  });

  it('does not call the day a purchase landed the best day', () => {
    const withPurchase = [
      { date: '2026-07-01', name: 'Jul 01', value: 1600, twr_index: 100 },
      { date: '2026-07-07', name: 'Jul 07', value: 2180, twr_index: 100.2 },
      { date: '2026-07-31', name: 'Jul 31', value: 2194, twr_index: 100.64 },
    ];

    const stats = buildChartStats(withPurchase);

    expect(stats.bestDay).toContain('Jul 31');
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

describe('buildExplanation', () => {
  const ahead = { diffPct: 4.2, benchAvailable: true, diff: '+R 1 000' };
  const behind = { diffPct: -4.2, benchAvailable: true, diff: '-R 1 000' };
  const attribution = {
    contributors: [{ ticker: 'NPN.JO', contribution: 4844 }],
    drags: [{ ticker: 'SBK.JO', contribution: -185 }],
    todayReturn: 4659,
  };

  it('names the contributor and calls it one when the portfolio is up today', () => {
    const { explanation } = buildExplanation({ stats: ahead, attribution });
    expect(explanation).toBe("NPN.JO was today's biggest contributor.");
  });

  // the path that shipped wrong: it picked drags[0] and then called it a contributor
  it('names the drag and calls it a drag when the portfolio is down today', () => {
    const down = { ...attribution, todayReturn: -900 };
    const { explanation } = buildExplanation({ stats: behind, attribution: down });
    expect(explanation).toBe("SBK.JO was today's biggest drag.");
    expect(explanation).not.toMatch(/contributor/);
  });

  it("reads today's direction, not the chart range's, when the two disagree", () => {
    const downToday = { ...attribution, todayReturn: -900 };
    const { explanation } = buildExplanation({ stats: ahead, attribution: downToday });
    expect(explanation).toBe("SBK.JO was today's biggest drag.");
  });

  it('says nothing when the gap is too small to be worth explaining', () => {
    const flat = { diffPct: 0.4, benchAvailable: true, diff: '+R 10' };
    expect(buildExplanation({ stats: flat, attribution }).explanation).toBeNull();
  });

  it('says nothing when there is no benchmark or no mover to name', () => {
    expect(buildExplanation({ stats: { ...ahead, benchAvailable: false }, attribution }).explanation).toBeNull();
    const empty = { contributors: [], drags: [], todayReturn: 12 };
    expect(buildExplanation({ stats: ahead, attribution: empty }).explanation).toBeNull();
  });
});

describe("today's driver (dashboard data-integrity review, finding #1)", () => {
  // buildDriver is internal to the module now, so these go through buildInsights, which is
  // the only thing that ever called it. the insight is the same sentence either way
  /** @param {any[]} holdings */
  const driverInsight = (holdings) => {
    const { insights, more } = buildInsights({ holdings, attribution: buildAttrib(holdings) });
    return [...insights, ...more].find((r) => r.id === 'daily.driver');
  };

  it("shows the driver's share of the same-direction total, not gain+decline combined", () => {
    const driver = driverInsight([
      { ticker: 'NPN.JO', value: 103773, daily_change_pct: -0.43 },
      { ticker: 'SBK.JO', value: 25839, daily_change_pct: -0.61 },
      { ticker: 'STX40.JO', value: 16053, daily_change_pct: -1.0 },
      { ticker: 'AGL.JO', value: 13153, daily_change_pct: 0.96 },
      { ticker: 'MTN.JO', value: 8678, daily_change_pct: 2.65 },
    ]);

    if (!driver) throw new Error('expected a driver insight');
    expect(driver.text).toBe("79% of today's decline came from NPN.JO and STX40.JO.");
    expect(driver.text).not.toMatch(/54%/);
  });

  it('still gates on the combined-total share before naming individual tickers', () => {
    const driver = driverInsight([
      { ticker: 'AGL.JO', value: 50000, daily_change_pct: -3 },
      { ticker: 'MTN.JO', value: 10000, daily_change_pct: 0.5 },
    ]);

    if (!driver) throw new Error('expected a driver insight');
    expect(driver.text).toMatch(/^100% of today's decline came from AGL\.JO\.$/);
  });
});
/** @param {number} days */
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const SERIES_90 = Array.from({ length: 90 }, (_, i) => {
  const rise = 100 + i * 0.5;
  const index = i < 70 ? rise : rise - (i - 69) * 0.9;
  return {
    date: daysAgo(90 - i),
    name: `d${i}`,
    twr_index: Number(index.toFixed(4)),
    value: Number((index * 1000).toFixed(2)),
    benchmark: Number((100 + i * 0.3).toFixed(4)),
  };
});

const CONTRIB_SERIES = [
  { date: daysAgo(90), portfolio_value: 70000, cumulative_net_contributions: 70000, cumulative_market_gain: 0 },
  { date: daysAgo(0), portfolio_value: 120000, cumulative_net_contributions: 78000, cumulative_market_gain: 42000 },
];

const HEALTH = {
  score: 4.8,
  label: 'Mixed',
  subscores: [
    { key: 'sectorConcentration', label: 'Sector Concentration', weight: 0.4, value: 2.9 },
    { key: 'singleStockRisk', label: 'Single-Stock Risk', weight: 0.35, value: 4.4 },
    { key: 'portfolioBreadth', label: 'Portfolio Breadth', weight: 0.25, value: 7.1 },
  ],
};

/** @param {any} over */
const richCtx = (over = {}) => ({
  thresholds: { low: 25, high: 45 },
  perfSeries: SERIES_90,
  contributionSeries: CONTRIB_SERIES,
  health: HEALTH,
  returns: {
    holdings_count: 4, priced_live_count: 3, priced_count: 4, history_days: 90,
    net_contributions: 78000, invested_capital: 78000,
  },
  cgt: {
    available: true, taxable_capital_gain: 21000, net_unrealised_gain: 19000,
    assumptions: { tax_year: '2026/27', cost_basis_method: 'average_cost' },
  },
  statementDate: daysAgo(80),
  accountType: 'taxable',
  benchmarkLabel: 'JSE ALSI',
  ...over,
});

// no daily_change_pct anywhere - the realistic production shape
const NO_LIVE_PRICES = [
  { ticker: 'NPN.JO', sector: 'Technology', value: 62000, gain_loss: 17000, gain_loss_pct: 37.8, daily_change_pct: null, first_purchase_date: daysAgo(500) },
  { ticker: 'PRX.JO', sector: 'Technology', value: 24000, gain_loss: 2100, gain_loss_pct: 9.6, daily_change_pct: null, first_purchase_date: daysAgo(300) },
  { ticker: 'SBK.JO', sector: 'Financials', value: 22000, gain_loss: -6200, gain_loss_pct: -22.0, daily_change_pct: null, first_purchase_date: daysAgo(200) },
  { ticker: 'CPI.JO', sector: 'Financials', value: 12000, gain_loss: 8400, gain_loss_pct: 233.3, daily_change_pct: null, first_purchase_date: daysAgo(700) },
];

const DIVERSIFIED = ['Financials', 'Technology', 'Healthcare', 'Consumer', 'Industrials', 'Telecommunications'].map(
  (sector, i) => ({
    ticker: `T${i}`, sector, value: 20000, gain_loss: 1000 + i * 100,
    gain_loss_pct: 5 + i, daily_change_pct: null, first_purchase_date: daysAgo(300 + i),
  }),
);

/** @param {any[]} holdings @param {any} [over] */
const runInsights = (holdings, over = {}) => {
  const attribution = buildAttrib(holdings);
  const { sectors: sectorData } = buildSectors(holdings);
  return buildInsights({ holdings, attribution, sectorData, ...richCtx(over) });
};

describe('buildInsights when only some holdings have a live price', () => {
  const PARTIALLY_PRICED = [
    { ticker: 'NPN.JO', value: 5000, sector: 'Technology', daily_change_pct: 2 },
    { ticker: 'SBK.JO', value: 3000, sector: 'Financials', daily_change_pct: -1.5 },
    { ticker: 'AGL.JO', value: 2000, sector: 'Materials', daily_change_pct: null },
  ];

  it('leaves the unpriced holding out of attribution instead of calling it flat', () => {
    const attribution = buildAttrib(PARTIALLY_PRICED);
    const tickers = [...attribution.contributors, ...attribution.drags].map((r) => r.ticker);

    expect(tickers).not.toContain('AGL.JO');
    expect(attribution.excluded).toBe(1);
    expect(attribution.todayReturn).toBeCloseTo(55, 10);
  });

  it('never describes a holding it could not price as having moved 0%', () => {
    const { insights, more } = runInsights(PARTIALLY_PRICED);
    const text = JSON.stringify([...insights, ...more]);

    expect(text).not.toMatch(/0\.0% is within typical movement/);
    const daily = [...insights, ...more].filter((r) => r.category === 'daily');
    expect(JSON.stringify(daily)).not.toContain('AGL.JO');
  });
});

describe('buildInsights with no live prices at all', () => {
  // written first, and it is the whole reason the registry exists
  it('still finds at least six things to say', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    expect(insights).toHaveLength(8);
    expect(insights.length + more.length).toBeGreaterThanOrEqual(6);
  });

  it('hands every insight to the dock, not just the handful of templates that thought of it', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);

    for (const record of [...insights, ...more]) {
      const ask = record.actions.find((/** @type {any} */ a) => a.question);
      expect(ask, record.id).toBeDefined();
      expect(ask.label).toBe('Ask AI Why');
    }
  });

  it('keeps a template\'s own navigation alongside the Ask AI action', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    const concentration = [...insights, ...more].find((r) => r.id === 'conc.top-holding');
    if (!concentration) throw new Error('expected the top-holding insight');

    expect(concentration.actions.map((/** @type {any} */ a) => a.label)).toEqual([
      'View Holdings',
      'Ask AI Why',
    ]);
    expect(concentration.actions[1]).toEqual(
      askAiWhy(`${concentration.text} Why does this matter for my portfolio?`),
    );
  });

  it('says none of them about a price move, because there is no price move to report', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    const ids = [...insights, ...more].map((i) => i.id);

    expect(ids).not.toContain('daily.gainer');
    expect(ids).not.toContain('daily.drag');
    expect(ids).toContain('dq.no-live-prices');
  });

  it('quotes a figure on every card and backs each one with evidence', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    for (const insight of [...insights, ...more]) {
      expect(insight.evidence.length, insight.id).toBeGreaterThanOrEqual(1);
      if (insight.id === 'sector.missing' || insight.id === 'dq.no-live-prices') continue;
      expect(insight.text, insight.id).toMatch(/\d/);
    }
  });

  it('reaches past concentration into performance, contributions and tax', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    const categories = new Set([...insights, ...more].map((i) => i.category));

    expect(categories).toContain('concentration');
    expect(categories).toContain('contributions');
    expect(categories).toContain('winners_losers');
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });
});

describe('buildInsights across portfolio shapes', () => {
  it('leads with a risk on a concentrated book and still reports the concentration', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES);
    expect(insights[0].severity).toBe('risk');
    expect([...insights, ...more].map((i) => i.id)).toContain('conc.top-holding');
  });

  it('does not invent a concentration problem on a diversified book', () => {
    const { insights, more } = runInsights(DIVERSIFIED);
    const ids = [...insights, ...more].map((i) => i.id);

    expect(ids).not.toContain('conc.top-holding');
    expect(ids).not.toContain('sector.largest');
    expect(ids).not.toContain('sector.too-few');
    expect(insights.length).toBeGreaterThanOrEqual(4);
  });

  it('stays quiet about series maths on a two-day history', () => {
    const { insights, more } = runInsights(NO_LIVE_PRICES, {
      perfSeries: SERIES_90.slice(0, 2),
      contributionSeries: CONTRIB_SERIES.slice(0, 1),
      returns: { holdings_count: 4, priced_live_count: 4, priced_count: 4, history_days: 2 },
    });
    const ids = [...insights, ...more].map((i) => i.id);

    expect(ids).toContain('dq.short-history');
    for (const id of ['perf.moving-average', 'perf.streak', 'vol.vs-benchmark', 'vol.recent-shift', 'contrib.deposits-vs-growth']) {
      expect(ids, id).not.toContain(id);
    }
  });

  it('returns both lists empty for an empty portfolio', () => {
    expect(buildInsights({ holdings: [], attribution: NO_ATTRIBUTION })).toEqual({
      insights: [],
      more: [],
    });
  });
});

