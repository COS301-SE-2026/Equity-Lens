import { describe, expect, it } from 'vitest';

import { formatCurrency } from '../../utils/formatters';

import {
  dividendBars,
  rand,
  shortDate,
  shortSnapshotId,
  splitCashFlow,
  splitTrading,
} from './portfolioFigures';

const TRADING = [
  { name: 'Buy', value: 233121.1, side: 'buy' },
  { name: 'Sell', value: 7354.4, side: 'sell' },
];
const CASH_FLOW = [
  { name: 'Contribution', value: 233703.91 },
  { name: 'Withdrawal', value: -7336.01 },
];

describe('rand', () => {
  it('formats a real amount, zero included', () => {
    expect(rand(226905.1)).toBe(formatCurrency(226905.1));
    expect(rand(0)).toBe(formatCurrency(0));
  });

  it('shows a dash for a missing amount rather than R 0', () => {
    expect(rand(null)).toBe('—');
    expect(rand(undefined)).toBe('—');
    expect(rand(Number.NaN)).toBe('—');
  });
});

describe('splitTrading', () => {
  it('separates what was bought from what was sold', () => {
    expect(splitTrading(TRADING)).toEqual({ bought: 233121.1, sold: 7354.4 });
  });

  it('adds every row on the same side, whatever the statement called it', () => {
    const rows = [...TRADING, { name: 'Purchase', value: 100, side: 'buy' }];
    expect(splitTrading(rows).bought).toBeCloseTo(233221.1, 2);
  });

  it('has nothing to split in a snapshot from before the side was recorded', () => {
    expect(splitTrading([{ name: 'Buy', value: 1 }])).toEqual({ bought: null, sold: null });
    expect(splitTrading([])).toEqual({ bought: null, sold: null });
  });
});

describe('splitCashFlow', () => {
  it('reads the withdrawal from its sign and reports it as a positive amount out', () => {
    const { moneyIn, moneyOut } = splitCashFlow(CASH_FLOW);
    expect(moneyIn).toBeCloseTo(233703.91, 2);
    expect(moneyOut).toBeCloseTo(7336.01, 2);
    expect(Number(moneyIn) - Number(moneyOut)).toBeCloseTo(226367.9, 2);
  });

  it('has no split for an empty cash flow', () => {
    expect(splitCashFlow([])).toEqual({ moneyIn: null, moneyOut: null });
  });
});

describe('dividendBars', () => {
  it('stacks net and tax so the bar reaches the gross dividend', () => {
    const [bar] = dividendBars([
      { name: 'FirstRand', gross_dividend: 1416.8, withholding_tax: 283.36, net_dividend: 1133.44 },
    ]);
    expect(bar).toEqual({ name: 'FirstRand', net: 1133.44, tax: 283.36 });
    expect(bar.net + bar.tax).toBeCloseTo(1416.8, 2);
  });
});

describe('dates and ids', () => {
  it('shortens dates and the snapshot hash for display', () => {
    expect(shortDate('2026-09-29')).toBe('29 Sep 2026');
    expect(shortDate('2026-10-19T09:00:00')).toBe('19 Oct 2026');
    expect(shortDate(null)).toBeNull();
    expect(shortSnapshotId('10ac4bc4b96a725bf6ba')).toBe('10ac4bc4');
    expect(shortSnapshotId(undefined)).toBeNull();
  });
});