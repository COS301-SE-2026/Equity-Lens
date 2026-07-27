import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HelpTooltip from './HelpTooltip';

describe('HelpTooltip', () => {
  it('hides the explanation until hovered or focused', () => {
    render(<HelpTooltip text="Plain-language explanation" />);
    expect(screen.queryByText('Plain-language explanation')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByLabelText('What does this mean?').parentElement);
    expect(screen.getByText('Plain-language explanation')).toBeInTheDocument();
  });

  it('shows on keyboard focus, not just mouse hover', async () => {
    render(<HelpTooltip text="Keyboard accessible explanation" />);
    fireEvent.focus(screen.getByLabelText('What does this mean?'));
    expect(screen.getByText('Keyboard accessible explanation')).toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText('What does this mean?'));
    await waitFor(() => {
      expect(screen.queryByText('Keyboard accessible explanation')).not.toBeInTheDocument();
    });
  });
});
