import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';

import Modal from './Modal';

/** @param {{ onClose?: () => void }} props */
const Harness = ({ onClose }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open settings
      </button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();}}
        title="Scoring settings">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>
    </>
  );};

describe('Modal', () => {
  it('renders nothing until it is opened', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Scoring settings">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()});

  it('announces itself as a modal dialog named by its title', () => {
    render(
      <Modal open onClose={vi.fn()} title="Scoring settings">
        <p>body</p>
      </Modal>,);
    const dialog = screen.getByRole('dialog', { name: 'Scoring settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('escapes out and hands focus back to whatever opened it', async () => {
    render(<Harness />);
    const trigger = screen.getByText('Open settings');
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(trigger).toHaveFocus();
  });

  it('closes on the backdrop but not on the panel itself', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Scoring settings">
        <p>body</p>
      </Modal>,);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = document.querySelector('[role="presentation"]');
    if (!backdrop) throw new Error('expected a backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the panel in both directions', () => {
    render(
      <Modal open onClose={vi.fn()} title="Scoring settings">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>,
    );
    const close = screen.getByLabelText('Close');
    const last = screen.getByText('Last');

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('restores body scrolling even if it unmounts without closing', () => {
    const { unmount } = render(
      <Modal open onClose={vi.fn()} title="Scoring settings">
        <p>body</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });});