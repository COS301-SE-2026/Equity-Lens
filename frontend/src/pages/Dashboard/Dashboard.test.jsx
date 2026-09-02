import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Dashboard from './Dashboard';
vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

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
      summary: { total_value: 77000, total_gain_loss: 4700, total_gain_loss_pct: 6.5, daily_change_pct: 0, daily_change_value: 0 },
      returns: { time_weighted_return_pct: 7.244430379746836, history_days: 62 },
      health: {
        score: 4.4,
        label: 'Needs attention',
        subscores: [
          {
            key: 'sectorConcentration', label: 'Sector Concentration', weight: 0.4, value: 5.7,
            detail: 'Technology is 58% of your book (Herfindahl index 0.51 across 2 sectors).',
            target: 'HHI at or below 0.15 (roughly 7+ evenly-weighted sectors)',
            improvement: 'Adding exposure outside Technology would bring this HHI down and spread the risk.',
          },
          {
            key: 'singleStockRisk', label: 'Single-Stock Risk', weight: 0.35, value: 4.2,
            detail: 'NPN is 58% of your book. High concentration.',
            target: 'Under 25% in any one holding',
            improvement: 'Trim NPN or build up other positions so no single stock dominates your return.',
          },
          {
            key: 'portfolioBreadth', label: 'Portfolio Breadth', weight: 0.25, value: 2.4,
            detail: "2 positions in your book, but weighted by size that's only 1.9 effective positions - a raw count hides how much one holding can dominate.",
            target: '8+ effective positions',
            improvement: 'Adding positions - or trimming the ones that dominate - raises effective breadth toward the target.',
          },
        ],
      },
      performanceHistory: [
        { date: '2026-04-01', value: 790000, benchmark: 775000, twr_index: 100.0 },
        { date: '2026-05-01', value: 805000, benchmark: 782000, twr_index: 103.16 },
        { date: '2026-06-01', value: 847231, benchmark: 800000, twr_index: 107.24 },
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
  it('greets signed-in user and shows portfolio health', () => {
    renderDashboard();
    expect(screen.getByText('Steven')).toBeInTheDocument();
    expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThanOrEqual(1);
  });

  it('surfaces the missing-sector opportunity in Today\'s Insights', async () => {
    renderDashboard();
    expect(await screen.findByText('Today\'s Insights')).toBeInTheDocument();
    expect(await screen.findByText(/you have no healthcare exposure/i)).toBeInTheDocument();
    expect(screen.queryByText('Rebalancing Insights')).not.toBeInTheDocument();
  });

  it('no longer carries Goal Progress or Tax Analysis - both moved to the Plan page', async () => {
    renderDashboard();
    expect(await screen.findByText('Today\'s Insights')).toBeInTheDocument();
    expect(screen.queryByText('Goal Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Your Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('Tax Analysis')).not.toBeInTheDocument();
  });

  it('gives Portfolio Health own section', () => {
    renderDashboard();
    expect(screen.getByText('4.4')).toBeInTheDocument();
    expect(screen.getByText('Sector Concentration')).toBeInTheDocument();
    expect(screen.getByText('40% weight')).toBeInTheDocument();
    expect(screen.queryByText('Benchmark Performance')).not.toBeInTheDocument();
    expect(screen.queryByText(/adding a few more positions reduces how much any one holding drives your return/i)).not.toBeInTheDocument();
    const breadthRow = within(screen.getByTestId('health-factor-portfolioBreadth'));
    fireEvent.click(breadthRow.getByText('Why'));
    expect(breadthRow.getByText(/adding positions.*raises effective breadth/i)).toBeInTheDocument();
    expect(breadthRow.getByText('8+ effective positions')).toBeInTheDocument();
  });

  it('shows a takeaway plus a why', () => {
    renderDashboard();
    expect(screen.getByText(/outperformed the jse alsi by 4.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/npn was today's biggest contributor/i)).toBeInTheDocument();
    expect(screen.getByText('ALL')).toBeInTheDocument();
  });

  it("no longer shows Today's Biggest Gain/Loss inside Performance vs Benchmark - that moved to Today's Insights", () => {
    renderDashboard();
    expect(screen.queryByText("Today's Biggest Gain")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Biggest Loss")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Driver")).not.toBeInTheDocument();
  });

  it('splits sector allocation and all positions into two independent cards', () => {
    renderDashboard();
    const sectorPanel = document.getElementById('sector-allocation');
    expect(within(sectorPanel).getAllByText('Sectors').length).toBeGreaterThan(0);
    expect(screen.getByText('All Positions')).toBeInTheDocument();
    expect(screen.getByTitle(/High concentration - \d+\.\d% of your book/i)).toBeInTheDocument();
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

  it("renders Today's Insights with today's move, not since-purchase/since-inception content", () => {
    renderDashboard();
    expect(screen.getByText(/npn is today's biggest gainer, up 1\.2%/i)).toBeInTheDocument();
    expect(screen.getByText(/77% of today's gain came from npn/i)).toBeInTheDocument();
    expect(screen.queryByText(/today's biggest drag/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/since you started investing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/since purchase/i)).not.toBeInTheDocument();

    const whyButtons = screen.getAllByText('Why?');
    fireEvent.click(whyButtons[0]);
    expect(screen.getByText(/within typical movement/i)).toBeInTheDocument();
  });

  it('renders the watchlist as a floating toggle, not an always-visible card', async () => {
    renderDashboard();
    expect(screen.queryByText('ABG')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open watchlist/i }));
    expect(await screen.findByText('Watchlist')).toBeInTheDocument();
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

  it('scrolls to and highlights the linked section (backlog 7.2 - fade, not flash)', () => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    renderDashboard();

    fireEvent.click(screen.getByText('Sector Concentration'));
    const sectorEl = document.getElementById('sector-allocation');
    if (!sectorEl) throw new Error('expected #sector-allocation to exist');
    expect(sectorEl.className).toContain('dashboard-highlight');
    expect(sectorEl.className).toContain('is-active');
    expect(sectorEl.className).not.toContain('ring-orange-500');
    expect(sectorEl.className).not.toContain('animate-pulse');
    act(() => vi.advanceTimersByTime(2500));
    expect(sectorEl.className).not.toContain('is-active');

    fireEvent.click(screen.getByText('Single-Stock Risk'));
    const holdingsEl = document.getElementById('holdings-table');
    if (!holdingsEl) throw new Error('expected #holdings-table to exist');
    expect(holdingsEl.className).toContain('is-active');
    vi.useRealTimers();
  });
});
