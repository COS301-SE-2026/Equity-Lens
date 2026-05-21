import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockTickerCard from './StockTickerCard';

const mockProps = {
  ticker: 'NPN',
  name: 'Naspers',
  price: 3150.00,
  changePercent: 1.4,
  totalReturn: 12.5,
};

describe('StockTickerCard', () => {
  it('renders ticker symbol', () => {
    render(<StockTickerCard {...mockProps} />);
    expect(screen.getByText('NPN')).toBeInTheDocument();
  });

  it('in here to show the company name', () => {
    render(<StockTickerCard {...mockProps} />);
    expect(screen.getByText('Naspers')).toBeInTheDocument();
  });

  it('in here to show the positive change', () => {
    render(<StockTickerCard {...mockProps} />);
    expect(screen.getByText('+12.50%')).toBeInTheDocument();
  });

  it('renders 24h daily change in metadata row', () => {
    render(<StockTickerCard {...mockProps} />);
    expect(screen.getByText(/24h/)).toBeInTheDocument();
  });

  it('renders price correctly', () => {
    render(<StockTickerCard {...mockProps} />);
    expect(screen.getByText(/3 150,00/)).toBeInTheDocument();
  });
});
