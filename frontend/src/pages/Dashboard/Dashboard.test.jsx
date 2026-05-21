import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { full_name: 'Test User' },
    isAuthenticated: true,
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => children,
  LineChart: () => null,
  AreaChart: () => null,
  BarChart: () => null,
  Line: () => null,
  Area: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  ReferenceLine: () => null,
}));

vi.mock('../../hooks/usePortfolio', () => ({
  default: () => ({
    portfolioData: {
      summary: {
        total_value: 125430.50,
        total_gain_loss: 27230.50,
        total_gain_loss_pct: 27.73,
        daily_change: 2.4,
        num_holdings: 8,
      },
      holdings: [
        {
          ticker: 'NPN',
          name: 'Naspers',
          sector: 'Technology',
          quantity: 10,
          avg_price: 2800,
          current_price: 3150,
          value: 31500,
          gain_loss: 3500,
          gain_loss_pct: 12.5,
          daily_change_pct: 1.4,
        },
        {
          ticker: 'MTN',
          name: 'MTN Group',
          sector: 'Telecommunications',
          quantity: 50,
          avg_price: 120,
          current_price: 138,
          value: 6900,
          gain_loss: 900,
          gain_loss_pct: 15.0,
          daily_change_pct: -0.8,
        },
      ],
      sectorAllocation: [
        { sector: 'Technology', value: 31500, percentage: 25.1 },
      ],
      performanceHistory: [
        { name: 'Jan', value: 98200,  benchmark: 72000 },
        { name: 'Dec', value: 125430, benchmark: 85000 },
      ],
    },
    loading: false,
    error: null,
  }),
}));

const renderDashboard = () =>
  render(<MemoryRouter><Dashboard /></MemoryRouter>);

describe('Dashboard', () => {
  it('renders dashboard container', () => {
    renderDashboard();
    expect(screen.getByLabelText(/portfolio dashboard/i)).toBeInTheDocument();
  });

  it('renders stock ticker cards for top holdings', () => {
    renderDashboard();
    expect(screen.getAllByText('NPN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MTN').length).toBeGreaterThan(0);
  });

  it('renders portfolio performance section', () => {
    renderDashboard();
    expect(screen.getByText('Portfolio performance')).toBeInTheDocument();
  });

  it('renders dividend section', () => {
    renderDashboard();
    expect(screen.getByText('Dividend income')).toBeInTheDocument();
  });

  it('renders watchlist section', () => {
    renderDashboard();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('renders holdings table section', () => {
    renderDashboard();
    expect(screen.getByText('Holdings')).toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    vi.doMock('../../hooks/usePortfolio', () => ({
      default: () => ({ portfolioData: null, loading: true, error: null }),
    }));
  });

  it('renders error state when error occurs', () => {
    vi.doMock('../../hooks/usePortfolio', () => ({
      default: () => ({ portfolioData: null, loading: false, error: 'Failed' }),
    }));
  });
});
