import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import Dashboard from './Dashboard';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    /** @param {{ children?: import('react').ReactNode }} props */
    ResponsiveContainer: ({ children }) => <div>{children}</div>,};});

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { full_name: 'Steven Schormann' } }),
}));

vi.mock('../../hooks/usePortfolio', () => ({
  default: () => ({
    portfolioData: {
      holdings: [
        {
          ticker: 'NPN',
          name: 'Naspers',
          current_price: 3421.5,
          value: 45000,
          quantity: 10,
          daily_change_pct: 1.2,
          gain_loss_pct: 8.4,
          gain_loss: 3500,
          sector: 'Technology',
        },
        {
          ticker: 'SBK',
          name: 'Standard Bank',
          current_price: 218.4,
          value: 32000,
          quantity: 100,
          daily_change_pct: 0.5,
          gain_loss_pct: 4.1,
          gain_loss: 1200,
          sector: 'Financials',
        },
      ],
      summary: { total_value: 77000, total_gain_loss: 4700, total_gain_loss_pct: 6.5, daily_change: 0 },
      performanceHistory: [
        { date: '2026-04-01', value: 790000, benchmark: 775000 },
        { date: '2026-05-01', value: 805000, benchmark: 782000 },
        { date: '2026-06-01', value: 847231, benchmark: 800000 },
      ],
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('../../hooks/useWatchlist', () => ({
  default: () => ({
    watchlist: [
      { id: 'w1', ticker: 'ABG', company_name: 'Absa Group', current_price: 182.5, change_percent: 1.2 },
    ],
    loading: false,
    error: null,
    addTicker: vi.fn(),
    removeTicker: vi.fn(),
  }),
}));

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

describe('Dashboard', () => {
  it('greets signed-in user and builds summary', () => {
    renderDashboard();
    expect(screen.getByText('Steven')).toBeInTheDocument();
    expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/58% of your portfolio is in npn, making it your biggest source of risk/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Concentration')).toBeInTheDocument();
    const askWhy = screen.getByText('Ask AI Why');
    expect(askWhy).toHaveAttribute(
      'href',
      '/ai?q=' + encodeURIComponent('Why is my NPN concentration considered a risk?'),
    );});

  it('surfaces concentration risk and low diversification', () => {
    renderDashboard();
    expect(screen.getByText(/npn alone is 58% of your book/i)).toBeInTheDocument();
    expect(screen.getAllByText(/high impact/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/trimming npn below 30% could improve your portfolio health by \+0\.7/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/high impact · \+0\.7 health/i)).toBeInTheDocument();
  });

  it('gives Portfolio Health own section', () => {
    renderDashboard();
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.getByText('Benchmark Performance')).toBeInTheDocument();
    expect(screen.getByText('20% weight')).toBeInTheDocument();
    expect(screen.queryByText(/adding a few more positions reduces how much any one holding drives your return/i)).not.toBeInTheDocument();
    const breadthRow = within(screen.getByTestId('health-factor-portfolioBreadth'));
    fireEvent.click(breadthRow.getByText('Why'));
    expect(breadthRow.getByText(/adding a few more positions reduces how much any one holding drives your return/i)).toBeInTheDocument();
    expect(breadthRow.getByText('8-12 positions')).toBeInTheDocument();

    expect(screen.getByText('View Health Analysis')).toBeInTheDocument();
  });

  it('shows a takeaway plus a why', () => {
    renderDashboard();
    expect(screen.getByText(/outperformed the jse alsi by 4.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/today's biggest mover npn is a contributor/i)).toBeInTheDocument();
    expect(screen.getByText('ALL')).toBeInTheDocument();
  });

  it('shows Biggest Gain/Loss cards with context', () => {
    renderDashboard();
    expect(screen.getByText(/nothing dragging your portfolio down today/i)).toBeInTheDocument();
    expect(screen.getByText('Normal volatility')).toBeInTheDocument();
    expect(screen.getByText(/77% of today's gain came from npn/i)).toBeInTheDocument();
  });

  it('merges sector allocation and largest holdings', () => {
    renderDashboard();
    expect(screen.getByText('Portfolio Overview')).toBeInTheDocument();
    expect(screen.getByText(/high concentration - above the 45% threshold/i)).toBeInTheDocument();
    expect(screen.queryByText(/^largest$/i)).not.toBeInTheDocument();
  });

  it.skip('renames news panel to explain why portfolio moved', () => {
    renderDashboard();
    expect(screen.getByText(/why your portfolio moved today/i)).toBeInTheDocument();
    expect(screen.getByText('Direct exposure')).toBeInTheDocument();
    expect(screen.getByText(/added .*today|cost .*today/i)).toBeInTheDocument();
    expect(screen.getAllByText('Worth monitoring').length).toBe(3);
    expect(screen.getAllByText(/\d+ (days?|weeks?|months?) ago/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Explain This Move').length).toBe(3);
  });

  it.skip('expands a news row to show position-impact detail', () => {
    renderDashboard();
    const explainButtons = screen.getAllByText('Explain This Move');
    expect(screen.queryByText(/isn't currently in your portfolio, showing as a market-wide move/i)).not.toBeInTheDocument();
    fireEvent.click(explainButtons[0]);
    expect(screen.getByText(/at your current npn position size/i)).toBeInTheDocument();
  });

  it("renders Today's Insights with lifetime gain/loss content", () => {
    renderDashboard();
    expect(screen.getByText(/up 6\.5%.*since you started investing/i)).toBeInTheDocument();
    expect(screen.getByText(/npn has been your best long-term performer, up 8\.4%/i)).toBeInTheDocument();
    expect(screen.getByText(/sbk has gained the least since purchase, up just 4\.1%/i)).toBeInTheDocument();
    expect(screen.getByText(/you currently have no healthcare exposure/i)).toBeInTheDocument();

    expect(screen.queryByText(/a common blind spot/i)).not.toBeInTheDocument();
    const whyButtons = screen.getAllByText('Why?');
    fireEvent.click(whyButtons[whyButtons.length - 1]);
    expect(screen.getByText(/a common blind spot/i)).toBeInTheDocument();
  });

  it('renders the watchlist as low-emphasis passive context', () => {
    renderDashboard();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('ABG')).toBeInTheDocument();
  });

  it('does not duplicate the market ticker', () => {
    renderDashboard();
    expect(screen.queryByText(/jse-alsi/i)).not.toBeInTheDocument();
  });

  it('shows help tooltips for beginner-facing terms', () => {
    renderDashboard();
    expect(screen.getAllByLabelText('What does this mean?').length).toBeGreaterThanOrEqual(3);
  });

  it('scrolls to and flashes the linked section', () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    renderDashboard();

    fireEvent.click(screen.getByText('Explore New Sectors'));
    const sectorEl = document.getElementById('sector-allocation');
    if (!sectorEl) throw new Error('expected #sector-allocation to exist');
    expect(sectorEl.className).toContain('ring-orange-500');
    act(() => vi.advanceTimersByTime(2500));
    expect(sectorEl.className).not.toContain('ring-orange-500');

    fireEvent.click(screen.getByText('Benchmark Performance'));
    const perfEl = document.getElementById('performance-vs-benchmark');
    if (!perfEl) throw new Error('expected #performance-vs-benchmark to exist');
    expect(perfEl.className).toContain('ring-orange-500');
    vi.useRealTimers();
  });
});
