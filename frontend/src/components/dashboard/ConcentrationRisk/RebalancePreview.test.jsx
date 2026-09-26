import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import RebalancePreview, { buildRows } from './RebalancePreview';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    /** @param {{ children?: import('react').ReactNode }} props */
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

const SECTORS = [
  { sector: 'Financial Services', value: 60000, percentage: 60 },
  { sector: 'Technology', value: 28000, percentage: 28 },
  { sector: 'Healthcare', value: 12000, percentage: 12 },
];

const RESULT = {
  available: true,
  from_sector: 'Financial Services',
  to_sector: 'Healthcare',
  value_shifted: 30000,
  from_sector_before_pct: 60,
  to_sector_before_pct: 12,
  health_score_before: 4.5,
  health_score_after: 6.8,
  explanation: 'Shifts weight out of Financial Services and into Healthcare.',
  disclaimer: "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
};

describe('buildRows', () => {
  it('moves exactly value_shifted between the two sectors and leaves the rest alone', () => {
    const chart = buildRows({ result: RESULT, sectors: SECTORS });
    if (!chart) throw new Error('expected rows');
    const [now, simulated] = chart.rows;

    expect(now['Financial Services']).toBe(60);
    expect(simulated['Financial Services']).toBe(30);
    expect(now.Healthcare).toBe(12);
    expect(simulated.Healthcare).toBe(42);
    expect(simulated.Technology).toBe(28);});

  it('keeps both rows summing to the same whole', () => {
    const chart = buildRows({ result: RESULT, sectors: SECTORS });
    if (!chart) throw new Error('expected rows');
    const total = (/** @type {Record<string, any>} */ row) =>
      chart.names.reduce((sum, name) => sum + row[name], 0);

    expect(total(chart.rows[0])).toBeCloseTo(100, 6);
    expect(total(chart.rows[1])).toBeCloseTo(100, 6);});

  it("takes the two changed sectors' before figures from the response, not the prop", () => {
    const chart = buildRows({
      result: { ...RESULT, from_sector_before_pct: 58.4 },
      sectors: SECTORS,
    });
    if (!chart) throw new Error('expected rows');

    expect(chart.rows[0]['Financial Services']).toBe(58.4);});

  it('never drives a sector below zero', () => {
    const chart = buildRows({
      result: { ...RESULT, value_shifted: 95000 },
      sectors: SECTORS,});
    if (!chart) throw new Error('expected rows');

    expect(chart.rows[1]['Financial Services']).toBe(0);});

  it('returns nothing to chart when the allocation carries no values', () => {
    const valueless = SECTORS.map(({ sector, percentage }) => ({ sector, percentage }));
    expect(buildRows({ result: RESULT, sectors: valueless })).toBeNull();});});

describe('RebalancePreview', () => {
  it('names both sides of the move rather than relying on colour alone', () => {
    render(<RebalancePreview result={RESULT} sectors={SECTORS} />);

    expect(screen.getByText('Financial Services (out)')).toBeInTheDocument();
    expect(screen.getByText('Healthcare (in)')).toBeInTheDocument();
    expect(screen.getByText('unchanged')).toBeInTheDocument();
  });

  it('reads as what changed, why, and which subscore responded', () => {
    render(<RebalancePreview result={RESULT} sectors={SECTORS} />);
    expect(screen.getByText(/out of Financial Services, into Healthcare/)).toBeInTheDocument();
    expect(screen.getByText(RESULT.explanation)).toBeInTheDocument();
    expect(screen.getByText(/Sector Concentration is the subscore that moves/)).toBeInTheDocument();
  });

  it('does not claim a sector-spread cause when the move has one sector on both ends', () => {
    render(
      <RebalancePreview
        result={{ ...RESULT, to_sector: 'Financial Services' }}
        sectors={SECTORS}/>,);
    expect(screen.queryByText(/Sector Concentration is the subscore/)).not.toBeInTheDocument();
  });

  it('keeps the disclaimer word for word, as a note rather than an error', () => {
    render(<RebalancePreview result={RESULT} sectors={SECTORS} />);

    const disclaimer = screen.getByText(
      "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",);
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toHaveStyle({ color: 'var(--text-ghost)' });
  });

  it('still shows the score and the reasoning when there is nothing to chart', () => {
    const valueless = SECTORS.map(({ sector, percentage }) => ({ sector, percentage }));
    render(<RebalancePreview result={RESULT} sectors={valueless} />);
    expect(screen.getByText('Portfolio Health 4.5 changes to 6.8')).toBeInTheDocument();
    expect(screen.getByText('+2.3')).toBeInTheDocument();
    expect(screen.queryByText('Financial Services (out)')).not.toBeInTheDocument();
  });
});
