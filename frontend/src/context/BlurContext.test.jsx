import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import useBlur from '../hooks/useBlur';
import { BLUR_MONEY_KEY } from '../utils/constants';

import { BlurProvider } from './BlurContext';

const ToggleButton = () => {
  const { blurMoney, toggleBlurMoney } = useBlur();
  return <button onClick={toggleBlurMoney}>{blurMoney ? 'blurred' : 'visible'}</button>;
};

const Harness = () => (
  <BlurProvider>
    <ToggleButton />
  </BlurProvider>
);

describe('BlurContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('money-blurred');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('money-blurred');
  });

  it('defaults to not blurred', () => {
    render(<Harness />);
    expect(document.documentElement.classList.contains('money-blurred')).toBe(false);
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('toggling adds the money-blurred class to <html> and persists to localStorage', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('visible'));

    expect(document.documentElement.classList.contains('money-blurred')).toBe(true);
    expect(screen.getByText('blurred')).toBeInTheDocument();
    expect(localStorage.getItem(BLUR_MONEY_KEY)).toBe('true');
  });

  it('persists the blurred state across a remount', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByText('visible'));
    expect(localStorage.getItem(BLUR_MONEY_KEY)).toBe('true');

    unmount();
    document.documentElement.classList.remove('money-blurred'); // simulate a fresh page load

    render(<Harness />);
    expect(screen.getByText('blurred')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('money-blurred')).toBe(true);
  });
});
