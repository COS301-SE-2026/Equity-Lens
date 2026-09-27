import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExposureChart } from './ExposureChart';

const MOCK_UNIVERSE = [
  { ticker: 'SBK', name: 'Standard Bank', sector: 'Financial Services', market_cap: 496.25, local_float_pct: 79.79, dividend_yield: 5.89 },
  { ticker: 'SLM', name: 'Sanlam', sector: 'Financial Services', market_cap: 167, local_float_pct: 80, dividend_yield: 6 },
  { ticker: 'NPN', name: 'Naspers', sector: 'Consumer Cyclical', market_cap: 532.53, local_float_pct: 100, dividend_yield: 0.68 },
  { ticker: 'MTN', name: 'MTN Group', sector: 'Communication Services', market_cap: 355.01, local_float_pct: 73.99, dividend_yield: 2.53 },
  { ticker: 'AGL', name: 'Anglo American', sector: 'Basic Materials', market_cap: 942.51, local_float_pct: 88.83, dividend_yield: 0.71 },
];

const MOCK_PORTFOLIO = [
  { ...MOCK_UNIVERSE[0], highlighted: true },
  { ...MOCK_UNIVERSE[3], highlighted: true },
];

const MOCK_RECOMMENDED = [
  {
    ticker: 'SLM',
    similar_to: 'SBK',
    distance: 0.79,
    closeness: 0.65,
    description: '65% match to SBK: same sector (Financial Services), similar free float and dividend yield',
  },
];

const setup = (overrideProps = {}) => {
  const props = {
    universe: MOCK_UNIVERSE,
    portfolio: MOCK_PORTFOLIO,
    recommended: MOCK_RECOMMENDED,
    ...overrideProps,
  };

  const utils = render(<ExposureChart {...props} />);
  
  /** @param {string} ticker */
  const getStockBubble = (ticker) => {
    const stockCircles = Array.from(utils.container.querySelectorAll('circle.stock'));
    const bubble = stockCircles.find((circle) => {
      const titleText = circle.querySelector('title')?.textContent || '';
      return titleText.startsWith(`${ticker}:`);
    });
    if (!bubble) throw new Error(`no bubble for ${ticker}`);
    return bubble;
  };

  return {
    ...utils,
    getStockBubble,
  };
};

describe('ExposureChart', () => {
  describe('Rendering & Structure', () => {
    it('mounts chart with accessible label', () => {
      setup();
      expect(screen.getByLabelText(/similarity map of jse stocks/i)).toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      const { container } = render(<ExposureChart />);
      expect(container.querySelectorAll('circle.stock')).toHaveLength(0);
    });

    it('renders all stock nodes including off-universe holdings', () => {
      const extraHolding = { ticker: 'XYZ', sector: 'Industrials', market_cap: 20, local_float_pct: 60, dividend_yield: 3 };
      const { container } = setup({ portfolio: [...MOCK_PORTFOLIO, extraHolding] });
      
      expect(container.querySelectorAll('circle.stock')).toHaveLength(MOCK_UNIVERSE.length + 1);
    });

    it('displays sector legend filters', () => {
      setup();
      const sectors = ['Financial Services', 'Consumer Cyclical', 'Communication Services', 'Basic Materials'];
      sectors.forEach((sector) => {
        expect(screen.getByText(sector)).toBeInTheDocument();
      });
    });

    it('renders recommendation connectors', () => {
      const { container } = setup();
      expect(container.querySelectorAll('line[marker-end]')).toHaveLength(MOCK_RECOMMENDED.length);
    });
  });

  describe('User Interactions', () => {
    it('renders trigger buttons for active portfolio holdings', () => {
      setup();
      expect(screen.getByRole('button', { name: 'SBK' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'MTN' })).toBeInTheDocument();
    });

    it('toggles recommendation details when pressing holding control', () => {
      setup();
      const btn = screen.getByRole('button', { name: 'SBK' });

      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('SBK → SLM (65%)')).toBeInTheDocument();

      fireEvent.click(btn);
      expect(btn).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByText('SBK → SLM (65%)')).not.toBeInTheDocument();
    });

    it('handles holdings with no match suggestions', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'MTN' }));
      expect(screen.getByText('MTN: no close matches in the JSE universe')).toBeInTheDocument();
    });

    it('links target recommendation bubble selection back to holding', () => {
      const { getStockBubble } = setup();
      fireEvent.click(getStockBubble('SLM'));
      
      expect(screen.getByText('SBK → SLM (65%)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'SBK' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('clears selection when clicking neutral canvas nodes', () => {
      const { getStockBubble } = setup();
      
      fireEvent.click(screen.getByRole('button', { name: 'SBK' }));
      fireEvent.click(getStockBubble('AGL'));

      expect(screen.queryByText('SBK → SLM (65%)')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'SBK' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('displays target hover details in tooltip context', () => {
      const { getStockBubble } = setup();
      fireEvent.mouseMove(getStockBubble('SLM'));
      expect(screen.getByText('65% match to SBK')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation & Accessibility', () => {
    it('restricts focus indexing exclusively to relevant nodes', () => {
      const { getStockBubble } = setup();
      
      expect(getStockBubble('SBK')).toHaveAttribute('tabindex', '0');
      expect(getStockBubble('SLM')).toHaveAttribute('tabindex', '0');
      expect(getStockBubble('AGL')).not.toHaveAttribute('tabindex');
    });

    it('dismisses active state on Escape keypress', () => {
      const { getStockBubble } = setup();
      const sbkNode = getStockBubble('SBK');

      fireEvent.keyDown(sbkNode, { key: 'Enter' });
      expect(screen.getByText('SBK → SLM (65%)')).toBeInTheDocument();

      fireEvent.keyDown(sbkNode, { key: 'Escape' });
      expect(screen.queryByText('SBK → SLM (65%)')).not.toBeInTheDocument();
    });
  });
});