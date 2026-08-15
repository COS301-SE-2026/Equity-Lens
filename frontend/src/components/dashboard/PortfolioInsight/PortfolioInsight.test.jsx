import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import PortfolioInsight from './PortfolioInsight';

const HOLDINGS = [
  { ticker: 'NPN', sector: 'Technology', value: 10000 },
  { ticker: 'SOL', sector: 'Energy', value: 5000 },
];

const DATA = {
  holdings: HOLDINGS,
  summary: { total_value: 15000, daily_change: 1.2 },
};

const ATTRIBUTION = {
  contributors: [{ ticker: 'NPN' }],
  drags: [],
  todayReturn: 180,
};

describe('PortfolioInsight', () => {
  it('builds headline', () => {
    render(
      <PortfolioInsight
        portfolioData={DATA}
        attribution={ATTRIBUTION}
        topHolding={{ ticker: 'NPN', weight: 66.7 }}
      />,);

    expect(screen.getByText(/up 1.2% today, led by npn in technology/i)).toBeInTheDocument();});

  it('shows net worth', () => {
    render(
      <PortfolioInsight
        portfolioData={DATA}
        attribution={ATTRIBUTION}
        topHolding={{ ticker: 'NPN', weight: 66.7 }}/>,);
    expect(screen.getByText('R 15 000,00')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();});

  it('falls back to prompt when no holdings', () => {
    render(
      <PortfolioInsight
        portfolioData={{ holdings: [], summary: {} }}
        attribution={{ contributors: [], drags: [], todayReturn: 0 }}/>,
    );
    expect(screen.getByText(/import a portfolio/i)).toBeInTheDocument();});});
