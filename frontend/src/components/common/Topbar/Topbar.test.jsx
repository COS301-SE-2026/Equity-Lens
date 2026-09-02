import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from './Topbar';

const mockLogoutFake = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  default: () => ({
    user: { full_name: 'Abdul Sabah' },
    logout: mockLogoutFake,
  }),
}));

describe('Topbar', () => {
  it('renders topbar text', () => {
    render(<Topbar onMenuClick={() => {}} />);

    // market data strip is commented out pending demo 3, so not asserted here
    expect(screen.getByText(/Abdul/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign out/i)).toBeInTheDocument();
  });

  it('calls logout', () => {
    render(<Topbar onMenuClick={() => {}} />);

    fireEvent.click(screen.getByText(/sign out/i));

    expect(mockLogoutFake).toHaveBeenCalled();
  });
});
