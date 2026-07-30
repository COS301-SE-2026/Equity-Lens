import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import ActionBanner from './ActionBanner';

const ITEMS = [
  {
    id: 'sector-concentration',
    severity: 'risk',
    impact: 'Medium',
    title: 'Technology is 58% of your portfolio',
    detail: 'A single sector this large means sector-specific news can swing your whole book.',
    benefit: 'Reducing Technology below 40% could improve your Portfolio Health by +0.3.',
    healthImprovement: 0.3,
    cta: { label: 'Explore New Sectors', target: 'holdings-section' },
  },
  {
    id: 'low-diversification',
    severity: 'suggestion',
    impact: 'Low',
    title: 'Only 2 positions in your portfolio',
    detail: 'Most retail portfolios target 8-12 positions across sectors to reduce single-stock risk.',
    benefit: 'Adding a few more positions could improve your Portfolio Health.',
    healthImprovement: null,
    cta: { label: 'Fix Diversification', to: '/portfolio' },
  },
];

const renderBanner = (props) =>
  render(
    <MemoryRouter>
      <ActionBanner hasHoldings items={props?.items ?? ITEMS} onScrollTo={props?.onScrollTo ?? vi.fn()} />
    </MemoryRouter>,
  );

describe('ActionBanner', () => {
  it('renders each item as card', () => {
    renderBanner();
    expect(screen.getByText(/technology is 58% of your portfolio/i)).toBeInTheDocument();
    expect(screen.getByText('Explore New Sectors')).toBeInTheDocument();
    expect(screen.getByText('Fix Diversification')).toBeInTheDocument();
  });

  it('scrolls to the target section', () => {
    const onScrollTo = vi.fn();
    renderBanner({ onScrollTo });
    fireEvent.click(screen.getByText('Explore New Sectors'));
    expect(onScrollTo).toHaveBeenCalledWith('holdings-section');
  });

  it('shows reassuring state', () => {
    renderBanner({ items: [] });
    expect(screen.getByText(/nothing urgent right now/i)).toBeInTheDocument();
  });

  it('prompts import when no holdings', () => {
    render(
      <MemoryRouter>
        <ActionBanner items={[]} hasHoldings={false} onScrollTo={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/import a portfolio to get personalised risk checks/i)).toBeInTheDocument();
  });
});
