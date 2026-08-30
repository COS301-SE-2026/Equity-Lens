import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TodayInsights from './TodayInsights';

// new
describe('TodayInsights', () => {
  it('renders each insight as its own line', () => {
    render(
      <TodayInsights
        insights={[
          { type: 'gain', text: 'Financials now represent 67% of your investments.', why: 'Sector exposure has grown.', action: null },
          { type: 'best-performer', text: 'Standard Bank is your largest holding at 69% of your portfolio.', why: 'Concentration has increased.', action: null },
        ]}
      />,
    );
    expect(screen.getByText(/financials now represent 67%/i)).toBeInTheDocument();
    expect(screen.getByText(/standard bank is your largest holding/i)).toBeInTheDocument();
  });

  it('renders nothing when no insights', () => {
    const { container } = render(<TodayInsights insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
