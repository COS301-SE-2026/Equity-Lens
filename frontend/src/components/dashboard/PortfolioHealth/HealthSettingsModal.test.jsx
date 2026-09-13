import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import HealthSettingsModal, { measuresFacts } from './HealthSettingsModal';

const getHealthConfig = vi.fn();
const saveHealthConfig = vi.fn();
const clearHealthConfig = vi.fn();

vi.mock('../../../services/portfolioService', () => ({
  /** @param {any[]} args */
  getHealthConfig: (...args) => getHealthConfig(...args),
  /** @param {any[]} args */
  saveHealthConfig: (...args) => saveHealthConfig(...args),
  /** @param {any[]} args */
  clearHealthConfig: (...args) => clearHealthConfig(...args),
}));

const DEFAULT_CONFIG = {
  weight_sector_concentration: 0.4,
  weight_single_position: 0.35,
  weight_breadth: 0.25,
  concentration_low: 25,
  concentration_high: 45,
  hhi_well_spread: 0.15,
  breadth_target_n: 8,
};

const GROWTH_CONFIG = { ...DEFAULT_CONFIG, concentration_low: 30, hhi_well_spread: 0.25, breadth_target_n: 6 };
const INCOME_CONFIG = { ...DEFAULT_CONFIG, concentration_low: 20, hhi_well_spread: 0.2, breadth_target_n: 10 };

const payload = (over = {}) => ({
  active: DEFAULT_CONFIG,
  source: 'default',
  preset_key: 'equitylens',
  derived_preset_key: null,
  default_preset_key: 'equitylens',
  presets: [
    {
      key: 'equitylens',
      name: 'EquityLens default',
      description: 'A general-purpose structural risk yardstick with no assumption about your strategy.',
      config: DEFAULT_CONFIG,
    },
    { key: 'growth', name: 'Growth', description: 'Leans into fewer sectors.', config: GROWTH_CONFIG },
    { key: 'income', name: 'Income / dividend', description: 'Clusters by design.', config: INCOME_CONFIG },
  ],
  bounds: {
    weight_min: 0.05,
    weight_max: 0.7,
    concentration_pct_min: 10,
    concentration_pct_max: 70,
    hhi_target_min: 0.05,
    hhi_target_max: 0.5,
    breadth_target_min: 3,
    breadth_target_max: 20,
  },
  ...over,
});

beforeEach(() => {
  getHealthConfig.mockReset();
  saveHealthConfig.mockReset();
  clearHealthConfig.mockReset();
  getHealthConfig.mockResolvedValue(payload());
});

/** @param {{ onChanged?: () => void }} [props] */
const open = async (props) => {
  render(<HealthSettingsModal open onClose={vi.fn()} onChanged={props?.onChanged} />);
  return screen.findByRole('dialog');
};

/** @param {string} name */
const card = (name) => screen.getByRole('button', { name: new RegExp(name, 'i') });

const advanced = async () => {
  await open();
  fireEvent.click(screen.getByText('Advanced - define your own'));
};

/** @param {string} label @param {string} value */
const setField = (label, value) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('HealthSettingsModal', () => {
  it('names the active yardstick and where it came from', async () => {
    await open();
    expect(await screen.findByText(/Scored against/)).toBeInTheDocument();
    expect(screen.getByText(/the EquityLens default/)).toBeInTheDocument();
  });

  it('distinguishes a guess from a choice', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'derived', preset_key: 'growth' }));
    await open();
    expect(await screen.findByText(/matched to your portfolio/)).toBeInTheDocument();
    expect(screen.queryByText(/your choice/)).not.toBeInTheDocument();
  });

  it('renders nothing rather than a broken dialog when the config cannot be loaded', async () => {
    getHealthConfig.mockRejectedValueOnce(new Error('boom'));
    render(<HealthSettingsModal open onClose={vi.fn()} />);
    await waitFor(() => expect(getHealthConfig).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives a customised config somewhere to sit', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'custom', preset_key: null }));
    await open();
    expect(await screen.findByText('custom settings')).toBeInTheDocument();
    expect(screen.getByText(/your own settings/)).toBeInTheDocument();
  });

  it('renders each preset description in full rather than just its name', async () => {
    await open();
    expect(
      await screen.findByText(
        'A general-purpose structural risk yardstick with no assumption about your strategy.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Leans into fewer sectors.')).toBeInTheDocument();
  });

  it("describes each preset in that preset's own numbers", async () => {
    await open();
    expect(await screen.findByText('Flags a holding above 25%')).toBeInTheDocument();
    expect(screen.getByText('targets ~7 evenly-weighted sectors')).toBeInTheDocument();
    expect(screen.getByText('8+ effective positions')).toBeInTheDocument();
    expect(screen.getByText('Flags a holding above 30%')).toBeInTheDocument();
    expect(screen.getByText('targets ~4 evenly-weighted sectors')).toBeInTheDocument();
    expect(screen.getByText('6+ effective positions')).toBeInTheDocument();
  });

  it('reports the selected preset to a screen reader, not just with a border colour', async () => {
    await open();
    expect(card('EquityLens default')).toHaveAttribute('aria-pressed', 'true');
    expect(card('Growth')).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies a preset on click and tells the parent the score is now stale', async () => {
    const onChanged = vi.fn();
    saveHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'growth' }));
    await open({ onChanged });

    fireEvent.click(card('Growth'));

    await waitFor(() => expect(saveHealthConfig).toHaveBeenCalledWith({ preset_key: 'growth' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(await screen.findByText(/your choice/)).toBeInTheDocument();
  });

  it('says presets move the yardstick, not the risk', async () => {
    await open();
    expect(
      await screen.findByText(/change what your portfolio is compared to, not how much risk it carries/i),
    ).toBeInTheDocument();
  });

  it('offers the portfolio-matched preset by name once the user has overridden it', async () => {
    getHealthConfig.mockResolvedValue(
      payload({ source: 'preset', preset_key: 'income', derived_preset_key: 'growth' }),
    );
    clearHealthConfig.mockResolvedValue(payload({ source: 'derived', preset_key: 'growth' }));
    await open();

    fireEvent.click(await screen.findByText('Use the one matched to my portfolio (Growth)'));
    await waitFor(() => expect(clearHealthConfig).toHaveBeenCalled());
  });

  it('does not offer to revert to a portfolio-matched preset that is already applied', async () => {
    getHealthConfig.mockResolvedValue(
      payload({ source: 'derived', preset_key: 'growth', derived_preset_key: 'growth' }),
    );
    await open();
    expect(screen.queryByText(/Use the one matched to my portfolio/)).not.toBeInTheDocument();
  });

  it('hides Reset to EquityLens when EquityLens is already what applies', async () => {
    await open();
    expect(screen.queryByText('Reset to EquityLens')).not.toBeInTheDocument();
  });

  it('offers Reset to EquityLens once something else applies', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'income' }));
    saveHealthConfig.mockResolvedValue(payload());
    await open();

    fireEvent.click(await screen.findByText('Reset to EquityLens'));
    await waitFor(() => expect(saveHealthConfig).toHaveBeenCalledWith({ preset_key: 'equitylens' }));
  });

  it('keeps showing the server state and says so when a save fails', async () => {
    const onChanged = vi.fn();
    getHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'income' }));
    saveHealthConfig.mockRejectedValueOnce(new Error('boom'));
    await open({ onChanged });

    fireEvent.click(card('Growth'));

    expect(await screen.findByText(/Your settings are unchanged/)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(card('Income / dividend')).toHaveAttribute('aria-pressed', 'true');
  });

  describe('custom config', () => {
    it('takes its input bounds from the payload rather than hardcoding them', async () => {
      await advanced();
      expect(screen.getByLabelText('Sector spread weight')).toHaveAttribute('max', '0.7');
      expect(screen.getByLabelText('Effective positions target')).toHaveAttribute('max', '20');
      expect(screen.getByLabelText('Flag a holding from (%)')).toHaveAttribute('min', '10');
    });

    it('seeds the inputs from the active config', async () => {
      await advanced();
      expect(screen.getByLabelText('Breadth weight')).toHaveValue(0.25);
      expect(screen.getByLabelText('High concentration from (%)')).toHaveValue(45);
    });

    it('blocks a save while the three weights do not sum to 1', async () => {
      await advanced();
      setField('Sector spread weight', '0.5');
      setField('Single-position weight', '0.3');
      setField('Breadth weight', '0.3');

      const total = screen.getByText('Weights total: 110%');
      expect(total).toHaveStyle({ color: 'var(--signal-negative)' });
      expect(screen.getByText('Save my settings')).toBeDisabled();
    });

    it('saves the seven fields once the weights balance', async () => {
      saveHealthConfig.mockResolvedValue(payload({ source: 'custom', preset_key: null }));
      await advanced();
      setField('Sector spread weight', '0.4');
      setField('Single-position weight', '0.35');
      setField('Breadth weight', '0.25');

      fireEvent.click(screen.getByText('Save my settings'));

      await waitFor(() =>
        expect(saveHealthConfig).toHaveBeenCalledWith({ config: DEFAULT_CONFIG }),
      );
    });

    it("shows the backend's own message when it rejects the values", async () => {
      saveHealthConfig.mockRejectedValueOnce({
        response: { data: { detail: 'concentration_low must be below concentration_high' } },
      });
      await advanced();
      setField('Flag a holding from (%)', '60');

      fireEvent.click(screen.getByText('Save my settings'));

      expect(
        await screen.findByText('concentration_low must be below concentration_high'),
      ).toBeInTheDocument();
    });
  });
});

describe('measuresFacts', () => {
  it('returns the three thresholds separately so none of them can wrap mid-phrase', () => {
    expect(measuresFacts(DEFAULT_CONFIG)).toEqual([
      'Flags a holding above 25%',
      'targets ~7 evenly-weighted sectors',
      '8+ effective positions',
    ]);
  });

  it('says nothing at all rather than printing ~Infinity when a threshold is missing', () => {
    const { hhi_well_spread: _omitted, ...withoutHhi } = DEFAULT_CONFIG;
    expect(measuresFacts(withoutHhi)).toBeNull();
  });
});
