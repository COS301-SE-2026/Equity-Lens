import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import InfoTooltip from './InfoTooltip';

const LABEL = 'Market cap';
const TEXT = "The total value of a company's shares: share price x number of shares.";

describe('InfoTooltip', () => {
  it('renders label and accessible info button', () => {
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    expect(screen.getByText(LABEL)).toBeInTheDocument();

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('keeps tooltip hidden by default', () => {
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const tooltip = screen.getByRole('tooltip', { hidden: true });
    expect(tooltip).not.toBeVisible();
    expect(tooltip).toHaveTextContent(TEXT);
  });

  it('connects button to tooltip via aria-describedby', () => {
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    expect(button).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('toggles visibility on hover', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.hover(button);
    expect(tooltip).toBeVisible();

    await user.unhover(button);
    expect(tooltip).not.toBeVisible();
  });

  it('toggles visibility on focus/blur', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.tab();
    expect(button).toHaveFocus();
    expect(tooltip).toBeVisible();

    await user.tab();
    expect(button).not.toHaveFocus();
    expect(tooltip).not.toBeVisible();
  });

  it('opens on click and remains open when focused', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.click(button);
    expect(tooltip).toBeVisible();
  });

  it('closes when pressing Escape', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.hover(button);
    expect(tooltip).toBeVisible();

    await user.keyboard('{Escape}');
    expect(tooltip).not.toBeVisible();
  });

  it('ignores non-Escape key presses', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.hover(button);
    await user.keyboard('{Enter}');

    expect(tooltip).toBeVisible();
  });
  it('closes when pressing Escape after keyboard focus', async () => {
    const user = userEvent.setup();
    render(<InfoTooltip label={LABEL} text={TEXT} />);

    const button = screen.getByRole('button', { name: `What is ${LABEL}?` });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    await user.tab();
    expect(button).toHaveFocus();
    expect(tooltip).toBeVisible();

    await user.keyboard('{Escape}');
    expect(tooltip).not.toBeVisible();
  });
});