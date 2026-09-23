import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import CardErrorBoundary from './CardErrorBoundary';

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const Boom = () => {
  throw new Error('this card is broken');
};

/** @param {React.ReactNode} children */
const renderBoundary = (children) =>
  render(
    <MemoryRouter>
      <CardErrorBoundary label="Portfolio Health">{children}</CardErrorBoundary>
    </MemoryRouter>,
  );

describe('CardErrorBoundary', () => {
  it('renders its child when nothing throws', () => {
    renderBoundary(<div>the real card</div>);

    expect(screen.getByText('the real card')).toBeInTheDocument();
  });

  it('replaces only the failing card, keeping its label', () => {
    renderBoundary(<Boom />);

    expect(screen.getByText('Portfolio Health')).toBeInTheDocument();
    expect(screen.getByText('This section could not be displayed.')).toBeInTheDocument();
  });

  it('clears the error when Try again is pressed', () => {
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error('first render only');
      return <div>recovered</div>;
    };

    renderBoundary(<Flaky />);
    expect(screen.getByText('This section could not be displayed.')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try again'));

    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
