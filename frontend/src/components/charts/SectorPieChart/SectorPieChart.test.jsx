import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectorPieChart from './SectorPieChart';

const mockData = [
  { sector: 'Technology', value: 31500, percentage: 25.1 },
  { sector: 'Financials', value: 27240, percentage: 21.7 },
  { sector: 'Mining', value: 20050, percentage: 16.0 },
];

describe('SectorPieChart', () => {
  it('renders chart container', () => {
    render(<SectorPieChart data={mockData} />);
    expect(screen.getByLabelText(/sector allocation pie chart/i)).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<SectorPieChart data={[]} />);
    expect(screen.getByText(/no sector data available/i)).toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<SectorPieChart data={null} />);
    expect(screen.getByText(/no sector data available/i)).toBeInTheDocument();
  });
});

