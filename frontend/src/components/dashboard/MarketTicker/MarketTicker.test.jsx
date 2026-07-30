import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MarketTicker from './MarketTicker';

// unused component, kept pending demo 3 decision - smoke test only
describe('MarketTicker', () => {
  it('renders the mock strip without crashing', () => {
    render(<MarketTicker />);
    expect(screen.getByText('JSE-ALSI')).toBeInTheDocument();
  });
});
