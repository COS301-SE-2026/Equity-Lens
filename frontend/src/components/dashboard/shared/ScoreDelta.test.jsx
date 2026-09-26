import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import ScoreDelta from './ScoreDelta';

describe('ScoreDelta', () => {
  it('counts to the new score and settles on it', async () => {
    render(<ScoreDelta before={4.5} after={6.8} />);

    expect(screen.getAllByText('4.5')).toHaveLength(2);
    await waitFor(() => expect(screen.getByText('6.8')).toBeInTheDocument());
  });

  it('re-runs when a second simulation returns different numbers', async () => {
    const { rerender } = render(<ScoreDelta before={4.5} after={6.8} />);
    await waitFor(() => expect(screen.getByText('6.8')).toBeInTheDocument());

    rerender(<ScoreDelta before={6.8} after={5.1} />);
    await waitFor(() => expect(screen.getByText('5.1')).toBeInTheDocument());
  });

  it('colours an improvement positive and states the signed delta', () => {
    render(<ScoreDelta before={4.5} after={6.8} />);

    expect(screen.getByText('+2.3')).toHaveStyle({ color: 'var(--signal-positive)' });
  });

  it('colours a worse score negative', () => {
    render(<ScoreDelta before={6.8} after={4.5} />);

    expect(screen.getByText('-2.3')).toHaveStyle({ color: 'var(--signal-negative)' });
  });

  it('stays neutral when the simulation changes nothing', () => {
    render(<ScoreDelta before={6.0} after={6.0} />);

    expect(screen.getByText('0.0')).toHaveStyle({ color: 'var(--text-primary)' });
  });

  it('shows the change to more precision when asked, leaving the level figures alone', () => {
    render(<ScoreDelta before={4.3} after={4.44} deltaDigits={2} />);

    expect(screen.getByText('+0.14')).toBeInTheDocument();
  });

  it('reads as one sentence to a screen reader, not a stream of frames', () => {
    render(<ScoreDelta before={4.5} after={6.8} label="Portfolio Health" />);

    expect(screen.getByText('Portfolio Health 4.5 changes to 6.8')).toBeInTheDocument();
  });
});
