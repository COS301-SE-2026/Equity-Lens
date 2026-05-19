import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from './Topbar';

const mockLogoutFake = vi.fn();
const mockToggleThemeFake = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  default: () => ({
    user: { full_name: 'Abdul Sabah' },
    logout: mockLogoutFake,
  }),
}));

vi.mock('../../../context/ThemeContext.jsx', () => ({
  useThemeContext: () => ({
    theme: 'dark',
    toggleTheme: mockToggleThemeFake,
  }),
}));

describe('Topbar', () => {
  it('renders topbar text', () => {
    render(<Topbar onMenuClick={() => {}} />);

    expect(screen.getByText(/JSE·ALSI/i)).toBeInTheDocument();
    expect(screen.getByText(/Abdul/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign out/i)).toBeInTheDocument();
  });

  it('calls theme toggle', () => {
    render(<Topbar onMenuClick={() => {}} />);

    fireEvent.click(screen.getByLabelText(/toggle theme/i));

    expect(mockToggleThemeFake).toHaveBeenCalled();
  });

  it('calls logout', () => {
    render(<Topbar onMenuClick={() => {}} />);

    fireEvent.click(screen.getByText(/sign out/i));

    expect(mockLogoutFake).toHaveBeenCalled();
  });
});
