import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

import Sidebar from './Sidebar';

/** @param {{ open?: boolean, onClose?: () => void, path?: string }} [opts] */
const renderDrawer = ({ open = true, onClose = () => {}, path = '/dashboard' } = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar open={open} onClose={onClose} />
    </MemoryRouter>,
  );

const LABELS = ['Dashboard', 'Portfolio', 'Analytics', 'News', 'AI Assistant', 'Settings', 'Help'];

describe('Sidebar', () => {
  it('renders every nav item as a labelled link when open', () => {
    renderDrawer();
    for (const label of LABELS) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('renders nothing when closed', () => {
    renderDrawer({ open: false });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the current route with aria-current so it is not colour-only', () => {
    renderDrawer({ path: '/portfolio' });
    expect(screen.getByRole('link', { name: 'Portfolio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the scrim behind the drawer is clicked', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.click(screen.getByTestId('nav-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

});