import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import EventPopover from './WhyDidItMove';

vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    /** @param {{ children?: import('react').ReactNode }} props */
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
  };
});

const EVENT = {
  ticker: 'NPN.JO',
  name: 'Naspers',
  date: '2026-03-15',
  return_pct: -8.2,
  z_score: -3.4,
  direction: 'down',
  annualised_volatility_pct: 31.4,
  observations: 246,
};

const DETAIL = {
  available: true,
  reason: null,
  ticker: 'NPN.JO',
  date: '2026-03-15',
  benchmark_label: 'JSE Top 40',
  observations: 99,
  alpha: 0.000214,
  beta: 1.1832,
  r_squared: 0.4127,
  residual_sigma: 0.0142,
  move_type: 'company',
  tracks_benchmark: false,
  estimation_window: { from: '2026-02-19', to: '2026-07-17', offsets: [-120, -22] },
  event_window: { from: '2026-03-08', to: '2026-03-29', length: 16 },
  abnormal_returns: [
    {
      date: '2026-03-15', offset: 0,
      stock_return_pct: -8.2, market_return_pct: -0.3, abnormal_return_pct: -7.85,
      cumulative_abnormal_return_pct: -7.85, car_lower_pct: -10.6, car_upper_pct: -5.1,
      significant: true,
    },
  ],
  possible_explanations: [
    {
      article_id: 'abc',
      title: 'Naspers reports first-half results',
      url: 'https://example.com/abc',
      source_name: 'Moneyweb',
      published_at: '2026-03-14T06:00:00Z',
      scores: {
        bm25: 4.81, bm25_normalised: 0.71, date_proximity: 0.8825,
        entity_match: 1.0, combined: 0.9298,
      },
    },
  ],
  note: 'Articles are listed because they are about this holding and close to this date.',
};

describe('EventPopover', () => {
  it('leads with the move in plain language, not with the regression', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('NPN.JO fell 8.2% on 15 March 2026')).toBeInTheDocument();
    expect(screen.getByText(/The remaining -7.8% was specific to NPN\.JO/)).toBeInTheDocument();
    expect(screen.queryByText('1.18')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Detection.*event-study details/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show the working' })).not.toBeInTheDocument();
  });

  it('shows the few key numbers as a scannable strip', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('-8.2%')).toBeInTheDocument();
    expect(screen.getByText('3.4σ')).toBeInTheDocument();
    expect(screen.getByText(/Company-specific .* -7\.8% abnormal/)).toBeInTheDocument();
  });

  it('reads a positive event correctly', () => {
    const up = { ...EVENT, ticker: 'AAPL', name: 'Apple', direction: 'up', return_pct: 6.1, z_score: 3.1 };
    render(<EventPopover event={up} detail={null} />);

    expect(screen.getByText('AAPL rose 6.1% on 15 March 2026')).toBeInTheDocument();
    expect(screen.getByText('+6.1%')).toBeInTheDocument();
    expect(screen.getByText('3.1σ')).toBeInTheDocument();
  });

  it('renders each likely-driver article with a plain-language confidence, not raw scores', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('Naspers reports first-half results')).toBeInTheDocument();
    expect(screen.getByText(/Moneyweb/)).toBeInTheDocument();
    expect(screen.getByText('strong match')).toBeInTheDocument();
    expect(screen.queryByText('BM25 0.71')).not.toBeInTheDocument();
  });

  it('orders the articles most relevant first, by combined score', () => {
    const twoArticles = {
      ...DETAIL,
      possible_explanations: [
        { article_id: 'weak', title: 'A loosely related piece', source_name: 'X',
          published_at: '2026-03-10T06:00:00Z', scores: { combined: 0.5, entity_match: 0 } },
        { article_id: 'strong', title: 'The direct results story', source_name: 'Y',
          published_at: '2026-03-14T06:00:00Z', scores: { combined: 0.93, entity_match: 1 } },
      ],
    };
    render(<EventPopover event={EVENT} detail={twoArticles} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('The direct results story')).toBeInTheDocument();
    expect(within(items[1]).getByText('A loosely related piece')).toBeInTheDocument();
  });

  it('carries the ranking caption word for word', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(
      screen.getByText(
        'Ranked by relevance to the event window. These are possible explanations, not established causes.',
      ),
    ).toBeInTheDocument();
  });

  it('never claims an article caused the move', () => {
    const { container } = render(<EventPopover event={EVENT} detail={DETAIL} />);

    const words = (container.textContent ?? '').toLowerCase();
    for (const forbidden of ['caused', 'because of', 'due to', 'driven by', 'led to']) {
      expect(words).not.toContain(forbidden);
    }
  });

  it('explains the move with no article, and does not read as a failure', () => {
    render(<EventPopover event={EVENT} detail={{ ...DETAIL, possible_explanations: [] }} />);

    expect(
      screen.getByText('We have no stored news about NPN.JO within three days of this date.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/The remaining -7.8% was specific to NPN\.JO/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read the article' })).not.toBeInTheDocument();
  });

  it('still says what happened when the model could not be fitted', () => {
    const thin = {
      available: false,
      reason: 'insufficient_history',
      ticker: 'NPN.JO',
      observations: 12,
      abnormal_returns: [],
      possible_explanations: DETAIL.possible_explanations,
    };

    render(<EventPopover event={EVENT} detail={thin} />);

    expect(screen.getByText('NPN.JO fell 8.2% on 15 March 2026')).toBeInTheDocument();
    expect(screen.getByText(/3\.4 times NPN\.JO's own normal daily swing/)).toBeInTheDocument();
    expect(
      screen.getByText('Not enough price history for NPN.JO to separate the market from the company.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Naspers reports first-half results')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Detection.*event-study details/i }),
    ).not.toBeInTheDocument();
  });

  it('tucks the CAR chart and raw fit numbers behind the details toggle', async () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.queryByText('1.18')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /Detection.*event-study details/i }),
    );
    expect(screen.getByText('expected return = alpha + beta × benchmark return')).toBeInTheDocument();
    expect(screen.getByText('1.18')).toBeInTheDocument();
  });

  it('shows an explicitly estimated contribution only when a weight is passed', () => {
    const { rerender } = render(<EventPopover event={EVENT} detail={DETAIL} weightPct={12.5} />);
    expect(screen.getByText(/12\.5% weight/)).toBeInTheDocument();
    expect(screen.getByText(/estimated contribution/)).toBeInTheDocument();

    rerender(<EventPopover event={EVENT} detail={DETAIL} />);
    expect(screen.queryByText(/estimated contribution/)).not.toBeInTheDocument();
  });

  it('closes on the header X, and replacing the event swaps the card', () => {
    const onClose = vi.fn();
    const { rerender } = render(<EventPopover event={EVENT} detail={DETAIL} onClose={onClose} />);

    screen.getByRole('button', { name: 'Close this explanation' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);

    const other = { ...EVENT, ticker: 'SBK.JO', name: 'Standard Bank' };
    rerender(<EventPopover event={other} detail={null} onClose={onClose} />);
    expect(screen.getByText('SBK.JO fell 8.2% on 15 March 2026')).toBeInTheDocument();
    expect(screen.queryByText('NPN.JO fell 8.2% on 15 March 2026')).not.toBeInTheDocument();
  });

  it('describes the move while the detail request is still in flight', () => {
    render(<EventPopover event={EVENT} pending />);

    expect(screen.getByText('NPN.JO fell 8.2% on 15 March 2026')).toBeInTheDocument();
    expect(screen.getByText('Looking...')).toBeInTheDocument();
  });

  it('hands the figures to the assistant rather than just the ticker', async () => {
    const onAsk = vi.fn();
    render(<EventPopover event={EVENT} detail={DETAIL} onAsk={onAsk} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ask AI about this move' }));

    const question = onAsk.mock.calls[0][0];
    expect(question).toContain('beta of 1.18');
    expect(question).toContain('3.4 standard deviations out');
    expect(question).toContain('Do not state a specific cause; you have not been given one.');
  });
});