import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TodayInsights from './TodayInsights';

describe('TodayInsights', () => {
  it('renders each insight as its own line', () => {
    render(
      <TodayInsights
        insights={[
          { type: 'gain', text: 'NPN is today\'s biggest gainer, up 2.5% (+R 1 125).', why: '2.5% is within typical movement.', action: null },
          { type: 'driver', text: "77% of today's gain came from NPN.", why: "Ranked by each holding's Rand contribution.", action: null },
        ]}
      />,
    );
    expect(screen.getByText(/npn is today's biggest gainer/i)).toBeInTheDocument();
    expect(screen.getByText(/77% of today's gain came from npn/i)).toBeInTheDocument();
  });

  it('renders nothing when no insights', () => {
    const { container } = render(<TodayInsights insights={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
