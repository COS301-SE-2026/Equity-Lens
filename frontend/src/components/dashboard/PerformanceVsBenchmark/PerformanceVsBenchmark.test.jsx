import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { zar } from '../../../utils/currency';
import { getHoldingSeries } from '../../../services/portfolioService';

import PerformanceVsBenchmark, {
  PerfTooltip,
  IndexTooltip,
  endMarker,
  eventDots,
} from './PerformanceVsBenchmark';

vi.mock('../../../services/portfolioService', () => ({ getHoldingSeries: vi.fn() }));

vi.mock('../../../context/ChatContext', () => ({ useChatContext: () => ({ openDock: vi.fn() }) }));

const NBSP = String.fromCharCode(160);
/** @param {number} n */
const rand = (n) => zar(n).split(NBSP).join(' ');

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    /** @param {{ children?: import('react').ReactNode }} props */
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

const SERIES = [
  { date: '2026-07-01', name: 'Jul 01', value: 100000, benchmark: 100000, twr_index: 100 },
  { date: '2026-08-01', name: 'Aug 01', value: 110000, benchmark: 104000, twr_index: 110 },
];

/** @param {{ series: any[] } & Record<string, any>} props */
const renderChart = (props) =>
  render(
    <MemoryRouter>
      <PerformanceVsBenchmark {...props} />
    </MemoryRouter>,
  );

describe('PerformanceVsBenchmark', () => {
  it('shows the portfolio return computed from the series', () => {
    renderChart({ series: SERIES, historyDays: 31 });
    expect(screen.getByText('Portfolio return')).toBeInTheDocument();
    expect(screen.getByText('+10.0%')).toBeInTheDocument();
  });

  it('does not report a deposit as a return', () => {

    const withPurchase = [
      { date: '2026-07-01', name: 'Jul 01', value: 100000, benchmark: 100000, twr_index: 100 },
      { date: '2026-08-01', name: 'Aug 01', value: 201000, benchmark: 104000, twr_index: 100.5 },
    ];
    renderChart({ series: withPurchase, historyDays: 31 });
    expect(screen.getByText('+0.5%')).toBeInTheDocument();
    expect(screen.queryByText('+101.0%')).not.toBeInTheDocument();
  });

  it('shows a building-history message instead of a number with fewer than two data points', () => {
    renderChart({ series: [SERIES[0]], historyDays: 1 });
    expect(screen.getByText('Building history - 1 day so far')).toBeInTheDocument();
    expect(screen.queryByText('+10.0%')).not.toBeInTheDocument();
  });

  it('does not compare against the benchmark when there is not enough data yet', () => {
    renderChart({ series: [SERIES[0]], historyDays: 5 });
    expect(screen.queryByText(/outperformed|underperformed/i)).not.toBeInTheDocument();
  });

  it('keeps the card whole when the event scan failed', () => {
    renderChart({ series: SERIES, historyDays: 31, events: null, eventsFailed: true });

    expect(screen.getByText('Unusual-move markers are unavailable right now.')).toBeInTheDocument();
    expect(screen.getByText('+10.0%')).toBeInTheDocument();
  });

  it('distinguishes "nothing unusual happened" from "we could not look"', () => {
    const { rerender } = renderChart({
      series: SERIES, historyDays: 31,
      events: { events: [], coverage: { holdings_scanned: 3 } },
    });
    expect(screen.getByText(/No unusual moves across 3 holdings/)).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PerformanceVsBenchmark
          series={SERIES}
          historyDays={31}
          events={{ events: [], coverage: { holdings_scanned: 0 } }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Not enough price history yet/)).toBeInTheDocument();
  });

  it('covers the chart tooltip values with the blur class', () => {
    const payload = [{ dataKey: 'value', color: 'var(--accent-primary)', value: 110000 }];
    render(<PerfTooltip active payload={payload} label="Aug 01" benchmarkLabel="JSE ALSI" />);
    expect(screen.getByText(rand(110000))).toHaveClass('money-value');
  });
});

describe('PerformanceVsBenchmark holding comparison', () => {
  const HOLDINGS = [
    { ticker: 'NPN.JO', name: 'Naspers', value: 60000 },
    { ticker: 'SBK.JO', name: 'Standard Bank', value: 25000 },
    { ticker: 'AGL.JO', name: 'Anglo', value: 10000 },
    { ticker: 'MTN.JO', name: 'MTN', value: 5000 },
    { ticker: 'SOL.JO', name: 'Sasol', value: 4000 },
    { ticker: 'BTI.JO', name: 'British American Tobacco', value: 3000 },
  ];

  /** @param {string} ticker */
  const seriesFor = (ticker) => ({
    ticker,
    points: [
      { date: '2026-07-01', close: 100 },
      { date: '2026-08-01', close: 120 },
    ],
  });

  beforeEach(() => {
    vi.mocked(getHoldingSeries).mockReset();
    vi.mocked(getHoldingSeries).mockImplementation(async (tickers) => ({
      period: '1y',
      series: tickers.map(seriesFor),
      not_held: [],
    }));
  });

  const openList = async () => {
    if (!screen.queryByRole('listbox')) {
      await userEvent.click(screen.getByRole('button', { name: /compare holdings/i }));
    }
  };

  /** @param {string} ticker */
  const pick = async (ticker) => {
    await openList();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${ticker}`) }));
  };

  it('folds the card away from its header and leaves the header usable', async () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });
    const toggle = screen.getByRole('button', { name: /collapse performance vs benchmark/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    const collapsed = screen.getByRole('button', { name: /expand performance vs benchmark/i });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Performance history settings' })).toBeInTheDocument();
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('keeps the header legend the same size however many holdings are picked', async () => {

    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    const keys = () => screen.getAllByText(/^(Portfolio|JSE ALSI)$/).length;
    const before = keys();

    for (const ticker of ['NPN.JO', 'SBK.JO', 'AGL.JO']) {
      await pick(ticker);
    }
    await waitFor(() => expect(screen.getByText(/Indexed to 100/)).toBeInTheDocument());

    expect(keys()).toBe(before);
    expect(screen.getAllByText('NPN.JO')).toHaveLength(2);
  });

  it('keeps the rand view until a holding is picked', () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    expect(screen.queryByText(/Indexed to 100/)).not.toBeInTheDocument();
    expect(getHoldingSeries).not.toHaveBeenCalled();
  });

  it('switches to an index and names the rebase date once one is picked', async () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    await pick('NPN.JO');

    await waitFor(() => {
      expect(screen.getByText(/Indexed to 100 at 2026-07-01/)).toBeInTheDocument();
    });
    expect(getHoldingSeries).toHaveBeenCalledWith(['NPN.JO'], '1y');
  });

  it('stops at five and says why', async () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    for (const ticker of ['NPN.JO', 'SBK.JO', 'AGL.JO', 'MTN.JO', 'SOL.JO']) {
      await pick(ticker);
    }

    await openList();
    const sixth = screen.getByRole('button', { name: /^BTI\.JO/ });
    expect(sixth).toBeDisabled();
    expect(screen.getByText(/5 at a time/)).toBeInTheDocument();
  });

  it('returns to the rand view on Clear', async () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    await pick('NPN.JO');
    await waitFor(() => expect(screen.getByText(/Indexed to 100/)).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.queryByText(/Indexed to 100/)).not.toBeInTheDocument());
  });

  it('lists holdings by weight, largest first', async () => {
    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    await openList();
    const options = screen.getAllByRole('option').map((o) => o.textContent);

    expect(options[0]).toContain('NPN.JO');
    expect(options[0]).toContain('56.1%');
    expect(options[3]).toContain('MTN.JO');
  });

  it('reads the index tooltip as a move from the start, not as rands', () => {
    const payload = [{ dataKey: 'value', color: 'var(--accent-primary)', value: 112.5 }];
    render(<IndexTooltip active payload={payload} label="Aug 01" benchmarkLabel="JSE ALSI" />);

    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    expect(screen.queryByText(/R\s?\d/)).not.toBeInTheDocument();
  });
});

describe('addressing a point on the chart', () => {
  it('places the end marker by date, not by the name two Augusts share', () => {
    const twoYears = [
      { date: '2025-08-05', name: 'Aug 05', value: 100, 'NPN.JO': 100 },
      { date: '2026-02-10', name: 'Feb 10', value: 118, 'NPN.JO': 130 },
      { date: '2026-08-05', name: 'Aug 05', value: 124, 'NPN.JO': 141 },
    ];

    const marker = endMarker({ rows: twoYears, ticker: 'NPN.JO', colour: 'var(--accent-primary)' });

    expect(marker?.props.x).toBe('2026-08-05');
    expect(marker?.props.y).toBe(141);
  });

  it('draws nothing for a holding with no value on the last row', () => {
    const rows = [{ date: '2026-08-05', name: 'Aug 05', value: 124, 'NPN.JO': null }];
    expect(endMarker({ rows, ticker: 'NPN.JO', colour: 'var(--accent-primary)' })).toBeNull();
  });
});

describe('eventDots', () => {
  const ROWS = [
    { date: '2026-07-01', name: 'Jul 01', value: 100000 },
    { date: '2026-07-15', name: 'Jul 15', value: 104000 },
    { date: '2026-08-01', name: 'Aug 01', value: 110000 },
  ];

  /** @param {string} date @param {number} z @param {string} direction */
  const event = (date, z, direction) => ({
    ticker: 'NPN.JO', date, z_score: z, direction, return_pct: z * 2,
  });

  it('sits each dot on the portfolio value for that day', () => {
    const dots = eventDots({ rows: ROWS, events: { events: [event('2026-07-15', -4.1, 'down')] } });

    expect(dots).toHaveLength(1);
    expect(dots[0].y).toBe(104000);
    expect(dots[0].key).toBe('NPN.JO:2026-07-15');
  });

  it('drops events outside the range on screen rather than clamping them to an edge', () => {
    const dots = eventDots({
      rows: ROWS,
      events: { events: [event('2026-01-04', -5.2, 'down'), event('2026-08-01', -4.0, 'down')] },
    });

    expect(dots.map((d) => d.event.date)).toEqual(['2026-08-01']);
  });

  it('colours every dot by direction and by nothing else', () => {
    const dots = eventDots({
      rows: ROWS,
      events: {
        events: [
          event('2026-07-01', -3.2, 'down'),
          event('2026-07-15', -4.1, 'down'),
          event('2026-08-01', 3.9, 'up'),
        ],
      },
    });

    /** @param {string} date */
    const fillOn = (date) => dots.find((d) => d.event.date === date)?.fill;
    expect(fillOn('2026-07-01')).toBe('var(--signal-negative)');
    expect(fillOn('2026-07-15')).toBe('var(--signal-negative)');
    expect(fillOn('2026-08-01')).toBe('var(--signal-positive)');
  });

  it('keeps the eight most unusual moves so a volatile book is not a rash', () => {
    const dates = Array.from({ length: 12 }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`);
    const rows = dates.map((date) => ({ date, name: date, value: 100000 }));

    const events = { events: dates.map((date, i) => event(date, -(3.1 + i * 0.1), 'down')) };

    const dots = eventDots({ rows, events });

    expect(dots).toHaveLength(8);
    expect(Math.abs(dots[0].event.z_score)).toBeCloseTo(4.2, 6);
    expect(Math.abs(dots[7].event.z_score)).toBeCloseTo(3.5, 6);
  });

  it('draws nothing when the scan is missing or empty', () => {
    expect(eventDots({ rows: ROWS, events: null })).toEqual([]);
    expect(eventDots({ rows: ROWS, events: { events: [] } })).toEqual([]);
  });
});

describe('performance history settings', () => {
  const SPANNING_IMPORT = [
    { date: '2026-02-04', name: 'Feb 04', value: 100000, benchmark: 100000, twr_index: 100 },
    { date: '2026-07-31', name: 'Jul 31', value: 120000, benchmark: 108000, twr_index: 120 },
    { date: '2026-08-31', name: 'Aug 31', value: 126000, benchmark: 115000, twr_index: 126 },
  ];
  const DATES = { importedAt: '2026-07-31' };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('says which values were reconstructed rather than presenting them as recorded', () => {
    renderChart({ series: SPANNING_IMPORT, historyDays: 220, ...DATES });

    expect(
      screen.getByText(/Values before 31 July 2026 are reconstructed from your statement\./),
    ).toBeInTheDocument();
  });

  it('stays quiet when nothing on screen was reconstructed', () => {
    renderChart({ series: SPANNING_IMPORT.slice(1), historyDays: 40, ...DATES });

    expect(screen.queryByText(/are reconstructed from your statement/)).not.toBeInTheDocument();
  });

  it('opens the settings from the card header', async () => {
    renderChart({ series: SPANNING_IMPORT, historyDays: 220, ...DATES });

    await userEvent.click(screen.getByRole('button', { name: 'Performance history settings' }));

    expect(screen.getByRole('dialog', { name: /performance history/i })).toBeInTheDocument();
    expect(screen.getByText(/Uploaded 31 July 2026/)).toBeInTheDocument();
  });

  it('plots only what was recorded once the user asks for that', async () => {
    renderChart({ series: SPANNING_IMPORT, historyDays: 220, ...DATES });

    await userEvent.click(screen.getByRole('button', { name: 'Performance history settings' }));
    await userEvent.click(screen.getByRole('radio', { name: /only since i uploaded/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('+5.0%')).toBeInTheDocument();
    expect(screen.queryByText(/are reconstructed from your statement/)).not.toBeInTheDocument();
  });

  it('explains an empty chart instead of drawing one', async () => {
    const justImported = [
      { date: '2026-02-04', name: 'Feb 04', value: 100000, benchmark: 100000, twr_index: 100 },
      { date: '2026-07-20', name: 'Jul 20', value: 120000, benchmark: 108000, twr_index: 120 },
    ];
    renderChart({ series: justImported, historyDays: 200, ...DATES });

    await userEvent.click(screen.getByRole('button', { name: 'Performance history settings' }));
    await userEvent.click(screen.getByRole('radio', { name: /only since i uploaded/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('Building history - 0 days so far')).toBeInTheDocument();
    expect(screen.getByText(/which starts on 31 July 2026/)).toBeInTheDocument();
  });

  it('renders with defaults when localStorage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderChart({ series: SPANNING_IMPORT, historyDays: 220, ...DATES });

    expect(screen.getByText('Portfolio return')).toBeInTheDocument();
    expect(screen.getByText(/are reconstructed from your statement/)).toBeInTheDocument();

    getItem.mockRestore();
  });
});

describe('holding groups', () => {

  const HOLDINGS = [
    { ticker: 'NPN.JO', name: 'Naspers', value: 60000, current_price: 110 },
    { ticker: 'SBK.JO', name: 'Standard Bank', value: 40000, current_price: 110 },
  ];

  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getHoldingSeries).mockReset();
    vi.mocked(getHoldingSeries).mockImplementation(async (tickers) => ({
      period: '1y',
      series: tickers.map((ticker) => ({
        ticker,
        points: [
          { date: '2026-07-01', close: 100 },
          { date: '2026-08-01', close: 110 },
        ],
      })),
      not_held: [],
    }));
  });

  /** @param {any[]} groups */
  const withGroups = (groups) => {
    window.localStorage.setItem('performance_holding_groups', JSON.stringify(groups));
    return renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });
  };

  it('fetches every group member without the user selecting anything', async () => {
    withGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }]);

    await waitFor(() => {
      expect(getHoldingSeries).toHaveBeenCalledWith(['NPN.JO', 'SBK.JO'], '1y');
    });
  });

  it('draws the group and says how it is weighted', async () => {
    withGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }]);

    await waitFor(() => {
      expect(screen.getByText(/Indexed to 100/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Groups are weighted by what each holding was worth on the first day/),
    ).toBeInTheDocument();
  });

  it('falls back to today\'s values, and says so, when a member has no price', async () => {
   
    const noPrice = [
      { ticker: 'NPN.JO', name: 'Naspers', value: 60000, current_price: 120 },
      { ticker: 'AGL.JO', name: 'Anglo', value: 40000 },
    ];
    window.localStorage.setItem(
      'performance_holding_groups',
      JSON.stringify([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'AGL.JO'] }]),
    );
    renderChart({ series: SERIES, historyDays: 31, holdings: noPrice });

    await waitFor(() => {
      expect(
        screen.getByText(/Groups are weighted by what each holding is worth today/),
      ).toBeInTheDocument();
    });
  });

  const chipRow = () => /** @type {HTMLElement} */ (screen.getByText('Banks').closest('div'));

  it('draws one line for a group and none for its members', async () => {
    withGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }]);

    await waitFor(() => {
      expect(screen.getByText('Banks')).toBeInTheDocument();
    });
    
    expect(within(chipRow()).queryByText('NPN.JO')).not.toBeInTheDocument();
    expect(within(chipRow()).queryByText('SBK.JO')).not.toBeInTheDocument();
  });

  it('still draws a holding individually when it is also in a group', async () => {
    
    withGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }]);

    const trigger = screen.getByRole('button', { name: /compare holdings/i });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: /^NPN\.JO/ }));

    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Banks')).toBeInTheDocument();
    });
    const inRow = within(chipRow());
    expect(inRow.getByText('NPN.JO')).toBeInTheDocument();
    expect(inRow.queryByText('SBK.JO')).not.toBeInTheDocument();
  });

  it('removes a group from its chip and offers it back until the panel closes', async () => {
    withGroups([{ id: 'g1', name: 'Banks', members: ['NPN.JO', 'SBK.JO'] }]);
    await waitFor(() => expect(screen.getByText('Banks')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Remove Banks' }));

    expect(screen.queryByText('Banks')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /compare holdings/i });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('tab', { name: /build holding groups/i }));

    await userEvent.click(await screen.findByRole('button', { name: /restore banks/i }));
    expect(await screen.findByText('Banks')).toBeInTheDocument();
  });

  it('renders with no groups when localStorage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    renderChart({ series: SERIES, historyDays: 31, holdings: HOLDINGS });

    expect(screen.getByText('Portfolio return')).toBeInTheDocument();
    expect(screen.queryByText(/Groups are weighted/)).not.toBeInTheDocument();

    getItem.mockRestore();
  });
});

describe('event markers', () => {
  const SPANNING = [
    { date: '2026-01-29', name: 'Jan 29', value: 100000, benchmark: 100000, twr_index: 100 },
    { date: '2026-01-30', name: 'Jan 30', value: 96000, benchmark: 96000, twr_index: 96 },
  ];

  /** @param {any} over */
  const payload = (over) => ({ events: [], coverage: { holdings_scanned: 3 }, ...over });

  it('marks a fall red and a rise green, and nothing any other way', () => {
    const dots = eventDots({
      rows: SPANNING,
      events: payload({ events: [
        { ticker: 'STX40.JO', date: '2026-01-30', z_score: -4.2, direction: 'down' },
        { ticker: 'NPN.JO', date: '2026-01-30', z_score: 3.2, direction: 'up' },
      ] }),
    });

    expect(dots.map((d) => d.fill).sort()).toEqual([
      'var(--signal-negative)', 'var(--signal-positive)',
    ]);
    expect(dots.every((d) => d.stroke === 'var(--surface-card)')).toBe(true);
    expect(dots.every((d) => d.strokeWidth === 1.5)).toBe(true);
  });

  it('has no markers when the scan found nothing', () => {
    expect(eventDots({ rows: SPANNING, events: payload({}) })).toEqual([]);
  });
});
