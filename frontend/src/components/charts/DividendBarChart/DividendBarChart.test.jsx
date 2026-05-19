import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DividendBarChart from './DividendBarChart';
describe('DividendBarChart', () => {
  it('renders chart container', () => {
    render(<DividendBarChart />);
    expect(screen.getByLabelText(/dividend bar chart/i)).toBeInTheDocument();
  });

  it('renders with custom data', () => {
    const data = [{ month: 'Jan', amount: 100 }];
    render(<DividendBarChart data={data} />);
    expect(screen.getByLabelText(/dividend bar chart/i)).toBeInTheDocument();
  });
});
