import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectorPieChart from './SectorPieChart';
describe('SectorPieChart>', () => {
  it('renders chart container', () => {
    render(<SectorPieChart />);
    expect(screen.getByLabelText(/sector allocation pie chart/i)).toBeInTheDocument();
  });

  it('renders with custom data', () => {
    const data = [{ month: 'Jan', amount: 100 }];
    render(<SectorPieChart data={data} />);
    expect(screen.getByLabelText(/sector allocation pie chart/i)).toBeInTheDocument();
  });
});
