import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HoldingsTable from './HoldingsTable';

describe('HoldingsTable', () => {
  it('Shows the holding Data', () => {
    const dataHoldings = [
      {
        ticker: 'TestTicker',
        name: 'TestName',
        sector: 'TestSector',
        quantity: 10,
        avg_price: 150,
        current_price: 180,
        value: 1800,
        gain_loss: 300,
        gain_loss_pct: 20,
      },
    ];

    render(<HoldingsTable holdings={dataHoldings} />);

    expect(screen.getByText('TestTicker')).toBeInTheDocument();
    expect(screen.getByText('TestName')).toBeInTheDocument();
    expect(screen.getByText('TestSector')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('R150.00')).toBeInTheDocument();
    expect(screen.getByText('R180.00')).toBeInTheDocument();
    expect(screen.getByText('+20.0%')).toBeInTheDocument();
  });

  it('Shows the data if the holdings has an empty array', () => {
  render(<HoldingsTable holdings={[]} />);

  expect(screen.getByText('Ticker')).toBeInTheDocument();
  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByText('Sector')).toBeInTheDocument();
  expect(screen.getByText('Qty')).toBeInTheDocument();
  expect(screen.getByText('Avg Cost')).toBeInTheDocument();
  expect(screen.getByText('Current')).toBeInTheDocument();
  expect(screen.getByText('Value')).toBeInTheDocument();
  expect(screen.getByText('P&L')).toBeInTheDocument();
  expect(screen.getByText('P&L %')).toBeInTheDocument();
});

});