import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import PortfolioHealth from './PortfolioHealth';

const getHealthConfig = vi.fn();
vi.mock('../../../services/portfolioService', () => ({
  /** @param {any[]} args */
  getHealthConfig: (...args) => getHealthConfig(...args),
  saveHealthConfig: vi.fn(),
  clearHealthConfig: vi.fn(),}));

const CONFIG_PAYLOAD = {
  active: { breadth_target_n: 8 },
  source: 'default',
  preset_key: 'equitylens',
  derived_preset_key: null,
  default_preset_key: 'equitylens',
  presets: [{ key: 'equitylens', name: 'EquityLens default', description: 'General-purpose.', config: {} },],
  bounds: {},
};

beforeEach(() => {
  getHealthConfig.mockReset();
  getHealthConfig.mockResolvedValue(CONFIG_PAYLOAD);
});

/**
 * @param {{
 *   health: { score: number | null, label: string | null, subscores: any[] },
 *   onScrollTo?: (target: string) => void,
 *   onYardstickChanged?: () => void,
 * }} props
 */
const renderHealth = (props) =>
  render(
    <MemoryRouter>
      <PortfolioHealth {...props} />
    </MemoryRouter>,
  );
const HEALTH = {
  score: 4.4,
  label: 'Needs attention',
  subscores: [
    {
      key: 'sectorConcentration',
      label: 'Sector Concentration',
      weight: 0.4,
      value: 5.7,
      detail: 'Technology is 58% of your book (Herfindahl index 0.51 across 2 sectors).',
      target: 'HHI at or below 0.15 (roughly 7+ evenly-weighted sectors)',
      improvement:
        'Adding exposure outside Technology would bring this HHI down and spread the risk.',},
    {
      key: 'singleStockRisk',
      label: 'Single-Stock Risk',
      weight: 0.35,
      value: 4.2,
      detail: 'NPN is 58% of your book. High concentration.',
      target: 'Under 25% in any one holding',
      improvement: 'Trim NPN or build up other positions so no single stock dominates your return.',},
    {
      key: 'portfolioBreadth',
      label: 'Portfolio Breadth',
      weight: 0.25,
      value: 2.4,
      detail: "2 positions in your book, but weighted by size that's only 1.9 effective positions.",
      target: '8+ effective positions',
      improvement: 'Adding positions raises effective breadth toward the target.',},
  ],};

describe('PortfolioHealth', () => {
  it('renders backend-supplied subscores, not a client-computed set', () => {
    renderHealth({ health: HEALTH, onScrollTo: vi.fn() });
    expect(screen.getByText('4.4')).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('Sector Concentration')).toBeInTheDocument();
    expect(screen.getByText('Single-Stock Risk')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Breadth')).toBeInTheDocument();
    expect(screen.queryByText('Benchmark Performance')).not.toBeInTheDocument();
    expect(screen.queryByText('Diversification')).not.toBeInTheDocument();
    expect(screen.queryByText('Sector Exposure')).not.toBeInTheDocument();});

  it('never describes this as a performance or quality score', () => {
    renderHealth({ health: HEALTH, onScrollTo: vi.fn() });
    const panel = screen.getByText('Portfolio Health').closest('div');
    if (!panel) throw new Error('expected the panel to render');
    expect(panel.textContent).not.toMatch(/performance score|quality score|good investment/i);});

  it('resolves each subscore to its scroll target', () => {
    const onScrollTo = vi.fn();
    renderHealth({ health: HEALTH, onScrollTo });
    fireEvent.click(screen.getByText('Sector Concentration'));
    expect(onScrollTo).toHaveBeenCalledWith('sector-allocation');
    fireEvent.click(screen.getByText('Single-Stock Risk'));
    expect(onScrollTo).toHaveBeenCalledWith('holdings-table');
    fireEvent.click(screen.getByText('Portfolio Breadth'));
    expect(onScrollTo).toHaveBeenCalledWith('holdings-table');});

it('expands a subscore to show its detail, target and improvement copy', () => {
  renderHealth({ health: HEALTH, onScrollTo: vi.fn() });
  const row = screen.getByTestId('health-factor-portfolioBreadth');
  const expandButton = row.querySelector('button:last-of-type');
  if (!expandButton) throw new Error('expected the expand button to render');
  fireEvent.click(expandButton);
  expect(screen.getByText(/1.9 effective positions/i)).toBeInTheDocument();
  expect(screen.getByText('8+ effective positions')).toBeInTheDocument();
  expect(screen.getByText(/raises effective breadth toward the target/i)).toBeInTheDocument();});

  it('says which yardstick the score was measured against', async () => {
    renderHealth({ health: HEALTH, onScrollTo: vi.fn() });
    expect(await screen.findByText('EquityLens default')).toBeInTheDocument();
    expect(screen.getByText(/Measured against/)).toBeInTheDocument();});

  it('shows the empty state when there are no holdings to score', () => {
    renderHealth({ health: { score: null, label: null, subscores: [] }, onScrollTo: vi.fn() });
    expect(
      screen.getByText(/health score appears once you have holdings to analyse/i),
    ).toBeInTheDocument();});});