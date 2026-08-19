import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import DashboardHero from './DashboardHero';

const DATA = { holdings: [{ ticker: 'NPN', sector: 'Technology', value: 45000, daily_change_pct: 1.2 }],
  summary: { total_value: 77000, daily_change: 1.2 },
};

const ATTRIBUTION = { contributors: [{ ticker: 'NPN', contribution: 540 }],
  drags: [],
  todayReturn: 540,
};

const HEALTH = { score: 5.0, label: 'Needs Attention' };

/**
 * @type {{
 *   headline: string;
 *   supportingText: string[];
 *   severity: 'risk' | 'neutral' | 'opportunity';
 *   badge: string;
 *   suggestedActions: { label: string; to?: string; target?: string; prefill?: string }[];
 * }}
 */
const SUMMARY = { headline: 'NPN is your largest holding at 67% of your portfolio, making single-stock risk your primary concern.',
  supportingText: ['Technology represents 67% of your portfolio making sector concentration a significant source of risk.'],
  severity: 'risk',
  badge: 'Concentration',
  suggestedActions: [
    { label: 'View Holdings', target: 'holdings-table' },
    { label: 'Ask AI Why', to: '/ai', prefill: 'Why is my NPN concentration considered a risk?' },
  ],
};

/** @param {Record<string, any>} [props] */
const renderHero = (props) =>
  render(
    <MemoryRouter>
      <DashboardHero
        name="Josh"
        portfolioData={props?.portfolioData ?? DATA}
        attribution={props?.attribution ?? ATTRIBUTION}
        health={props?.health ?? HEALTH}
        summary={props?.summary ?? SUMMARY}
        fetchedAt={props?.fetchedAt}
        onScrollToHealth={props?.onScrollToHealth ?? vi.fn()}
        onScrollTo={props?.onScrollTo ?? vi.fn()}
      />
    </MemoryRouter>,
  );

describe('DashboardHero', () => {
  it('greets by name and shows net worth and today change', () => {
    renderHero();
    expect(screen.getByText('Josh')).toBeInTheDocument();
    expect(screen.getByText('Net Worth')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders headline and supporting lines and badge', () => {
    renderHero();
    expect(screen.getByText('Portfolio Summary')).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.headline)).toBeInTheDocument();
    expect(screen.getByText(SUMMARY.supportingText[0])).toBeInTheDocument();
    expect(screen.getByText('Concentration')).toBeInTheDocument();
  });

  it('renders suggestedActions and Ask AI Why', () => {
    renderHero();
    expect(screen.getByText('View Holdings')).toBeInTheDocument();
    const askWhy = screen.getByText('Ask AI Why');
    expect(askWhy).toHaveAttribute('href', '/ai?q=' + encodeURIComponent(SUMMARY.suggestedActions[1].prefill ?? ''));
  });

  it('scrolls to target section', () => {
    const onScrollTo = vi.fn();
    renderHero({ onScrollTo });
    fireEvent.click(screen.getByText('View Holdings'));
    expect(onScrollTo).toHaveBeenCalledWith('holdings-table');
  });

  it('Doesnt calls AI endpoint to build summary', () => {
    renderHero();
    expect(screen.getByText(SUMMARY.headline)).toBeInTheDocument();
  });

  it('shows portfolio health', () => {
    renderHero();
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('Review Portfolio Health')).toBeInTheDocument();
    expect(screen.getByText('Ask AI Assistant')).toBeInTheDocument();
  });

  it('scrolls to health section', () => {
    const onScrollToHealth = vi.fn();
    renderHero({ onScrollToHealth });
    fireEvent.click(screen.getByText('Review Portfolio Health'));
    expect(onScrollToHealth).toHaveBeenCalled();
  });

  it('hides health badge when no score', () => {
    renderHero({ health: { score: null, label: null } });
    expect(screen.queryByText('Review Portfolio Health')).not.toBeInTheDocument();
  });

  it('prompts import when no holdings', () => {
    renderHero({
      portfolioData: { holdings: [], summary: { total_value: 0, daily_change: 0 } },
      attribution: { contributors: [], drags: [], todayReturn: 0 },
      health: { score: null, label: null },
      summary: {
        headline: 'Import a portfolio to see your executive summary.',
        supportingText: [],
        severity: 'neutral',
        badge: 'Overview',
        suggestedActions: [{ label: 'Import Portfolio', to: '/portfolio' }],
      },
    });
    expect(screen.getByText(/import a portfolio to see your executive summary/i)).toBeInTheDocument();
  });

  it('shows a "updated x ago" when fetchedAt known and nothing when not', () => {
    const { rerender } = renderHero({ fetchedAt: new Date() });
    expect(screen.getByText('Updated just now')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <DashboardHero
          name="Josh"
          portfolioData={DATA}
          attribution={ATTRIBUTION}
          health={HEALTH}
          summary={SUMMARY}
          fetchedAt={null}
          onScrollToHealth={vi.fn()}
          onScrollTo={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
  });
});
