import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { formatShortCurrency } from '../../../utils/formatters';

import MoneyAxisTick from './MoneyAxisTick';

describe('MoneyAxisTick', () => {
  it('renders the formatted value with the money-value class on an SVG text element', () => {
    render(
      <svg>
        <MoneyAxisTick x={0} y={0} payload={{ value: 125000 }} />
      </svg>,
    );
    const label = screen.getByText(formatShortCurrency(125000));
    expect(label.tagName).toBe('text');
    expect(label).toHaveClass('money-value');
  });

  it('passes through recharts positioning props instead of hardcoding them', () => {
    render(
      <svg>
        <MoneyAxisTick x={42} y={7} textAnchor="end" payload={{ value: 500 }} />
      </svg>,
    );
    const label = screen.getByText(formatShortCurrency(500));
    expect(label.getAttribute('x')).toBe('42');
    expect(label.getAttribute('y')).toBe('7');
    expect(label.getAttribute('text-anchor')).toBe('end');
  });
});
