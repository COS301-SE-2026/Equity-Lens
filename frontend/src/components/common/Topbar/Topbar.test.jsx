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

vi.mock('../../../hooks/useBlur', () => ({
  default: () => ({
    blurMoney: mockBlurMoney,
    toggleBlurMoney: mockToggleBlurMoneyFake,
  }),
}));

describe('Topbar', () => {
  it('renders topbar text', () => {
    render(<Topbar onMenuClick={() => {}} />);

    expect(screen.getByText(/Sign out/i)).toBeInTheDocument();
    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.queryByText(/Abdul/i)).not.toBeInTheDocument();
  });

  it('calls theme toggle', () => {
    render(<Topbar onMenuClick={() => {}} />);

    fireEvent.click(screen.getByLabelText(/switch to light mode/i));

    expect(mockToggleThemeFake).toHaveBeenCalled();
  });

  it('calls logout', () => {
    render(<Topbar onMenuClick={() => {}} />);

    fireEvent.click(screen.getByText(/sign out/i));

    expect(mockLogoutFake).toHaveBeenCalled();
  });

  describe('blur toggle', () => {
    it('is off by default', () => {
      mockBlurMoney = false;
      render(<Topbar onMenuClick={() => {}} />);

      const toggle = screen.getByLabelText('Blur monetary values');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('reflects blurMoney=true', () => {
      mockBlurMoney = true;
      render(<Topbar onMenuClick={() => {}} />);

      const toggle = screen.getByLabelText('Show monetary values');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls toggleBlurMoney', () => {
      mockBlurMoney = false;
      render(<Topbar onMenuClick={() => {}} />);

      fireEvent.click(screen.getByLabelText('Blur monetary values'));

      expect(mockToggleBlurMoneyFake).toHaveBeenCalled();});

    it('blur is a security measure', () => {
      mockBlurMoney = false;
      render(<Topbar onMenuClick={() => {}} />);
      const toggle = screen.getByLabelText('Blur monetary values');
      expect(toggle.title.toLowerCase()).toContain('selectable');
      expect(toggle.title.toLowerCase()).not.toContain('secure');});});

  describe('hamburger nav trigger', () => {
    it("marks  button data-nav-trigger", () => {
      render(<Topbar onMenuClick={() => {}} sidebarOpen={false} />);
      const trigger = screen.getByLabelText('Open navigation menu');
      expect(trigger).toHaveAttribute('data-nav-trigger', 'true');});

    it('shows the closed state', () => {
      render(<Topbar onMenuClick={() => {}} sidebarOpen={false} />);
      const trigger = screen.getByLabelText('Open navigation menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');});

    it('shows the open state', () => {
      render(<Topbar onMenuClick={() => {}} sidebarOpen={true} />);
      const trigger = screen.getByLabelText('Close navigation menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');});

    it('calls onMenuClick', () => {
      const onMenuClick = vi.fn();
      render(<Topbar onMenuClick={onMenuClick} sidebarOpen={false} />);
      fireEvent.click(screen.getByLabelText('Open navigation menu'));
      expect(onMenuClick).toHaveBeenCalled();
    });});
});
