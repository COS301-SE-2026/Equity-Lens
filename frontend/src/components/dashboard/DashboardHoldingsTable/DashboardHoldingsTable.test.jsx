import {
  render,
  screen,
  fireEvent,
  within,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import DashboardHoldingsTable from './DashboardHoldingsTable';
vi.mock('../../../context/ChatContext', () => ({ useChatContext: () => ({ openDock: vi.fn() }) }));

const HOLDINGS = [
  { ticker: 'NPN', name: 'Naspers', sector: 'Technology', value: 6767, current_price: 67, daily_change_pct: 6.7 },
  { ticker: 'SBK', name: 'Standard Bank', sector: 'Financials', value: 4200, current_price: 420, daily_change_pct: 4.2 },
];

const SECTOR_DATA = [
  { name: 'Technology', value: 61.7 },
  { name: 'Financials', value: 38.3 },
];

/**
 * @param {any[]} holdings
 * @param {{ name: string, value: number }[]} [sectorData]
 * @param {{ available: boolean, label?: string, sectors: { sector: string, weight_pct: number, daily_change_pct: number, tickers: string[], summary: string }[] } | null} [marketContext]
 * @param {{ low: number, high: number }} [thresholds]
 */
const renderTable = (holdings, sectorData = SECTOR_DATA, marketContext = null, thresholds = undefined) =>
  render(
    <MemoryRouter>
      <DashboardHoldingsTable
        holdings={holdings}
        sectorData={sectorData}
        marketContext={marketContext}
        thresholds={thresholds}
      />
    </MemoryRouter>,
  );

describe('DashboardHoldingsTable', () => {
  it('folds away from its header, the same way the concentration card does', async () => {
    renderTable(HOLDINGS);
    const toggle = screen.getByRole('button', { name: /collapse all positions/i });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);

    const collapsed = screen.getByRole('button', { name: /expand all positions/i });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('All Positions')).toBeInTheDocument();
  });

  it('renders one row per holding', async () => {
    renderTable(HOLDINGS);
    expect(screen.getByText('NPN')).toBeInTheDocument();
    expect(screen.getByText('SBK')).toBeInTheDocument();
    expect(await screen.findByText('Technology')).toBeInTheDocument();
    expect(await screen.findByText('Financials')).toBeInTheDocument();
  });

  it("shows each holding's today move and concentration weight", () => {
    renderTable(HOLDINGS);
    expect(screen.getByText(/\+6\.70%/)).toBeInTheDocument();
    expect(screen.getByText(/\+4\.20%/)).toBeInTheDocument();
  });

  it('marks a foreign holding\'s move as a local-currency move', () => {
    renderTable([
      { ticker: 'AAPL', name: 'Apple Inc', sector: 'Technology', value: 8510, current_price: 4255,
        daily_change_pct: 1.5, daily_change_is_local: true, quote_currency: 'USD', fx_rate: 18.5 },
    ]);

    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByTitle('Move shown in USD, value converted to rand at R18.50.')).toBeInTheDocument();
  });

  it('leaves a JSE holding unmarked', () => {
    renderTable(HOLDINGS);
    expect(screen.queryByText('USD')).not.toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderTable([], []);
    expect(screen.getByText(/upload holdings to see them here/i)).toBeInTheDocument();
  });

  it('carries an Ask AI trigger seeded with the real top holding', () => {
    renderTable(HOLDINGS);
    expect(screen.getByRole('button', { name: 'Ask AI about your positions' })).toBeInTheDocument();
  });

  it('has no Ask AI trigger with no holdings or sectors to ask about', () => {
    renderTable([], []);
    expect(screen.queryByRole('button', { name: 'Ask AI about your positions' })).not.toBeInTheDocument();
  });

  it('shows per-sector market context notes when available', () => {
    renderTable(HOLDINGS, SECTOR_DATA, {
      available: true,
      label: 'Illustrative market context',
      sectors: [
        { sector: 'Technology', weight_pct: 61.7, daily_change_pct: 6.7, tickers: ['NPN'], summary: 'Your Technology holdings (NPN) are up 6.7% today.' },
      ],
    });
    expect(screen.getByText(/Illustrative market context/)).toBeInTheDocument();
    expect(screen.getByText(/Your Technology holdings \(NPN\) are up 6\.7% today\./)).toBeInTheDocument();
  });

  it('shows no market context section when it is unavailable', () => {
    renderTable(HOLDINGS, SECTOR_DATA, { available: false, sectors: [] });
    expect(screen.queryByText(/Illustrative market context/)).not.toBeInTheDocument();
  });

  it('shows no market context section when none was passed at all', () => {
    renderTable(HOLDINGS);
    expect(screen.queryByText(/Illustrative market context/)).not.toBeInTheDocument();
  });

  describe('merged sector allocation column (backlog 4)', () => {
    it('carries both scroll anchor ids that used to belong to two separate cards', () => {
      const { container } = renderTable(HOLDINGS);
      expect(container.querySelector('#holdings-table')).toBeInTheDocument();
      expect(container.querySelector('#sector-allocation')).toBeInTheDocument();
    });

    it('filters the holdings list to the clicked sector, and clears back to all holdings', () => {
      renderTable(HOLDINGS);
      fireEvent.click(screen.getByRole('button', { name: /Technology/i }));

      expect(screen.getByText('NPN')).toBeInTheDocument();
      expect(screen.queryByText('SBK')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText(/Clear/));
      expect(screen.getByText('NPN')).toBeInTheDocument();
      expect(screen.getByText('SBK')).toBeInTheDocument();
    });

    it('keeps concentration weight based on the whole book, not just the filtered sector', () => {
      renderTable(HOLDINGS);
      const before = screen.getByTitle(/High concentration - \d+\.\d% of your book/i).title;
      fireEvent.click(screen.getByRole('button', { name: /Technology/i }));
      const after = screen.getByTitle(/High concentration - \d+\.\d% of your book/i).title;
      expect(after).toBe(before);
    });

    it('shows one Clear control, not two - the pie chart column has none of its own (backlog 3 item 2)', () => {
      renderTable(HOLDINGS);
      fireEvent.click(screen.getByRole('button', { name: /Technology/i }));
      expect(screen.getAllByText(/Clear/)).toHaveLength(1);
    });

    it('labels the holdings list columns', () => {
      renderTable(HOLDINGS);
      expect(screen.getByText('Risk')).toBeInTheDocument();
      expect(screen.getByText('Weight')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('highlights the market context row matching the selected sector in accent orange, not the neutral grey used elsewhere', () => {
      const marketContext = {
        available: true,
        label: 'Illustrative market context',
        sectors: [
          { sector: 'Technology', weight_pct: 61.7, daily_change_pct: 6.7, tickers: ['NPN'], summary: 'Your Technology holdings (NPN) are up 6.7% today.' },
          { sector: 'Financials', weight_pct: 38.3, daily_change_pct: 4.2, tickers: ['SBK'], summary: 'Your Financials holdings (SBK) are up 4.2% today.' },
        ],
      };
      renderTable(HOLDINGS, SECTOR_DATA, marketContext);

      const techRow = screen.getByText(/Your Technology holdings/).closest('div');
      const finRow = screen.getByText(/Your Financials holdings/).closest('div');
      if (!techRow || !finRow) throw new Error('expected both market-context rows to render');

      expect(techRow.style.background).toBe('');
      expect(finRow.style.background).toBe('');

      fireEvent.click(screen.getByRole('button', { name: /Technology/i }));

      expect(techRow.style.background).toContain('accent-subtle');
      expect(finRow.style.background).toBe('');
    });

    it('no longer shows weight/change percentages on market context rows - the summary text is the point now (backlog 3 item 4)', () => {
      renderTable(HOLDINGS, SECTOR_DATA, {
        available: true,
        label: 'Illustrative market context',
        sectors: [
          { sector: 'Technology', weight_pct: 61.7, daily_change_pct: 6.7, tickers: ['NPN'], summary: 'Your Technology holdings (NPN) are up 6.7% today.' },
        ],
      });
      expect(screen.getAllByText('+6.70%')).toHaveLength(1);
    });
  });

  describe('column alignment (Prompt 2 item 1)', () => {
    it('gives each right-side data column the same fixed width as its header label', () => {
      renderTable(HOLDINGS);
      /** @param {HTMLElement} el */
      const widthOf = (el) => el.className.match(/w-\[\d+px\]/)?.[0];

      const headerRisk = widthOf(screen.getByText('Risk'));
      const headerWeight = widthOf(screen.getByText('Weight'));
      const headerToday = widthOf(screen.getByText('Today'));
      const headerValue = widthOf(screen.getByText('Value'));
      [headerRisk, headerWeight, headerToday, headerValue].forEach((w) => expect(w).toBeTruthy());

      const npnRow = screen.getByRole('button', { name: /NPN/i });
      const [badge, weight, today, value] = npnRow.querySelectorAll('span');

      expect(widthOf(badge)).toBe(headerRisk);
      expect(widthOf(weight)).toBe(headerWeight);
      expect(widthOf(today)).toBe(headerToday);
      expect(widthOf(value)).toBe(headerValue);
    });
  });

  describe('click-to-filter from a holding row (Prompt 2 item 2)', () => {
    it('renders holding rows as accessible buttons, matching the SectorAllocation legend pattern', () => {
      renderTable(HOLDINGS);
      expect(screen.getByRole('button', { name: /NPN/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /SBK/i })).toBeInTheDocument();
    });

    it('clicking a holding row filters the list to that sector, same as clicking its pie slice/legend row would', () => {
      renderTable(HOLDINGS);
      fireEvent.click(screen.getByRole('button', { name: /NPN/i }));

      expect(screen.getByText('NPN')).toBeInTheDocument();
      expect(screen.queryByText('SBK')).not.toBeInTheDocument();
      expect(screen.getByText(/Filtered to Technology/i)).toBeInTheDocument();
    });

    it('clicking the same holding row again toggles the filter back off', () => {
      renderTable(HOLDINGS);
      fireEvent.click(screen.getByRole('button', { name: /NPN/i }));
      expect(screen.queryByText('SBK')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /NPN/i }));
      expect(screen.getByText('SBK')).toBeInTheDocument();
    });

    it('filters by sector, not by the individual holding - other holdings sharing that sector stay visible', () => {
      const holdingsSharedSector = [
        ...HOLDINGS,
        { ticker: 'PRX', name: 'Prosus', sector: 'Technology', value: 3000, current_price: 100, daily_change_pct: 1.2 },
      ];
      renderTable(holdingsSharedSector);
      fireEvent.click(screen.getByRole('button', { name: /NPN/i }));

      expect(screen.getByText('NPN')).toBeInTheDocument();
      expect(screen.getByText('PRX')).toBeInTheDocument();
      expect(screen.queryByText('SBK')).not.toBeInTheDocument();
    });

    it('drives the same pie-slice dimming and orange market-context highlight a legend click would, with no extra wiring', () => {
      const marketContext = {
        available: true,
        label: 'Illustrative market context',
        sectors: [
          { sector: 'Technology', weight_pct: 61.7, daily_change_pct: 6.7, tickers: ['NPN'], summary: 'Your Technology holdings (NPN) are up 6.7% today.' },
          { sector: 'Financials', weight_pct: 38.3, daily_change_pct: 4.2, tickers: ['SBK'], summary: 'Your Financials holdings (SBK) are up 4.2% today.' },
        ],
      };
      renderTable(HOLDINGS, SECTOR_DATA, marketContext);

      const techRow = screen.getByText(/Your Technology holdings/).closest('div');
      const finRow = screen.getByText(/Your Financials holdings/).closest('div');
      if (!techRow || !finRow) throw new Error('expected both market-context rows to render');
      expect(techRow.style.background).toBe('');

      fireEvent.click(screen.getByRole('button', { name: /NPN/i }));

      expect(techRow.style.background).toContain('accent-subtle');
      expect(finRow.style.background).toBe('');
    });
  });

  describe('cost basis / total return / held since (Prompt B)', () => {
    const HOLDING_WITH_HISTORY = {
      ticker: 'NPN', name: 'Naspers', sector: 'Technology', value: 6767, current_price: 67,
      daily_change_pct: 6.7, avg_cost: 55.2, gain_loss: 800.5, gain_loss_pct: 13.4,
      first_purchase_date: '2022-03-14',
    };
    const HOLDING_WITHOUT_HISTORY = {
      ticker: 'SBK', name: 'Standard Bank', sector: 'Financials', value: 4200, current_price: 420,
      daily_change_pct: 4.2, avg_cost: 410.0, gain_loss: -1200.0, gain_loss_pct: -22.2,
      first_purchase_date: null,
    };

    it('is collapsed by default - no cost basis/return/held-since visible until expanded', () => {
      renderTable([HOLDING_WITH_HISTORY, HOLDING_WITHOUT_HISTORY]);
      expect(screen.queryByText('Avg Cost')).not.toBeInTheDocument();
      expect(screen.queryByText('Total Return')).not.toBeInTheDocument();
      expect(screen.queryByText('Held Since')).not.toBeInTheDocument();
    });

    it('shows avg cost, total return (Rand + %), and a real held-since date once expanded', () => {
      renderTable([HOLDING_WITH_HISTORY, HOLDING_WITHOUT_HISTORY]);
      const row = within(screen.getByTestId('holding-row-NPN'));
      fireEvent.click(row.getByRole('button', { name: /show cost basis and holding period/i }));

      expect(row.getByText('Avg Cost')).toBeInTheDocument();
      expect(row.getByText(/R\s?55/)).toBeInTheDocument();
      expect(row.getByText('Total Return')).toBeInTheDocument();
      expect(row.getByText(/\+R\s?801.*13\.4%/)).toBeInTheDocument();
      expect(row.getByText('Held Since')).toBeInTheDocument();
      expect(row.getByText('Mar 2022')).toBeInTheDocument();
    });

    it('shows an honest "not available" state instead of a blank or fabricated date when first_purchase_date is null', () => {
      renderTable([HOLDING_WITH_HISTORY, HOLDING_WITHOUT_HISTORY]);
      const row = within(screen.getByTestId('holding-row-SBK'));
      fireEvent.click(row.getByRole('button', { name: /show cost basis and holding period/i }));

      expect(row.getByText('Held Since')).toBeInTheDocument();
      expect(row.getByText('Cost data not available')).toBeInTheDocument();
      expect(row.getByText(/R\s?410/)).toBeInTheDocument();
    });

    it('color-codes total return red for a loss, matching HoldingGainLossRow elsewhere', () => {
      renderTable([HOLDING_WITH_HISTORY, HOLDING_WITHOUT_HISTORY]);
      const row = within(screen.getByTestId('holding-row-SBK'));
      fireEvent.click(row.getByRole('button', { name: /show cost basis and holding period/i }));

      const returnValue = row.getByText(/R\s*-1\s*200.*-22\.2%/);
      expect(returnValue.style.color).toBe('var(--signal-negative)');
    });

    it('collapses again on a second click', async () => {
      renderTable([HOLDING_WITH_HISTORY]);
      const row = within(screen.getByTestId('holding-row-NPN'));
      const toggle = () => row.getByRole('button', { name: /cost basis and holding period/i });

      fireEvent.click(toggle());
      expect(row.getByText('Avg Cost')).toBeInTheDocument();

      fireEvent.click(toggle());
      await waitForElementToBeRemoved(() => row.queryByText('Avg Cost'));
    });
  });

  it('offers the EquityLens Insight trigger only while the card is open', () => {
    renderTable(HOLDINGS);
    const trigger = () => screen.queryByRole('button', { name: 'Ask AI about your positions' });

    expect(trigger()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse all positions/i }));
    expect(trigger()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /expand all positions/i }));
    expect(trigger()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /collapse all positions/i }));
    expect(trigger()).toBeNull();
  });
});
