import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerformanceLineChart from './PerformanceLineChart';
describe('PerformanceLineChart>', () => {
  it('renders chart container', () => {
    render(<PerformanceLineChart />);
    expect(screen.getByLabelText(/portfolio performance chart/i)).toBeInTheDocument();
  });

  it('renders with custom data', () => {
    const data = [{ month: 'Jan', amount: 100 }];
    render(<PerformanceLineChart data={data} />);
    expect(screen.getByLabelText(/portfolio performance chart/i)).toBeInTheDocument();
  });
});
