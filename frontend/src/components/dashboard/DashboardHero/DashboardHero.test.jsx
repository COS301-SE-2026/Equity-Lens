import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { zar, zarFull } from '../../../utils/currency';
import DashboardHero from './DashboardHero';

const NBSP = String.fromCharCode(160);
/** @param {string} s */
const norm = (s) => s.split(NBSP).join(' ');
/** @param {number} n */
const money = (n) => norm(zarFull(n));
/** @param {number} n */
const rounded = (n) => norm(zar(n));

const DATA = {
  holdings: [{ ticker: 'NPN', sector: 'Technology', value: 45000, daily_change_pct: 1.2 }],
  summary: { total_value: 77000, daily_change_pct: 1.2, daily_change_value: 540 },
  returns: {
    portfolio_value: 77000,
    invested_capital: 57000,
    unrealised_gain: 20000,
    simple_return_pct: 35.09,
    holdings_count: 1,
    priced_live_count: 1,
  },
};

const HEALTH = { score: 5.0, label: 'Needs Attention' };

/** @param {Record<string, any>} [props] */
const renderHero = (props) =>
  render(
    <MemoryRouter>
      <DashboardHero
        name="Josh"
        portfolioData={props?.portfolioData ?? DATA}
        health={props?.health ?? HEALTH}
        fetchedAt={props?.fetchedAt}
        onScrollToHealth={props?.onScrollToHealth ?? vi.fn()}
      />
    </MemoryRouter>,
  );

describe('DashboardHero', () => {
  it('greets by name and shows portfolio value and today change', () => {
    renderHero();
    expect(screen.getByText('Josh')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.queryByText('Net Worth')).not.toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders all four headline figures from the backend returns data, not recomputed locally', () => {
    renderHero();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText(money(77000))).toBeInTheDocument();

    expect(screen.getByText('Invested')).toBeInTheDocument();
    expect(screen.getByText(money(57000))).toBeInTheDocument();

    expect(screen.getByText('Investment Gain')).toBeInTheDocument();
    expect(screen.getByText(`+${money(20000)}`)).toBeInTheDocument();
    expect(screen.getByText('(+35.1%)')).toBeInTheDocument();

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText(`+${rounded(540)}`)).toBeInTheDocument();
    expect(screen.getByText('(+1.20%)')).toBeInTheDocument();
  });

  it('renders a negative investment gain and today change with a minus sign and the negative token', () => {
    renderHero({
      portfolioData: {
        holdings: DATA.holdings,
        summary: { total_value: 60000, daily_change_pct: -2.44, daily_change_value: -3293 },
        returns: {
          portfolio_value: 60000,
          invested_capital: 65000,
          unrealised_gain: -5000,
          simple_return_pct: -7.69,
          holdings_count: 1,
          priced_live_count: 1,
        },
      },
    });
    const gainValue = screen.getByText(`-${money(5000)}`);
    expect(gainValue).toBeInTheDocument();
    expect(gainValue.closest('div')).toHaveStyle({ color: 'var(--signal-negative)' });
    expect(screen.getByText('(-7.7%)')).toBeInTheDocument();

    const todayValue = screen.getByText(`-${rounded(3293)}`);
    expect(todayValue.closest('div')).toHaveStyle({ color: 'var(--signal-negative)' });
  });

  it('flags unpriced holdings on the Investment Gain figure when priced_live_count is below holdings_count', () => {
    renderHero({
      portfolioData: {
        holdings: [
          { ticker: 'NPN', sector: 'Technology', value: 45000, daily_change_pct: 1.2 },
          { ticker: 'SBK', sector: 'Financials', value: 32000, daily_change_pct: 0.5 },
        ],
        summary: { total_value: 77000, daily_change_pct: 1.2, daily_change_value: 540 },
        returns: {
          portfolio_value: 77000,
          invested_capital: 57000,
          unrealised_gain: 20000,
          simple_return_pct: 35.09,
          holdings_count: 2,
          priced_live_count: 1,
        },
      },
    });
    expect(screen.getAllByLabelText('What does this mean?').length).toBeGreaterThanOrEqual(1);
  });

  it('suppresses the percentage instead of Infinity or NaN when invested_capital is 0', () => {
    renderHero({
      portfolioData: {
        holdings: DATA.holdings,
        summary: { total_value: 45000, daily_change_pct: 0, daily_change_value: 0 },
        returns: {
          portfolio_value: 45000,
          invested_capital: 0,
          unrealised_gain: 45000,
          simple_return_pct: null,
          holdings_count: 1,
          priced_live_count: 1,
        },
      },
    });
    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();

    const gainValue = screen.getByText(`+${money(45000)}`);
    const gainFigure = gainValue.closest('div')?.parentElement;
    if (!gainFigure) throw new Error('expected the Investment Gain figure to exist');
    expect(within(gainFigure).queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows a dash instead of a fabricated zero', () => {
    renderHero({
      portfolioData: {
        holdings: DATA.holdings,
        summary: { total_value: 57000, daily_change_pct: 0, daily_change_value: 0 },
        returns: {
          portfolio_value: 57000,
          invested_capital: 57000,
          unrealised_gain: 0,
          simple_return_pct: null,
          holdings_count: 1,
          priced_live_count: 0,
        },
      },
    });
    expect(screen.getByText('Investment Gain')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText(/\+R\s*0/)).not.toBeInTheDocument();
  });

  it("no longer shows the old Portfolio Summary strip", () => {
    renderHero();
    expect(screen.queryByText('Portfolio Summary')).not.toBeInTheDocument();
  });

  describe('warm summary sentence', () => {
  /**
   * @param {number} daily_change_value
   * @param {number} daily_change_pct
   * @param {Partial<typeof DATA.returns>} [returnsOverrides]
   */
  const withDaily = (daily_change_value, daily_change_pct, returnsOverrides = {}) => ({
    holdings: DATA.holdings,
    summary: { total_value: 77000, daily_change_pct, daily_change_value },
    returns: { ...DATA.returns, ...returnsOverrides },
    });

    it('reads as a strong-day sentence on a big gain', () => {
      renderHero({ portfolioData: withDaily(2400, 3.5) });
      expect(screen.getByText(/strong day/i)).toBeInTheDocument();
    });

    it('reads as a steady-gain sentence', () => {
      renderHero();
      expect(screen.getByText(/steady gain/i)).toBeInTheDocument();
    });

    it('reads as a quiet-day', () => {
      renderHero({ portfolioData: withDaily(2, 0.02) });
      expect(screen.getByText(/quiet day/i)).toBeInTheDocument();
    });

    it('reads as a small-dip sentence', () => {
      renderHero({ portfolioData: withDaily(-320, -0.6) });
      expect(screen.getByText(/small dip/i)).toBeInTheDocument();
    });

    it('reads as a rough-day sentence', () => {
      renderHero({ portfolioData: withDaily(-4500, -4.1) });
      expect(screen.getByText(/rough day/i)).toBeInTheDocument();
      expect(screen.getByText(/still up/i)).toBeInTheDocument();
    });

    it('drops the softening line on a big loss when not up overall', () => {
      renderHero({
        portfolioData: withDaily(-4500, -4.1, { unrealised_gain: -3000, simple_return_pct: -5.2 }),
      });
      expect(screen.getByText(/rough day/i)).toBeInTheDocument();
      expect(screen.queryByText(/still up/i)).not.toBeInTheDocument();
    });

    it('never uses banned AI-buzzword phrasing', () => {
      renderHero({ portfolioData: withDaily(2400, 3.5) });
      const banned = /\b(journey|leverage|seamless|robust|delve|tailored)\b/i;
      expect(document.body.textContent).not.toMatch(banned);
    });

    it('shows no summary sentence when there are no holdings', () => {
      renderHero({
        portfolioData: { holdings: [], summary: { total_value: 0, daily_change_pct: 0, daily_change_value: 0 } },
        health: { score: null, label: null },
      });
      expect(screen.queryByText(/quiet day|steady gain|strong day|rough day|small dip/i)).not.toBeInTheDocument();
    });
  });

  it('shows portfolio health', () => {
    renderHero();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Review Portfolio Health')).toBeInTheDocument();
    expect(screen.getByText('Ask AI Assistant')).toBeInTheDocument();
  });

  it('scrolls to health section', () => {
    const onScrollToHealth = vi.fn();
    renderHero({ onScrollToHealth });
    fireEvent.click(screen.getByText('Review Portfolio Health'));
    expect(onScrollToHealth).toHaveBeenCalled();
  });

  it('hides health badge when no score', () => {
    renderHero({ health: { score: null, label: null } });
    expect(screen.queryByText('Review Portfolio Health')).not.toBeInTheDocument();
  });

  it('prompts import when no holdings, instead of four zeroed-out figures', () => {
    renderHero({
      portfolioData: { holdings: [], summary: { total_value: 0, daily_change_pct: 0, daily_change_value: 0 } },
      health: { score: null, label: null },
    });
    expect(screen.getByText(/import a portfolio to see your figures/i)).toBeInTheDocument();
    expect(screen.queryByText('Invested')).not.toBeInTheDocument();
    expect(screen.queryByText('Investment Gain')).not.toBeInTheDocument();
    expect(screen.queryByText(money(0))).not.toBeInTheDocument();
  });

  it('shows a "updated x ago" when fetchedAt known and nothing when not', () => {
    const { rerender } = renderHero({ fetchedAt: new Date() });
    expect(screen.getByText('Updated just now')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardHero
          name="Josh"
          portfolioData={DATA}
          health={HEALTH}
          fetchedAt={null}
          onScrollToHealth={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
  });
});
