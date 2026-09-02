import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { zar } from '../../../utils/currency';

import Money from './Money';

const NBSP = String.fromCharCode(160);
/** @param {number} n */
const rand = (n) => zar(n).split(NBSP).join(' ');

describe('Money', () => {
  it('renders the given value unchanged - zar() output is not altered by the blur wrapper', () => {
    render(<Money>{zar(1234.5)}</Money>);
    expect(screen.getByText(rand(1234.5))).toBeInTheDocument();
  });

  it('adds the money-value class so the blur CSS rule can target it', () => {
    render(<Money>{zar(50)}</Money>);
    expect(screen.getByText(rand(50))).toHaveClass('money-value');
  });

  it('renders as a span by default', () => {
    render(<Money>{zar(50)}</Money>);
    expect(screen.getByText(rand(50)).tagName).toBe('SPAN');
  });

  it('renders as the given tag instead of nesting an extra wrapper', () => {
    render(
      <table>
        <tbody>
          <tr>
            <Money as="td">{zar(50)}</Money>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText(rand(50)).tagName).toBe('TD');
  });

  it('merges a passed className with money-value rather than replacing it', () => {
    render(<Money className="font-bold">{zar(50)}</Money>);
    const el = screen.getByText(zar(50));
    expect(el).toHaveClass('money-value');
    expect(el).toHaveClass('font-bold');
  });
});
