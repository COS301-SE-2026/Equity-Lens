import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import TodayInsights from './TodayInsights';

const LEGACY = [
  {
    type: 'gain',
    text: "NPN is today's biggest gainer, up 2.5% (+R 1 125).",
    why: '2.5% is within typical movement.',
    action: null,
  },
  {
    type: 'driver',
    text: "77% of today's gain came from NPN.",
    why: "Ranked by each holding's Rand contribution.",
    action: null,
  },
];

const REGISTRY = [
  {
    id: 'conc.top-holding',
    category: 'concentration',
    severity: 'risk',
    text: 'NPN.JO is 58% of your book.',
    why: 'One company now decides most of what your portfolio does.',
    evidence: [
      { label: 'NPN.JO', value: 'R 62 000' },
      { label: 'Share of book', value: '58.0%' },
    ],
    action: null,
  },
  {
    id: 'contrib.deposits-vs-growth',
    category: 'contributions',
    severity: 'neutral',
    text: "65% of your portfolio's value is money you put in.",
    why: 'A portfolio can grow because it is being fed rather than because it is performing.',
    evidence: [{ label: 'Net contributions', value: 'R 78 000' }],
    action: null,
  },
];

describe('TodayInsights', () => {
  it('renders each insight as its own line', () => {
    render(<TodayInsights insights={LEGACY} />);

    expect(screen.getByText(/npn is today's biggest gainer/i)).toBeInTheDocument();
    expect(screen.getByText(/77% of today's gain came from npn/i)).toBeInTheDocument();
  });

  it('keeps its panel and explains itself when there are no insights', () => {
    render(<TodayInsights insights={[]} />);

    expect(screen.getByText('Portfolio Insights')).toBeInTheDocument();
    expect(screen.getByText('Nothing notable moved today.')).toBeInTheDocument();
  });

  it('is no longer named for a daily move it usually cannot report', () => {
    render(<TodayInsights insights={REGISTRY} />);

    expect(screen.getByText('Portfolio Insights')).toBeInTheDocument();
    expect(screen.queryByText("Today's Insights")).not.toBeInTheDocument();
  });

  it('labels each card with its category', () => {
    render(<TodayInsights insights={REGISTRY} />);

    expect(screen.getByText('CONCENTRATION')).toBeInTheDocument();
    expect(screen.getByText('CONTRIBUTIONS')).toBeInTheDocument();
  });

  it('shows the figures behind an insight, not just the sentence', () => {
    render(<TodayInsights insights={REGISTRY} />);
    const card = screen.getByText('NPN.JO is 58% of your book.').closest('div');
    if (!card) throw new Error('expected the card to render');

    fireEvent.click(within(card).getByText('Why?'));

    expect(within(card).getByText('Share of book')).toBeInTheDocument();
    expect(within(card).getByText('58.0%')).toBeInTheDocument();
    expect(within(card).getByText(/One company now decides/)).toBeInTheDocument();
  });

  it('routes a target action to the scroll handler and a question action to the dock', () => {
    const onScrollTo = vi.fn();
    const onAsk = vi.fn();
    const insight = {
      id: 'conc.top-holding',
      category: 'concentration',
      severity: 'risk',
      text: 'NPN.JO is 58% of your book.',
      why: 'One company now decides most of what your portfolio does.',
      evidence: [{ label: 'Share of book', value: '58.0%' }],
      actions: [
        { label: 'View Holdings', target: 'holdings-table' },
        {
          label: 'Ask AI Why',
          question: 'Why is that a risk?',
          to: '/ai?q=Why%20is%20that%20a%20risk%3F',
        },
      ],
    };

    render(<TodayInsights insights={[insight]} onScrollTo={onScrollTo} onAsk={onAsk} />);

    fireEvent.click(screen.getByText('View Holdings'));
    expect(onScrollTo).toHaveBeenCalledWith('holdings-table');

    fireEvent.click(screen.getByRole('button', { name: /why\?/i }));
    fireEvent.click(screen.getByText('Ask AI Why'));
    expect(onAsk).toHaveBeenCalledWith('Why is that a risk?');
  });

  it("keeps an insight's AI question hidden until Why? is expanded", () => {
    const insight = {
      id: 'conc.top-holding',
      severity: 'risk',
      text: 'NPN.JO is 58% of your book.',
      why: 'One company decides the result.',
      actions: [
        { label: 'View Holdings', target: 'holdings-table' },
        { label: 'Ask AI Why', question: 'Why is that a risk?' },
      ],
    };
    render(<TodayInsights insights={[insight]} onScrollTo={vi.fn()} onAsk={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'View Holdings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask AI Why' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /why\?/i }));
    expect(screen.getByRole('button', { name: 'Ask AI Why' })).toBeInTheDocument();
  });

  it('renders at most three actions beside the Why toggle', () => {
    const insight = {
      id: 'conc.top-holding',
      severity: 'risk',
      text: 'NPN.JO is 58% of your book.',
      why: 'One company decides the result.',
      actions: [
        { label: 'One', target: 'a' },
        { label: 'Two', target: 'b' },
        { label: 'Three', target: 'c' },
        { label: 'Four', target: 'd' },
      ],
    };

    render(<TodayInsights insights={[insight]} onScrollTo={vi.fn()} />);

    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.queryByText('Four')).not.toBeInTheDocument();
  });

  it('keeps the rest behind one button rather than a scroll of thirty', () => {
    render(<TodayInsights insights={REGISTRY} more={[LEGACY[0], LEGACY[1]]} />);

    expect(screen.queryByText(/biggest gainer/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Show 2 more'));

    expect(screen.getByText(/biggest gainer/i)).toBeInTheDocument();
    expect(screen.queryByText('Show 2 more')).not.toBeInTheDocument();
  });

  it('offers no Show more button when there is nothing more', () => {
    render(<TodayInsights insights={REGISTRY} />);
    expect(screen.queryByText(/Show \d+ more/)).not.toBeInTheDocument();
  });
});
