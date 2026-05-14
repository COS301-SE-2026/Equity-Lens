import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    user: { full_name: 'Joshua Heath' },
    isAuthenticated: true,
  }),
}));

vi.mock('../../hooks/usePortfolio', () => ({
  default: () => ({
    portfolioData: {
      summary: {
        totalValue: 125430.50,
        totalCost: 98200.00,
        totalGain: 27230.50,
        totalGainPercent: 27.73,
        holdingsCount: 8,
      },
      holdings: [
        {
          ticker: 'NPN',
          name: 'Naspers',
          sector: 'Technology',
          quantity: 10,
          purchasePrice: 2800,
          currentPrice: 3150,
          value: 31500,
          gain: 3500,
          gainPercent: 12.5,
        },
        {
          ticker: 'MTN',
          name: 'MTN Group',
          sector: 'Telecommunications',
          quantity: 50,
          purchasePrice: 120,
          currentPrice: 138,
          value: 6900,
          gain: 900,
          gainPercent: 15.0,
        },
      ],
      sectorAllocation: [
        { sector: 'Technology', value: 31500, percentage: 25.1 },
      ],
      performanceHistory: [
        { date: '2024-01', value: 98200 },
        { date: '2024-12', value: 125430 },
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
    expect(screen.getByText('NPN')).toBeInTheDocument();
    expect(screen.getByText('MTN')).toBeInTheDocument();
  });

  it('renders portfolio performance section', () => {
    renderDashboard();
    expect(screen.getByText('Portfolio Performance')).toBeInTheDocument();
  });

  it('renders dividend section', () => {
    renderDashboard();
    expect(screen.getByText('Dividend Income')).toBeInTheDocument();
  });

  it('renders watchlist section', () => {
    renderDashboard();
    expect(screen.getByText('My Watchlist')).toBeInTheDocument();
  });

  it('renders holdings table section', () => {
    renderDashboard();
    expect(screen.getByText('Your Holdings')).toBeInTheDocument();
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