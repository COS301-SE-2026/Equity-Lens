import { describe, it, expect } from 'vitest';

import { getConcRisk, buildInsights } from './dashboardInsights';

// the backend lets the user pick a yardstick, so these have to follow the payload rather
// than the module's own 25/45 - otherwise the badges disagree with the Health score
describe('getConcRisk with the user’s thresholds', () => {
  it('falls back to 25/45 when no thresholds are given', () => {
    expect(getConcRisk(20).level).toBe('low');
    expect(getConcRisk(30).level).toBe('moderate');
    expect(getConcRisk(50).level).toBe('high');
  });

  it('reads a stricter preset', () => {
    const strict = { low: 15, high: 30 };

    expect(getConcRisk(20, strict).level).toBe('moderate');
    expect(getConcRisk(35, strict).level).toBe('high');
  });

  it('reads a looser preset - the same weight can be Low here and High by default', () => {
    const loose = { low: 35, high: 60 };

    expect(getConcRisk(30, loose).level).toBe('low');
    expect(getConcRisk(30).level).toBe('moderate');
  });
});

describe('buildInsights when no holding has a daily move', () => {
  const holdings = [
    { ticker: 'NPN.JO', name: 'Naspers', value: 5000, total_cost: 4000, daily_change_pct: null },
    { ticker: 'SBK.JO', name: 'Standard Bank', value: 3000, total_cost: 3000, daily_change_pct: null },
  ];
  const attribution = { contributors: [], drags: [] };

  it('says so rather than leaving the panel empty', () => {
    const { insights, more } = buildInsights({ holdings, attribution, sectorData: [] });

    // it is no longer the first card - the panel ranks risks above an info notice now - but
    // it still has to be there, which is what this test has always been about
    const notice = [...insights, ...more].find((i) => i.id === 'dq.no-live-prices');
    if (!notice) throw new Error('expected the no-live-prices notice');
    expect(notice.text).toMatch(/price moves aren't available/i);
    expect(notice.why).toMatch(/Portfolio Health are unaffected/i);
  });

  it('stays quiet when the prices are there', () => {
    const priced = holdings.map((h) => ({ ...h, daily_change_pct: 1.2 }));

    const { insights, more } = buildInsights({ holdings: priced, attribution, sectorData: [] });

    expect([...insights, ...more].some((i) => /price moves aren't available/i.test(i.text))).toBe(false);
  });
});
