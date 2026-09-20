import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import EventStudyChart, { eventStudyRows } from './EventStudyChart';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    /** @param {{ children?: import('react').ReactNode }} props */
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

/** @param {number} offset @param {number} car @param {number} halfWidth */
const row = (offset, car, halfWidth) => ({
  date: '2026-03-15',
  offset,
  stock_return_pct: -1,
  market_return_pct: -0.2,
  abnormal_return_pct: -0.8,
  cumulative_abnormal_return_pct: car,
  car_lower_pct: car - halfWidth,
  car_upper_pct: car + halfWidth,
  significant: Math.abs(car) > halfWidth,
});

const DETAIL = {
  available: true,
  ticker: 'NPN.JO',
  date: '2026-03-15',
  benchmark_label: 'JSE Top 40',
  observations: 99,
  alpha: 0.000214,
  beta: 1.1832,
  r_squared: 0.4127,
  estimation_window: { from: '2026-02-19', to: '2026-07-17', offsets: [-120, -21] },
  abnormal_returns: [row(-5, 0, 2.8), row(0, -7.85, 4.8), row(10, -7.2, 11.1)],
};

describe('eventStudyRows', () => {
  it('carries the band as one lower-upper pair rather than two stacked series', () => {
    const rows = eventStudyRows(DETAIL);

    /** @param {any[]} band @param {number[]} expected */
    const isBand = (band, expected) => {
      expect(band[0]).toBeCloseTo(expected[0], 6);
      expect(band[1]).toBeCloseTo(expected[1], 6);
    };

    isBand(rows?.[0].band, [-2.8, 2.8]);
    isBand(rows?.[1].band, [-12.65, -3.05]);
    isBand(rows?.[2].band, [-18.3, 3.9]);
  });

  it('keeps the band anchored on the cumulative figure it belongs to', () => {
    const rows = eventStudyRows(DETAIL) ?? [];

    for (const r of rows) {
      const [low, high] = r.band;
      expect(r.cumulative_abnormal_return_pct).toBeGreaterThanOrEqual(low);
      expect(r.cumulative_abnormal_return_pct).toBeLessThanOrEqual(high);
    }
  });

  it('returns nothing rather than a partial chart when a series is missing', () => {
    expect(eventStudyRows({ abnormal_returns: [] })).toBeNull();
    expect(eventStudyRows({})).toBeNull();
    expect(
      eventStudyRows({ abnormal_returns: [{ offset: 0, cumulative_abnormal_return_pct: -3 }] }),
    ).toBeNull();
  });
});

describe('EventStudyChart', () => {
  it('renders the fit behind the chart, not just the chart', async () => {
    const { container } = render(<EventStudyChart detail={DETAIL} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show the working' }));

    const shown = container.textContent ?? '';
    for (const figure of ['0.00021', '1.18', '41%', '99 trading days', 'JSE Top 40']) {
      expect(shown).toContain(figure);
    }
  });

  it('gives each figure a reading rather than leaving it as a number', async () => {
    render(<EventStudyChart detail={DETAIL} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show the working' }));

    expect(screen.getByText(/about 5\.5% a year/)).toBeInTheDocument();
    expect(screen.getByText(/amplifies market moves/)).toBeInTheDocument();
    expect(screen.getByText(/could not influence the line it is being measured against/)).toBeInTheDocument();
  });

  it('shows the model with this event\'s numbers in it', async () => {
    render(<EventStudyChart detail={DETAIL} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show the working' }));

    expect(screen.getByText('expected return = alpha + beta × benchmark return')).toBeInTheDocument();
    expect(screen.getByText('0.02% + 1.18 × -0.20% = -0.22%')).toBeInTheDocument();
    expect(screen.getByText(/actually returned -1\.00%, so the abnormal return is -0\.80%/)).toBeInTheDocument();
  });

  it('renders nothing at all when the window is incomplete', () => {
    const { container } = render(<EventStudyChart detail={{ abnormal_returns: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});