import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';

import { zar } from '../../../utils/currency';

import ContributionsChart, { ContribTooltip } from './ContributionsChart';
const NBSP = String.fromCharCode(160);
/** @param {number} n */
const rand = (n) => zar(n).split(NBSP).join(' ');

const SERIES = [
  {
    date: '2026-06-01',
    name: 'Jun 01',
    portfolio_value: 100000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 0,
  },
  {
    date: '2026-07-01',
    name: 'Jul 01',
    portfolio_value: 120000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 20000,
  },
  {
    date: '2026-08-01',
    name: 'Aug 01',
    portfolio_value: 135159,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 35159,
  },
];

const CROSSES_OVER = [
  {
    date: '2026-06-01',
    name: 'Jun 01',
    portfolio_value: 110000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 10000,
  },
  {
    date: '2026-07-01',
    name: 'Jul 01',
    portfolio_value: 100000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 0,
  },
  {
    date: '2026-08-01',
    name: 'Aug 01',
    portfolio_value: 88000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: -12000,
  },
];

const AT_A_LOSS = [
  {
    date: '2026-06-01',
    name: 'Jun 01',
    portfolio_value: 100000,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: 0,
  },
  {
    date: '2026-07-01',
    name: 'Jul 01',
    portfolio_value: 80500,
    cumulative_net_contributions: 100000,
    cumulative_market_gain: -19500,
  },
];

describe('ContributionsChart', () => {
  it('renders the chart with a supplied series', () => {
    render(<ContributionsChart series={SERIES} />);
    expect(screen.getByLabelText('Contributions vs market gain chart')).toBeInTheDocument();
    expect(screen.getByText("What You Put In vs What It's Worth Now")).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Contributed')).toBeInTheDocument();
  });

  it('draws the contributed key as a dashed line, matching its line on the chart', () => {
    render(<ContributionsChart series={SERIES} />);
    const swatch = screen.getByText('Contributed').querySelector('span');
    expect(swatch?.getAttribute('style')).toContain('border-style: dashed');
    expect(swatch?.getAttribute('style')).toContain('var(--text-secondary)');
  });

  it('shows a not-enough-history state with fewer than two points, not a two-point trend', () => {
    render(<ContributionsChart series={[]} />);
    expect(screen.getByText(/not enough history yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Contributions vs market gain chart')).not.toBeInTheDocument();

    render(<ContributionsChart series={[SERIES[0]]} />);
    expect(screen.getAllByText(/not enough history yet/i).length).toBeGreaterThan(0);
  });

  it('states the takeaway sentence using the supplied cumulative totals, no percentage', () => {
    render(<ContributionsChart series={SERIES} />);
    const takeaway = `You've put in ${rand(100000)}. The market has added ${rand(35159)} on top of that.`;
    expect(screen.getByText(takeaway)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders a net-negative contributions total (withdrawal larger than deposits) without breaking', () => {
    const withdrawalHeavy = [
      {
        date: '2026-06-01',
        name: 'Jun 01',
        portfolio_value: 200,
        cumulative_net_contributions: 1000,
        cumulative_market_gain: -800,
      },
      {
        date: '2026-07-01',
        name: 'Jul 01',
        portfolio_value: 200,
        cumulative_net_contributions: -400,
        cumulative_market_gain: 600,
      },
    ];
    render(<ContributionsChart series={withdrawalHeavy} />);
    const takeaway = `You've withdrawn ${rand(400)} more than you've deposited. The market has added ${rand(600)} on top of that.`;
    expect(screen.getByText(takeaway)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });


  it.each([
    ['a losing portfolio', AT_A_LOSS],
    ['a winning portfolio', SERIES],
    ['one that crosses from gain to loss', CROSSES_OVER],
  ])('keeps both colour keys in the legend for %s', (_label, series) => {
    render(<ContributionsChart series={series} />);
    expect(screen.getByText('Market gain')).toBeInTheDocument();
    expect(screen.getByText('Market loss')).toBeInTheDocument();
    expect(screen.queryByText('Market Gain/Loss')).not.toBeInTheDocument();
  });

  it('explains in the caveat that a red band is a shortfall, not an addition', async () => {
    render(<ContributionsChart series={AT_A_LOSS} />);
    await userEvent.hover(screen.getByLabelText('What does this mean?'));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/red band is the shortfall/i);
  });

  it('reads the loss as money taken away, not added', () => {
    render(<ContributionsChart series={AT_A_LOSS} />);
    const takeaway = `You've put in ${rand(100000)}. The market has taken away ${rand(19500)} of that.`;
    expect(screen.getByText(takeaway)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it('covers the tooltip values with the blur class (backlog 7.1)', () => {
    const row = {
      portfolio_value: 135159,
      cumulative_net_contributions: 100000,
      cumulative_market_gain: 35159,
    };
    render(<ContribTooltip active payload={[{ payload: row }]} label="Aug 01" />);
    expect(screen.getByText(rand(135159))).toHaveClass('money-value');
    expect(screen.getByText(rand(100000))).toHaveClass('money-value');
    expect(screen.getByText(rand(35159))).toHaveClass('money-value');
  });
});
