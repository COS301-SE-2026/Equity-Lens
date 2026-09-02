import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import DashboardHoldingsTable from './DashboardHoldingsTable';

const HOLDINGS = [
  { ticker: 'NPN', name: 'Naspers', sector: 'Technology', value: 6767, current_price: 67, daily_change_pct: 6.7 },
  { ticker: 'SBK', name: 'Standard Bank', sector: 'Financials', value: 4200, current_price: 420, daily_change_pct: 4.2 },
];

const SECTOR_DATA = [
  { name: 'Technology', value: 61.7 },
  { name: 'Financials', value: 38.3 },
];

/** @param {any[]} holdings */
const renderTable = (holdings) =>
  render(
    <MemoryRouter>
      <DashboardHoldingsTable holdings={holdings} sectorData={SECTOR_DATA} />
    </MemoryRouter>,
  );

describe('DashboardHoldingsTable', () => {
  it('renders one row per holding', async () => {
    renderTable(HOLDINGS);
    expect(screen.getByText('NPN')).toBeInTheDocument();
    expect(screen.getByText('SBK')).toBeInTheDocument();
    expect(await screen.findByText('Technology')).toBeInTheDocument();
    expect(await screen.findByText('Financials')).toBeInTheDocument();
  });

  it('shows positive today', () => {
    renderTable(HOLDINGS);
    expect(screen.getByText(/\+6\.70%/)).toBeInTheDocument();
    expect(screen.getByText(/\+4\.20%/)).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderTable([]);
    expect(screen.getByText(/upload holdings to see them here/i)).toBeInTheDocument();
  });
});
