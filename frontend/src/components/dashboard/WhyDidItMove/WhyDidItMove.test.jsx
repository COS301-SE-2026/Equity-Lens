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
  ticker: 'MTN.JO',
  name: 'MTN Group',
  date: '2026-07-31',
  return_pct: -10.8,
  z_score: -5.83,
  direction: 'down',
  annualised_volatility_pct: 29.6,
  observations: 246,
  band: 'extremely_unusual',
  times_normal: 5.8,
  daily_sigma_pct: 1.86,
  rank_in_period: 1,
  period_days: 246,
};

const DETAIL = {
  available: true,
  reason: null,
  ticker: 'MTN.JO',
  benchmark_label: 'Satrix 40',
  observations: 100,
  alpha: 0.000001,
  alpha_se: 0.000303,
  alpha_t: 0.0,
  beta: 0.48,
  r_squared: 0.31,
  sigma_ar: 0.003015,
  residual_sigma: 0.00303,
  move_type: 'company',
  tracks_benchmark: false,
  decomposition: {
    stock_return_pct: -10.8,
    market_return_pct: -0.4,
    beta: 0.48,
    market_component_pct: -0.19,
    company_component_pct: -10.61,
  },
  decomposition_reason: null,
  estimation_window: { from: '2026-02-05', to: '2026-06-30', offsets: [-120, -21] },
  event_window: { from: '2026-07-24', to: '2026-08-14', length: 16 },
  abnormal_returns: [
    {
      date: '2026-07-31',
      offset: 0,
      stock_return_pct: -10.8,
      market_return_pct: -0.4,
      abnormal_return_pct: -10.61,
      cumulative_abnormal_return_pct: -10.61,
      car_lower_pct: -12.06,
      car_upper_pct: -9.16,
      significant: true,
    },
  ],
  after_event: null,
  portfolio_impact: {
    held_on_date: true,
    weight_pct: 8.8,
    contribution_pct: -0.95,
    basis: 'holdings_on_date',
  },
  possible_explanations: [],
};

const ARTICLE = {
  article_id: 'a',
  title: 'MTN shares slide on Ghana ruling',
  url: 'https://example.com/a',
  source_name: 'Moneyweb',
  published_at: '2026-07-31T06:00:00Z',
  relevance: 'close',
  scores: {
    bm25: 3.1,
    bm25_normalised: 0.62,
    date_proximity: 1.0,
    entity_match: 1.0,
    combined: 0.81,
  },
  evidence: {
    named_in_headline: true,
    provider_match_score: 44.1,
    days_from_event: 0,
    highlight: 'MTN fell after a court ruling in Ghana',
    ingest_mode: 'backfill',
    collected_at: '2026-09-27T13:05:00Z',
  },
};

describe('EventPopover', () => {
  it('opens on the headline, the number and the date', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('MTN.JO fell sharply')).toBeInTheDocument();
    expect(screen.getByText('-10.8%')).toBeInTheDocument();
    expect(screen.getByText('31 July 2026')).toBeInTheDocument();
  });

  it('says what it did to the portfolio from the weight on the day', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    // 8.8% x -10.8% / 100 = -0.95 from the backend
    expect(
      screen.getByText(
        'MTN.JO was 8.8% of your portfolio the day before, so this move took about 0.95% off ' +
          'your portfolio that day.',
      ),
    ).toBeInTheDocument();
  });

  it('says a move it did not hold did not touch the portfolio', () => {
    const notHeld = { ...DETAIL, portfolio_impact: { held_on_date: false, basis: 'not_held' } };
    render(<EventPopover event={EVENT} detail={notHeld} />);

    expect(
      screen.getByText(
        "You didn't hold MTN.JO on this date, so this move didn't affect your portfolio.",
      ),
    ).toBeInTheDocument();
  });

  it('says how unusual it was, and parts of the move that add up to it', async () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('Extremely unusual')).toBeInTheDocument();
    expect(screen.getByText("About 5.8× MTN.JO's normal daily movement.")).toBeInTheDocument();
    expect(
      screen.getByText('Its biggest one-day fall in the past 246 trading days.'),
    ).toBeInTheDocument();
    // -10.8 = -0.2 (market) + -10.6 (company)
    expect(screen.getByText('Market-adjusted move: -10.6%')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Why we say this' }));
    expect(screen.getByText(/predicts about -0\.2%, leaving -10\.6%/)).toBeInTheDocument();
  });

  it('says there is no news plainly, and still describes the move', () => {
    render(<EventPopover event={EVENT} detail={DETAIL} />);

    expect(screen.getByText('What might explain it?')).toBeInTheDocument();
    expect(screen.getByText('No matching news found')).toBeInTheDocument();
    expect(screen.getByText(/unusually large and mostly specific to MTN\.JO/)).toBeInTheDocument();
  });

  it('lists each article with the reasons it is there', () => {
    render(<EventPopover event={EVENT} detail={{ ...DETAIL, possible_explanations: [ARTICLE] }} />);

    expect(screen.getByText('MTN shares slide on Ghana ruling')).toBeInTheDocument();
    expect(screen.getByText('Closely related')).toBeInTheDocument();
    expect(screen.getByText('Names MTN.JO in the headline')).toBeInTheDocument();
    expect(screen.getByText('Published the same day')).toBeInTheDocument();
    expect(screen.getByText('MTN fell after a court ruling in Ghana')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open: MTN shares slide on Ghana ruling' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "These articles were published around the move and mention MTN.JO. That doesn't mean they caused it.",
      ),
    ).toBeInTheDocument();
  });

  it('shows an article from before evidence was stored with no relevance label', () => {
    const old = {
      article_id: 'o',
      title: 'An older story',
      source_name: 'X',
      published_at: '2026-07-30T06:00:00Z',
    };
    render(<EventPopover event={EVENT} detail={{ ...DETAIL, possible_explanations: [old] }} />);

    expect(screen.getByText('An older story')).toBeInTheDocument();
    expect(screen.queryByText('Closely related')).not.toBeInTheDocument();
    expect(screen.queryByText('Related')).not.toBeInTheDocument();
  });

  it('never says an article caused the move, beyond saying it does not', () => {
    const { container } = render(
      <EventPopover event={EVENT} detail={{ ...DETAIL, possible_explanations: [ARTICLE] }} />,
    );

    const words = (container.textContent ?? '')
      .toLowerCase()
      .replace("that doesn't mean they caused it.", '');
    for (const forbidden of [
      'caused',
      'because of',
      'due to',
      'driven by',
      'drove',
      'likely driver',
    ]) {
      expect(words).not.toContain(forbidden);
    }
  });

  it('says what else fell that day, next to the market part', () => {
    const sameDay = {
      scanned: 48,
      unusual: 6,
      same_direction: 6,
      expected_by_chance: 0.13,
      tickers: ['SBK.JO', 'FSR.JO', 'NED.JO', 'ABG.JO'],
    };
    render(<EventPopover event={EVENT} detail={{ ...DETAIL, same_day: sameDay }} />);

    const section = screen.getByText('How unusual was this?').closest('section');
    expect(
      within(/** @type {HTMLElement} */ (section)).getByText(
        "It wasn't alone: 6 of the 48 large caps we track also fell unusually that day " +
          '(SBK.JO, FSR.JO, NED.JO), so this may have been a sector or market shock that the ' +
          'index did not fully capture.',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the statistics one click away', async () => {
    render(<EventPopover event={EVENT} detail={DETAIL} scan={{ k_sigma: 3, coverage: {} }} />);

    expect(screen.queryByText('β')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Detection.*event-study details/i }));

    const panel = screen.getByText('estimation window').closest('dl');
    expect(panel).not.toBeNull();
    expect(
      within(/** @type {HTMLElement} */ (panel)).getByText(
        '[-120, -21] trading days, 2026-02-05 to 2026-06-30',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('EWMA, λ 0.94, flagged beyond k = 3.0σ')).toBeInTheDocument();
    expect(screen.getByText(/nineteen times out of twenty/)).toBeInTheDocument();
  });

  it('has no separate ask or read buttons any more, and one way to explore', async () => {
    const onAsk = vi.fn();
    render(
      <EventPopover
        event={EVENT}
        detail={{ ...DETAIL, possible_explanations: [ARTICLE] }}
        onAsk={onAsk}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Ask AI about this move' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read the article' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Explore possible causes' }));
    const question = onAsk.mock.calls[0][0];
    expect(question).toContain('leaving -10.6% specific to MTN.JO');
    expect(question).toContain('Do not state a specific cause; you have not been given one.');
  });

  it('describes the move while the detail request is still in flight', () => {
    render(<EventPopover event={EVENT} pending />);

    expect(screen.getByText('MTN.JO fell sharply')).toBeInTheDocument();
    expect(screen.getByText('Looking...')).toBeInTheDocument();
    expect(screen.queryByText('Impact on your portfolio')).not.toBeInTheDocument();
  });

  it('closes on the header X, and replacing the event swaps the card', () => {
    const onClose = vi.fn();
    const { rerender } = render(<EventPopover event={EVENT} detail={DETAIL} onClose={onClose} />);

    screen.getByRole('button', { name: 'Close this explanation' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);

    const other = { ...EVENT, ticker: 'SBK.JO', band: 'unusual' };
    rerender(<EventPopover event={other} detail={null} onClose={onClose} />);
    expect(screen.getByText('SBK.JO had an unusual fall')).toBeInTheDocument();
    expect(screen.queryByText('MTN.JO fell sharply')).not.toBeInTheDocument();
  });
});
