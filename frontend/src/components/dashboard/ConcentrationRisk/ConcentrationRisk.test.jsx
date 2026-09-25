import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  simulateSectorInvestment,
  simulateSectorRebalance,
} from '../../../services/portfolioService';

import ConcentrationRisk from './ConcentrationRisk';
vi.mock('../../../context/ChatContext', () => ({ useChatContext: () => ({ openDock: vi.fn() }) }));

vi.mock('../../../services/portfolioService', () => ({
  simulateSectorInvestment: vi.fn(),
  simulateSectorRebalance: vi.fn(),
}));

const SECTORS = [
  { sector: 'Financial Services', value: 100000, percentage: 60 },
  { sector: 'Healthcare', value: 20000, percentage: 12 },
];

const SUBSCORE_DELTAS = [
  { key: 'sectorConcentration', label: 'Sector Concentration', before: 6.8, after: 7.1, weight: 0.4 },
  { key: 'singleStockRisk', label: 'Single-Stock Risk', before: 3.8, after: 3.9, weight: 0.35 },
  { key: 'portfolioBreadth', label: 'Portfolio Breadth', before: 2.9, after: 3.0, weight: 0.25 },
];

const INVEST_RESULT = {
  available: true,
  subscore_deltas: SUBSCORE_DELTAS,
  sector: 'Healthcare',
  illustrative_amount: 6000,
  current_weight_pct: 12,
  projected_weight_pct: 16.7,
  health_score_before: 5.0,
  health_score_after: 6.2,
  explanation: 'Spreads exposure toward Healthcare, currently your smallest sector.',
  thresholds: { concentration_low: 25, concentration_high: 45 },
  disclaimer: "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
};

const REBALANCE_RESULT = {
  available: true,
  subscore_deltas: SUBSCORE_DELTAS,
  from_sector: 'Financial Services',
  to_sector: 'Healthcare',
  value_shifted: 30000,
  from_sector_before_pct: 60,
  to_sector_before_pct: 12,
  health_score_before: 4.5,
  health_score_after: 6.8,
  explanation: 'Shifts weight out of Financial Services and into Healthcare.',
  thresholds: { concentration_low: 25, concentration_high: 45 },
  disclaimer: "Analysis only, not a trade instruction - EquityLens doesn't execute trades.",
};

const renderCard = (sectors = SECTORS) =>
  render(
    <MemoryRouter>
      <ConcentrationRisk sectors={sectors} />
    </MemoryRouter>,
  );

const rebalanceButton = () => screen.getByText('Simulate shifting Financial Services into Healthcare');

describe('ConcentrationRisk', () => {
  beforeEach(() => {
    vi.mocked(simulateSectorInvestment).mockReset();
    vi.mocked(simulateSectorRebalance).mockReset();
  });

  it('tells the user plainly when there are too few sectors to compare', () => {
    renderCard([{ sector: 'Technology', value: 100000, percentage: 100 }]);

    expect(screen.getByText(/need at least two sectors/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Add to a sector')).not.toBeInTheDocument();
  });

  it('no longer renders the removed per-holding trim simulator', () => {
    renderCard();

    expect(screen.queryByText('Show trim simulation')).not.toBeInTheDocument();
    expect(screen.queryByText('Simulate trim to 25%')).not.toBeInTheDocument();
  });

  describe('both tools are visible without opening anything', () => {
    it('shows no show/hide control at all', () => {
      renderCard();

      expect(screen.queryByText(/sector moves/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Rebalance most concentrated sector')).not.toBeInTheDocument();
    });

    it('renders both labelled sections and both controls straight away', () => {
      renderCard();

      expect(screen.getByText('Add to a sector')).toBeInTheDocument();
      expect(screen.getByText('Rebalance your most concentrated sector')).toBeInTheDocument();
      expect(screen.getByLabelText('Add to a sector')).toBeInTheDocument();
      expect(screen.getByText('Simulate investing in Healthcare')).toBeInTheDocument();
      expect(rebalanceButton()).toBeInTheDocument();
    });

    it('makes the rebalance the card s one primary action', () => {
      renderCard();

      expect(rebalanceButton()).toHaveStyle({ background: 'var(--accent-primary)' });
      expect(screen.getByText('Simulate investing in Healthcare').closest('button')).not.toHaveStyle(
        { background: 'var(--accent-primary)' },
      );
    });
  });

  describe('sector picker is a dropdown, not pills (B4)', () => {
    it('renders one option per sector, with no percentage in the label', () => {
      renderCard();
      fireEvent.click(screen.getByLabelText('Add to a sector'));
      const listbox = screen.getByRole('listbox');

      const options = within(listbox).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual(['Healthcare', 'Financial Services']);
      expect(listbox.textContent).not.toMatch(/%/);
    });

    it('is closed by default and names the current sector on the trigger', () => {
      renderCard();

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Add to a sector')).toHaveTextContent('Healthcare');
    });

    it('pre-selects the lowest-weight sector', () => {
      renderCard();

      expect(screen.getByLabelText('Add to a sector')).toHaveTextContent('Healthcare');
      expect(screen.getByText('Simulate investing in Healthcare')).toBeInTheDocument();
    });

    it('changing the selection drives the simulate call', () => {
      vi.mocked(simulateSectorInvestment).mockResolvedValue({
        ...INVEST_RESULT,
        sector: 'Financial Services',
      });
      renderCard();

      fireEvent.click(screen.getByLabelText('Add to a sector'));
      fireEvent.mouseDown(within(screen.getByRole('listbox')).getByText('Financial Services'));
      fireEvent.click(screen.getByText('Simulate investing in Financial Services'));

      expect(simulateSectorInvestment).toHaveBeenCalledWith('Financial Services');
    });
  });

  describe('simulation results', () => {
    it('renders the invest result: score delta, the illustrative sentence and the disclaimer', async () => {
      vi.mocked(simulateSectorInvestment).mockResolvedValue(INVEST_RESULT);
      renderCard();
      fireEvent.click(screen.getByText('Simulate investing in Healthcare'));

      expect(simulateSectorInvestment).toHaveBeenCalledWith('Healthcare');
      await waitFor(() => {
        expect(screen.getByText('Portfolio Health 5.0 changes to 6.2')).toBeInTheDocument();
        expect(screen.getByText('+1.20')).toBeInTheDocument();
      });
      expect(screen.getByText(/Illustrative .* added to your/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Analysis only, not a trade instruction - EquityLens doesn't execute trades\./,
        ),
      ).toBeInTheDocument();
    });

    it('shows the result full-width beneath the controls, not floating in a self-centred column', async () => {
      vi.mocked(simulateSectorInvestment).mockResolvedValue(INVEST_RESULT);
      const { container } = renderCard();
      fireEvent.click(screen.getByText('Simulate investing in Healthcare'));

      await screen.findByText('Sector Concentration');
      expect(container.querySelector('[class*="self-center"]')).toBeNull();
      expect(container.querySelector('[class*="lg:grid-cols-2"]')).toBeNull();
    });

    it('breaks the composite into the three factors that produced it', async () => {
      vi.mocked(simulateSectorInvestment).mockResolvedValue(INVEST_RESULT);
      renderCard();
      fireEvent.click(screen.getByText('Simulate investing in Healthcare'));

      expect(await screen.findByText('Sector Concentration')).toBeInTheDocument();
      expect(screen.getByText('6.8 \u2192 7.1')).toBeInTheDocument();
      expect(screen.getByText('+0.12')).toBeInTheDocument();
      expect(
        screen.getByText('Sector Concentration, 6.8 before, 7.1 after, plus 0.12 to overall score'),
      ).toBeInTheDocument();
      expect(screen.getByText(/weighted contribution to the overall score/)).toBeInTheDocument();
      expect(screen.getByText('Portfolio Breadth')).toBeInTheDocument();
    });

    it('rebalance calls simulateSectorRebalance with no args and renders its score delta', async () => {
      vi.mocked(simulateSectorRebalance).mockResolvedValue(REBALANCE_RESULT);
      renderCard();
      fireEvent.click(rebalanceButton());

      expect(simulateSectorRebalance).toHaveBeenCalledWith();
      await waitFor(() => {
        expect(screen.getByText('Portfolio Health 4.5 changes to 6.8')).toBeInTheDocument();
        expect(screen.getByText('+2.3')).toBeInTheDocument();
      });
    });

    it('shows the causal chain and the sectors either side of the move', async () => {
      vi.mocked(simulateSectorRebalance).mockResolvedValue(REBALANCE_RESULT);
      renderCard();
      fireEvent.click(rebalanceButton());

      expect(
        await screen.findByText(/out of Financial Services, into Healthcare/),
      ).toBeInTheDocument();
      expect(screen.getByText(REBALANCE_RESULT.explanation)).toBeInTheDocument();
      expect(screen.getByText(/Sector Concentration is the subscore that moves/)).toBeInTheDocument();
      expect(screen.getByText('Financial Services (out)')).toBeInTheDocument();
      expect(screen.getByText('Healthcare (in)')).toBeInTheDocument();
    });

    it('quotes the threshold the backend actually refused on, not a hardcoded 45', async () => {
      vi.mocked(simulateSectorRebalance).mockResolvedValue({
        available: false,
        reason: 'no_sector_overconcentrated',
        thresholds: { concentration_low: 35, concentration_high: 60 },
      });
      renderCard();
      fireEvent.click(rebalanceButton());

      expect(
        await screen.findByText(/No sector is over the 60% concentration threshold/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/45%/)).not.toBeInTheDocument();
    });
  });

  describe('when the health yardstick changes underneath a result', () => {
    it('drops the result and says why, without running anything again', async () => {
      vi.mocked(simulateSectorInvestment).mockResolvedValue(INVEST_RESULT);
      const { rerender } = render(
        <MemoryRouter>
          <ConcentrationRisk sectors={SECTORS} configVersion={0} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByText('Simulate investing in Healthcare'));
      expect(await screen.findByText('Portfolio Health 5.0 changes to 6.2')).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <ConcentrationRisk sectors={SECTORS} configVersion={1} />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.queryByText('Portfolio Health 5.0 changes to 6.2')).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Run a simulation again to see it against the new score/)).toBeInTheDocument();
      expect(vi.mocked(simulateSectorInvestment)).toHaveBeenCalledTimes(1);
    });
  });

  it('offers the EquityLens Insight trigger only while the card is open', () => {
    renderCard();
    const trigger = () => screen.queryByRole('button', { name: 'Ask AI about sector concentration' });

    expect(trigger()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse concentration and rebalancing/i }));
    expect(trigger()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /expand concentration and rebalancing/i }));
    expect(trigger()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse concentration and rebalancing/i }));
    expect(trigger()).toBeNull();
  });
});
