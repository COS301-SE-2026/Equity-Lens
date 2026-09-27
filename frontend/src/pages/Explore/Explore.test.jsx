import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import Explore from './Explore';
import { ExposureChart } from '../../components/charts/ExposureChart/ExposureChart';

vi.mock('../../components/charts/ExposureChart/ExposureChart', () => ({
  ExposureChart: vi.fn(() => <div data-testid="exposure-chart" />),
}));

vi.mock('../../components/common/LoadingSpinner/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

vi.mock('../../utils/constants', () => ({
  API_BASE_URL: 'http://api.test',
}));

const MOCK_ELIGIBLE_RESPONSE = {
  eligible: true,
  portfolio: [
    {
      ticker: 'SBK',
      name: 'Standard Bank',
      sector: 'Financial Services',
      market_cap: 496.25,
      local_float_pct: 79.79,
      dividend_yield: 5.89,
      highlighted: true,
    },
  ],
  universe: [
    {
      ticker: 'SBK',
      name: 'Standard Bank',
      sector: 'Financial Services',
      market_cap: 496.25,
      local_float_pct: 79.79,
      dividend_yield: 5.89,
    },
    {
      ticker: 'SLM',
      name: 'Sanlam',
      sector: 'Financial Services',
      market_cap: 167,
      local_float_pct: 80,
      dividend_yield: 6,
    },
  ],
  recommended: [
    {
      ticker: 'SLM',
      similar_to: 'SBK',
      distance: 0.79,
      closeness: 0.65,
      description:
        '65% match to SBK: same sector (Financial Services), similar free float and dividend yield',
    },
  ],
  excluded: [],
};

/**
 * @param {object} response
 * @param {{ ok?: boolean, status?: number }} [options]
 */
const setupFetchMock = (response, options = {}) => {
  const { ok = true, status = 200 } = options;
  const mockFn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
  });
  vi.stubGlobal('fetch', mockFn);
  return mockFn;
};

const setupPendingFetch = () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
};

describe('Explore Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Page Layout & Initial State', () => {
    it('unmounts cleanly while the request is still in flight', () => {
      setupPendingFetch();
      const { unmount } = render(<Explore />);

      expect(() => unmount()).not.toThrow();
    });

    it('renders the core page heading', () => {
      setupPendingFetch();
      render(<Explore />);

      expect(screen.getByRole('heading', { name: /more of what you like/i })).toBeInTheDocument();
    });

    it('displays loading spinner while request is pending', () => {
      setupPendingFetch();
      render(<Explore />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Data Fetching & Authorization', () => {
    it('includes Cognito authorization token in API request', async () => {
      localStorage.setItem('CognitoIdentityServiceProvider.client1.LastAuthUser', 'user1');
      localStorage.setItem('CognitoIdentityServiceProvider.client1.user1.accessToken', 'token-123');
      const fetchMock = setupFetchMock(MOCK_ELIGIBLE_RESPONSE);

      render(<Explore />);

      await screen.findByTestId('exposure-chart');

      expect(fetchMock).toHaveBeenCalledWith('http://api.test/explore/recommendations?k=9', {
        headers: { Authorization: 'Bearer token-123' },
      });
    });
  });

  describe('Successful Data Rendering', () => {
    it('renders recommendation cards with company names and descriptions', async () => {
      setupFetchMock(MOCK_ELIGIBLE_RESPONSE);
      render(<Explore />);

      expect(await screen.findByText('Sanlam')).toBeInTheDocument();
      expect(screen.getByText('SLM')).toBeInTheDocument();
      expect(screen.getByText(MOCK_ELIGIBLE_RESPONSE.recommended[0].description)).toBeInTheDocument();
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('falls back to ticker symbol when full company name is missing from universe', async () => {
      setupFetchMock({
        ...MOCK_ELIGIBLE_RESPONSE,
        recommended: [{ ...MOCK_ELIGIBLE_RESPONSE.recommended[0], ticker: 'ABC' }],
      });

      render(<Explore />);

      await screen.findByTestId('exposure-chart');
      expect(screen.getAllByText('ABC')).toHaveLength(2);
    });

    it('passes parsed portfolio, universe, and recommendations props to chart', async () => {
      setupFetchMock(MOCK_ELIGIBLE_RESPONSE);
      render(<Explore />);

      await screen.findByTestId('exposure-chart');

      const chartProps = vi.mocked(ExposureChart).mock.lastCall?.[0];
      expect(chartProps?.portfolio).toEqual(MOCK_ELIGIBLE_RESPONSE.portfolio);
      expect(chartProps?.universe).toEqual(MOCK_ELIGIBLE_RESPONSE.universe);
      expect(chartProps?.recommended).toEqual(MOCK_ELIGIBLE_RESPONSE.recommended);
    });

    it('lists holdings excluded from universe coverage', async () => {
      setupFetchMock({ ...MOCK_ELIGIBLE_RESPONSE, excluded: ['AAPL', 'STX40'] });
      render(<Explore />);

      expect(
        await screen.findByText('Not included: AAPL, STX40. Explore only covers JSE-listed shares.'),
      ).toBeInTheDocument();
    });
  });

  describe('Empty & Ineligible States', () => {
    it('displays empty state notice when portfolio contains no holdings', async () => {
      setupFetchMock({ eligible: false, reason: 'no_holdings', excluded: [] });
      render(<Explore />);

      expect(await screen.findByText("Explore isn't available for this portfolio")).toBeInTheDocument();
      expect(screen.getByText('Add holdings to your portfolio to see similar JSE shares.')).toBeInTheDocument();
      expect(screen.queryByTestId('exposure-chart')).not.toBeInTheDocument();
    });

    it('displays notice when portfolio contains no JSE-listed shares', async () => {
      setupFetchMock({ eligible: false, reason: 'no_jse_holdings', excluded: ['AAPL', 'STX40'] });
      render(<Explore />);

      expect(await screen.findByText(/doesn't contain any JSE-listed shares yet/i)).toBeInTheDocument();
      expect(screen.getByText('Not supported: AAPL, STX40')).toBeInTheDocument();
      expect(screen.queryByTestId('exposure-chart')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('presents custom alert message when service unavailable (503)', async () => {
      setupFetchMock(
        { detail: 'Market data temporarily unavailable' },
        { ok: false, status: 503 },
      );
      render(<Explore />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/market data is temporarily unavailable/i);
    });

    it('displays status code for generic server error responses', async () => {
      setupFetchMock({}, { ok: false, status: 500 });
      render(<Explore />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('HTTP error 500');
    });

    it('handles network failure exceptions gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
      render(<Explore />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Network down');
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });
});