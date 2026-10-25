import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

import Portfolio, { buildHoldingsPayload, parseExposureRow } from './Portfolio';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const PARSED_ROWS = [
  { instrument_name: 'Naspers Ltd', quantity: '10', total_cost: '173000.00' },
  { instrument_name: 'Standard Bank Group Ltd', quantity: '200', total_cost: '35000.00' },
  { instrument_name: 'Anglo American', quantity: '50', total_cost: '9000.00' },
  { instrument_name: 'Sasol Ltd', quantity: '0', total_cost: '0.00' },
];

describe('buildHoldingsPayload', () => {
  it('leaves out a position closed during the period', () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);

    expect(payload).toHaveLength(3);
    expect(payload.map((h) => h.instrument_name)).not.toContain('Sasol Ltd');
  });

  it('never sends a NaN cost price, which the schema rejects as null', () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);

    for (const holding of payload) {
      expect(Number.isFinite(holding.cost_price)).toBe(true);
    }
  });

  it('weights the kept rows against each other so they still total 100%', () => {
    const payload = buildHoldingsPayload(PARSED_ROWS);
    const total = payload.reduce((sum, h) => sum + h.weight_percentage, 0);

    expect(total).toBeCloseTo(100, 6);
  });

  it('sends quantity as a number, the same as total_cost', () => {
    const [first] = buildHoldingsPayload(PARSED_ROWS);

    expect(first.quantity).toBe(10);
    expect(first.total_cost).toBe(173000);
    expect(first.cost_price).toBe(17300);
  });

  it('returns nothing rather than dividing by zero when every row is closed', () => {
    const allClosed = [{ instrument_name: 'Sasol Ltd', quantity: '0', total_cost: '0.00' }];

    expect(buildHoldingsPayload(allClosed)).toEqual([]);
  });
});

describe('parseExposureRow', () => {
  const ROW = 'Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 37.53%';

  it('puts Cost in total_cost and Qty in quantity', () => {
    const row = parseExposureRow(ROW);

    expect(row?.total_cost).toBe('902.15');
    expect(row?.quantity).toBe('15.6432');
  });

  it('takes the closing figures from Curr Price and Curr Value, not from Weight', () => {
    const row = parseExposureRow(ROW);

    expect(row?.statement_price).toBe('62.74');
    expect(row?.statement_value).toBe('981.44');
  });

  it('keeps the instrument name in front of the numbers', () => {
    expect(parseExposureRow(ROW)?.instrument_name).toBe('Satrix S&P 500 Feeder ETF');
  });

  it('returns null for the second line of a wrapped instrument name', () => {
    expect(parseExposureRow('Coreshares S&P Global Property')).toBeNull();
  });

  it("throws rather than import a row whose columns don't reconcile", () => {
    const extraColumn = 'Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 5.99 37.53%';

    expect(() => parseExposureRow(extraColumn)).toThrow(/exposure columns/);
  });

  it("throws when the last column isn't a weight at all", () => {
    const noWeight = 'Satrix S&P 500 Feeder ETF 15.6432 902.15 57.67 62.74 981.44 37.53';

    expect(() => parseExposureRow(noWeight)).toThrow(/exposure columns/);
  });
});

// the sa demo statement as the snapshot route returns it, cut down to what the page reads
const SUMMARY = {
  PortfolioValue: 226905.1,
  TotalHoldings: 7,
  TotalPurchasesAndSales: 240475.5,
  TotalContributionsAndWithdrawals: 226367.9,
  TotalDividendsAndWithholdingTax: 3597.11,
  TotalTransactionExpenses: 601.2,
  StatementValue: 226905.1,
  StatementDate: '2026-09-29',
  ValueBasis: 'cost',
};
const SNAPSHOT = {
  snapshot_id: '10ac4bc4b96a725bf6ba0d78c094bfd2a1735d607338a765c1156e24d26c8664',
  created_at: '2026-10-19T09:00:00',
  snapshot: {
    summary: SUMMARY,
    holdings: {
      top: [
        { name: 'Naspers Limited', value: 96247.97, weight_percentage: 42.42 },
        { name: 'FirstRand', value: 15540, weight_percentage: 6.85 },
      ],
      allocation: [
        { name: 'Naspers Limited', weight_percentage: 42.42 },
        { name: 'FirstRand', weight_percentage: 6.85 },
      ],
      lowest: { name: 'FirstRand', value: 15540, weight_percentage: 6.85 },
    },
    activity: {
      trading: [
        { name: 'Buy', value: 233121.1, side: 'buy' },
        { name: 'Sell', value: 7354.4, side: 'sell' },
      ],
      cash_flow: [
        { name: 'Contribution', value: 233703.91 },
        { name: 'Withdrawal', value: -7336.01 },
      ],
      dividend_income: [],
    },
  },
};

/** @param {Record<string, any>} summary */
const openSummary = async (summary = SUMMARY) => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/portfolio/current') {
      return { data: [{ id: 'p-1', portfolio_name: 'Guest demo portfolio', account_number: '900000003' }] };
    }
    return { data: { ...SNAPSHOT, snapshot: { ...SNAPSHOT.snapshot, summary } } };
  });
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <Portfolio />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: 'View Summary' }));
  await screen.findByText('Top Holdings');
};

// testing library collapses the non-breaking spaces Intl puts in an amount, so match that
/** @param {number} value */
const money = (value) => formatCurrency(value).replace(/\s/g, ' ');

/** @param {string} label */
const card = (label) => /** @type {HTMLElement} */ (screen.getByText(label).closest('.glass-surface'));

describe('the portfolio summary figures', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('formats every amount and keeps it behind the blur toggle', async () => {
    await openSummary();

    const traded = card('Traded (buys + sells)');
    for (const amount of [240475.5, 233121.1, 7354.4]) {
      const shown = within(traded).getByText(money(amount));
      expect(shown.closest('.money-value')).not.toBeNull();
    }
    expect(within(card('Net contributions')).getByText(money(7336.01))).toBeInTheDocument();
    expect(screen.getByText('900000003').closest('.money-value')).not.toBeNull();
    expect(screen.queryByText(/R 226905/)).not.toBeInTheDocument();
  });

  it('says plainly when the value is only the cost basis', async () => {
    await openSummary();

    const value = card('Value at statement date');
    expect(within(value).getByText('as at 29 Sep 2026')).toBeInTheDocument();
    expect(within(value).getByText(/this is what you paid \(cost\)/)).toBeInTheDocument();
  });

  it('shows the cost basis under a value taken from the statement', async () => {
    await openSummary({ ...SUMMARY, StatementValue: 231200.5, ValueBasis: 'statement' });

    const value = card('Value at statement date');
    expect(within(value).getByText(money(231200.5))).toBeInTheDocument();
    expect(within(value).getByText(money(226905.1))).toBeInTheDocument();
  });

  it('shows a dash for a missing figure instead of R 0', async () => {
    await openSummary({ ...SUMMARY, TotalTransactionExpenses: null, StatementValue: undefined });

    expect(within(card('Expenses')).getByText('—')).toBeInTheDocument();
    expect(within(card('Value at statement date')).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(money(0))).not.toBeInTheDocument();
  });

  it('names the snapshot instead of claiming it was verified, and drops the ai card', async () => {
    await openSummary();

    expect(screen.getByText('Snapshot 10ac4bc4 · generated 19 Oct 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Portfolio Summary' })).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.queryByText(/verified canonical snapshot/)).not.toBeInTheDocument();
    expect(screen.queryByText('AI Portfolio Assistant')).not.toBeInTheDocument();
  });

  it('shows the smallest holding with its amount and its weight', async () => {
    await openSummary();

    const smallest = card('Smallest Holding');
    expect(within(smallest).getByText('FirstRand')).toBeInTheDocument();
    expect(within(smallest).getByText(money(15540))).toBeInTheDocument();
    expect(within(smallest).getByText('6.85% of the portfolio')).toBeInTheDocument();
    expect(screen.getByText('Allocation by holding')).toBeInTheDocument();
  });
});
