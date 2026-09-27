import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import DashboardSignals from './DashboardSignals';

const SUMMARY = /** @type {any} */ ({
  headline: 'Technology is 62% of your book.',
  supportingText: ['Your biggest position is NPN at 41%.', 'You are ahead of the JSE ALSI by 3.2%.'],
  severity: 'risk',
  badge: 'Concentration',
  suggestedActions: [
    { label: 'Review Holdings', target: 'holdings-table' },
    { label: 'Ask AI Why', question: 'Why is my NPN concentration a risk?', to: '/ai?q=x' },
    { label: 'Import Portfolio', to: '/portfolio' },
  ],
  signals: [{ rank: 1 }],
});

const renderSignals = (props = {}) =>
  render(
    <MemoryRouter>
      <DashboardSignals summary={SUMMARY} {...props} />
    </MemoryRouter>,
  );

describe('DashboardSignals', () => {
  it('leads with the headline', () => {
    renderSignals();

    expect(screen.getByText('Technology is 62% of your book.')).toBeInTheDocument();
    expect(screen.getByText('Concentration')).toBeInTheDocument();
    expect(screen.getByText('Your biggest position is NPN at 41%.')).toBeInTheDocument();
  });

  it('never renders more than three actions', () => {
    const many = {
      ...SUMMARY,
      suggestedActions: [
        ...SUMMARY.suggestedActions,
        { label: 'A fourth thing', to: '/plan' },
        { label: 'A fifth thing', to: '/plan' },
      ],
    };
    render(
      <MemoryRouter>
        <DashboardSignals summary={many} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('A fourth thing')).not.toBeInTheDocument();
    expect(screen.getByText('Review Holdings')).toBeInTheDocument();
  });

  it('scrolls rather than navigating for an action with a target', () => {
    const onScrollTo = vi.fn();
    renderSignals({ onScrollTo });

    fireEvent.click(screen.getByText('Review Holdings'));

    expect(onScrollTo).toHaveBeenCalledWith('holdings-table');
  });

  it('asks rather than navigating for an action carrying a question', () => {
    const onAsk = vi.fn();
    renderSignals({ onAsk });

    fireEvent.click(screen.getByText('Ask AI Why'));

    expect(onAsk).toHaveBeenCalledWith('Why is my NPN concentration a risk?');
  });

  it('still renders the well-diversified answer, which has no signals', () => {
    const calm = {
      ...SUMMARY,
      severity: 'neutral',
      headline: 'Nothing needs your attention today.',
      signals: [],
      suggestedActions: [],
    };
    render(
      <MemoryRouter>
        <DashboardSignals summary={calm} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nothing needs your attention today.')).toBeInTheDocument();
  });
});
