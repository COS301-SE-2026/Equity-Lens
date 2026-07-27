import { describe, it, expect } from 'vitest';
import {
  buildActions,
  buildHealth,
  buildSummary,
  buildSectors,
  buildInsights,
  concWording,
  filterByRange,
  isFund,
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
      'NPN is your largest holding at 58% of your portfolio, making single-stock risk your primary concern.',
    );
    expect(summary.supportingText).toEqual([
      'Technology now represents 58% of your portfolio, making sector concentration a significant source of risk.',
      'Only 2 positions make up your entire portfolio, leaving very little diversification.',
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
      'Your portfolio remains well diversified across sectors, with no individual company representing more than 17% of total value.',
    );
    expect(summary.severity).toBe('neutral');
    expect(summary.badge).toBe('Overview');
    expect(summary.suggestedActions).toEqual([
      { label: 'Ask AI Why', to: '/ai', prefill: 'What should I be watching in my portfolio right now?' },
    ]);
  });

  it('flags a missing sector as an opportunity', () => {
    const holdings = ['Financials', 'Technology', 'Consumer', 'Industrials', 'Telecommunications'].map((sector, i) => ({
      ticker: `T${i}`,
      value: 20000,
      sector,
      daily_change_pct: 0,
    }));
    const { sectors: sectorData } = buildSectors(holdings);
    const attribution = { contributors: [], drags: [] };
    const chartStats = { diff: '—', diffPct: 0, benchAvailable: false };

    const summary = buildSummary({ holdings, sectorData, attribution, chartStats, dailyChangePct: 0 });

    expect(summary.headline).toBe('You currently have no Healthcare exposure, a common gap in balanced JSE portfolios.');
    expect(summary.severity).toBe('opportunity');
    expect(summary.badge).toBe('Opportunity');
  });

  it('prompts for import when there are no holdings', () => {
    const summary = buildSummary({
      holdings: [],
      sectorData: [],
      attribution: { contributors: [], drags: [] },
      chartStats: { diff: '—', diffPct: 0, benchAvailable: false },
      dailyChangePct: 0,
    });

    expect(summary.headline).toBe('Import a portfolio to see your executive summary.');
    expect(summary.suggestedActions).toEqual([{ label: 'Import Portfolio', to: '/portfolio' }]);
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

/** @param {string} ticker @param {number} value @param {string} sector */
const stock = (ticker, value, sector) => ({
  ticker,
  value,
  sector,
  kind: 'stock',
  region: 'South Africa',
  gain_loss_pct: 1,
  daily_change_pct: 0,
});

const ETF_BOOK = [fund('CTOP50.JO', 5100, 'SA Equity'), fund('EASYAI.JO', 4900, 'Global Equity')];
const STOCK_BOOK = [stock('NPN.JO', 5100, 'Technology'), stock('SBK.JO', 4900, 'Financial Services')];

const FLAT_STATS = { diff: '—', diffPct: 0, benchAvailable: false };
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

describe('buildHealth', () => {
  it('labels the concentration subscore for funds without changing its key', () => {
    const { sectors: sectorData } = buildSectors(ETF_BOOK);
    const health = buildHealth({ holdings: ETF_BOOK, sectorData, chartStats: FLAT_STATS });
    const concentration = health.subscores.find((s) => s.key === 'singleStockRisk');
    if (!concentration) throw new Error('expected a singleStockRisk subscore');
    expect(concentration.label).toBe('Fund Concentration');
    expect(concentration.improvement).not.toMatch(/single stock/i);
  });

  it('still says Single-Stock Risk for a book of shares', () => {
    const { sectors: sectorData } = buildSectors(STOCK_BOOK);
    const health = buildHealth({ holdings: STOCK_BOOK, sectorData, chartStats: FLAT_STATS });
    const singleStockScore = health.subscores.find((s) => s.key === 'singleStockRisk');
    if (!singleStockScore) throw new Error('expected a singleStockRisk subscore');
    expect(singleStockScore.label).toBe('Single-Stock Risk');
  });
});

describe('buildActions', () => {
  it('skips earnings-miss wording for funds', () => {
    const { sectors: sectorData } = buildSectors(ETF_BOOK);
    const health = buildHealth({ holdings: ETF_BOOK, sectorData, chartStats: FLAT_STATS });
    const { items } = buildActions({
      holdings: ETF_BOOK,
      sectorData,
      attribution: NO_ATTRIBUTION,
      health,
    });
    const concentration = items.find((i) => i.id === 'holding-concentration');
    if (!concentration) throw new Error('expected a holding-concentration action item');
    expect(concentration.detail).not.toMatch(/earnings miss/i);
    expect(concentration.detail).toMatch(/SA Equity/);
  });

  it('keeps earnings-miss wording for shares', () => {
    const { sectors: sectorData } = buildSectors(STOCK_BOOK);
    const health = buildHealth({ holdings: STOCK_BOOK, sectorData, chartStats: FLAT_STATS });
    const { items } = buildActions({
      holdings: STOCK_BOOK,
      sectorData,
      attribution: NO_ATTRIBUTION,
      health,
    });

    const concentration = items.find((i) => i.id === 'holding-concentration');
    if (!concentration) throw new Error('expected a holding-concentration action item');
    expect(concentration.detail).toMatch(/earnings miss/i);
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

describe('sector gap claims', () => {
  it('does not claim a missing sector when everything held is a fund', () => {
    const { insights } = buildInsights({
      holdings: ETF_BOOK,
      sectorData: buildSectors(ETF_BOOK).sectors,
      attribution: NO_ATTRIBUTION,
      chartStats: FLAT_STATS,
    });
    expect(insights.some((i) => i.type === 'missing-sector')).toBe(false);
  });

  it('still flags a genuine gap when direct shares are held', () => {
    const holdings = [
      { ticker: 'NPN.JO', value: 5100, sector: 'Technology', daily_change_pct: 0 },
      { ticker: 'SBK.JO', value: 4900, sector: 'Financial Services', daily_change_pct: 0 },
    ];
    const { insights } = buildInsights({
      holdings,
      sectorData: buildSectors(holdings).sectors,
      attribution: NO_ATTRIBUTION,
      chartStats: FLAT_STATS,
    });
    expect(insights.some((i) => i.type === 'missing-sector')).toBe(true);
  });
});

describe('buildSectors with exposure buckets', () => {
  it('no longer collapses a book of ETFs into one Other slice', () => {
    const buckets = buildSectors(ETF_BOOK).sectors.map((s) => s.name);
    expect(buckets).not.toContain('Other');
    expect(buckets).toEqual(expect.arrayContaining(['SA Equity', 'Global Equity']));
  });
});
