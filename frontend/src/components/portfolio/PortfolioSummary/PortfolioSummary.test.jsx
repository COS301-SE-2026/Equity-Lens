import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PortfolioSummary from './PortfolioSummary';

describe('PortfolioSummary', () => {
  it('shows the summary values', () => {
    const summary = {
      total_value: 100000,
      total_gain_loss: 5000,
      total_gain_loss_pct: 5.5,
      daily_change: 1.25,
      num_holdings: 8,
    };

    render(<PortfolioSummary summary={summary} />);

    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('+5.5% all time')).toBeInTheDocument();
    expect(screen.getByText('+1.25%')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('if the summary is empty', () => {
    const { container } = render(<PortfolioSummary summary={null} />);

    expect(container).toBeEmptyDOMElement();
  });

});