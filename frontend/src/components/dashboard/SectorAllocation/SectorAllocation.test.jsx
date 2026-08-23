import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import SectorAllocation from './SectorAllocation';

const SECTOR_DATA = [
  { name: 'Technology', value: 58.4 },
  { name: 'Financials', value: 41.6 },];

describe('SectorAllocation', () => {
  it('renders a row per sector with its share of the portfolio', () => {
    render(<SectorAllocation sectorData={SECTOR_DATA} selected={null} onSelectSector={() => {}} />);
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('58.4%')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();});

  it('reports the clicked sector up to the parent instead of filtering its own list (backlog 4)', () => {
    const onSelectSector = vi.fn();
    render(
      <SectorAllocation sectorData={SECTOR_DATA} selected={null} onSelectSector={onSelectSector} />,);
    fireEvent.click(screen.getByRole('button', { name: /Technology/i }));
    expect(onSelectSector).toHaveBeenCalledWith('Technology');});

  it('clicking the already-selected sector row clears it', () => {
    const onSelectSector = vi.fn();
    render(
      <SectorAllocation
        sectorData={SECTOR_DATA}
        selected="Technology"
        onSelectSector={onSelectSector}
      />,);
    fireEvent.click(screen.getByRole('button', { name: /Technology/i }));
    expect(onSelectSector).toHaveBeenCalledWith(null);});
  it('has no Clear control of its own regardless of selection state', () => {
    render(
      <SectorAllocation sectorData={SECTOR_DATA} selected="Technology" onSelectSector={() => {}} />,);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();});

  it('does not clip the selected sector label to the donut hole - it flows below the chart instead (backlog 3 item 1)', () => {
   const LONG = [{ name: 'Emerging Market Equity', value: 100 }];
    render(
      <SectorAllocation
        sectorData={LONG}
        selected="Emerging Market Equity"
        onSelectSector={() => {}}/>,);
    const [label] = screen.getAllByText('Emerging Market Equity');
    expect(label.className).not.toMatch(/absolute/);
  });

  it('carries the sector-allocation scroll anchor id', () => {
    const { container } = render(
      <SectorAllocation sectorData={SECTOR_DATA} selected={null} onSelectSector={() => {}} />,
    );
    expect(container.querySelector('#sector-allocation')).toBeInTheDocument();
  });

  it('colors the legend swatch by concentration risk, not a fixed per-sector hue (backlog item 8)', () => {
   const data = [
      { name: 'Technology', value: 60 },
      { name: 'Financials', value: 10 },
    ];
    render(<SectorAllocation sectorData={data} selected={null} onSelectSector={() => {}} />);

  const techSwatch = screen.getByRole('button', { name: /Technology/i }).querySelector('span');
  if (!techSwatch) throw new Error('expected the Technology swatch to render');
  expect(techSwatch.style.background).toBe('var(--signal-negative)');

  const finSwatch = screen.getByRole('button', { name: /Financials/i }).querySelector('span');
  if (!finSwatch) throw new Error('expected the Financials swatch to render');
  expect(finSwatch.style.background).toBe('var(--signal-positive)');
});});
