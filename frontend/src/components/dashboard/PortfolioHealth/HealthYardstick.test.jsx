import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import HealthYardstick from './HealthYardstick';

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

const payload = (over = {}) => ({
  active: { breadth_target_n: 8 },
  source: 'default',
  preset_key: 'equitylens',
  derived_preset_key: null,
  default_preset_key: 'equitylens',
  presets: [
    { key: 'equitylens', name: 'EquityLens default', description: 'General-purpose.', config: {} },
    { key: 'growth', name: 'Growth', description: 'Leans into fewer sectors.', config: {} },
    { key: 'income', name: 'Income / dividend', description: 'Clusters by design.', config: {} },
  ],
  bounds: {},
  ...over,
});

beforeEach(() => {
  getHealthConfig.mockReset();
  saveHealthConfig.mockReset();
  clearHealthConfig.mockReset();
  getHealthConfig.mockResolvedValue(payload());
});

const open = async () => {
  render(<HealthYardstick />);
  fireEvent.click(await screen.findByText('Change'));
  return screen.findByLabelText('Score my portfolio as');
};

/** @param {string} label */
const pick = (label) => {
  fireEvent.click(screen.getByLabelText('Score my portfolio as'));
  fireEvent.mouseDown(within(screen.getByRole('listbox')).getByText(label));
};

describe('HealthYardstick', () => {
  it('names the active yardstick and where it came from', async () => {
    render(<HealthYardstick />);
    expect(await screen.findByText('EquityLens default')).toBeInTheDocument();
    expect(screen.getByText(/the EquityLens default/)).toBeInTheDocument();
  });

  it('distinguishes a guess from a choice', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'derived', preset_key: 'growth' }));
    render(<HealthYardstick />);
    expect(await screen.findByText(/matched to your goal/)).toBeInTheDocument();
    expect(screen.queryByText(/your choice/)).not.toBeInTheDocument();
  });

  it('renders nothing rather than a broken control when the config cannot be loaded', async () => {
    getHealthConfig.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<HealthYardstick />);
    await waitFor(() => expect(getHealthConfig).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('saves the picked preset and tells the parent the score is now stale', async () => {
    const onChanged = vi.fn();
    saveHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'growth' }));
    render(<HealthYardstick onChanged={onChanged} />);
    fireEvent.click(await screen.findByText('Change'));

    pick('Growth');

    await waitFor(() => expect(saveHealthConfig).toHaveBeenCalledWith({ preset_key: 'growth' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(await screen.findByText(/your choice/)).toBeInTheDocument();
  });

  it('says presets move the yardstick, not the risk', async () => {
    await open();
    expect(
      screen.getByText(/change what your portfolio is compared to, not how much risk it carries/i),
    ).toBeInTheDocument();
  });

  it('offers the goal-matched preset by name once the user has overridden it', async () => {
    getHealthConfig.mockResolvedValue(
      payload({ source: 'preset', preset_key: 'income', derived_preset_key: 'growth' }),
    );
    clearHealthConfig.mockResolvedValue(payload({ source: 'derived', preset_key: 'growth' }));
    await open();

    const revert = screen.getByText('Use the one matched to my goal (Growth)');
    fireEvent.click(revert);
    await waitFor(() => expect(clearHealthConfig).toHaveBeenCalled());
  });

  it('does not offer to revert to a goal-matched preset that is already applied', async () => {
    getHealthConfig.mockResolvedValue(
      payload({ source: 'derived', preset_key: 'growth', derived_preset_key: 'growth' }),
    );
    await open();
    expect(screen.queryByText(/Use the one matched to my goal/)).not.toBeInTheDocument();
  });

  it('hides Reset to EquityLens when EquityLens is already what applies', async () => {
    await open();
    expect(screen.queryByText('Reset to EquityLens')).not.toBeInTheDocument();
  });

  it('offers Reset to EquityLens once something else applies', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'income' }));
    saveHealthConfig.mockResolvedValue(payload());
    await open();

    fireEvent.click(screen.getByText('Reset to EquityLens'));
    await waitFor(() =>
      expect(saveHealthConfig).toHaveBeenCalledWith({ preset_key: 'equitylens' }),
    );
  });

  it('keeps showing the server state and says so when a save fails', async () => {
    const onChanged = vi.fn();
    getHealthConfig.mockResolvedValue(payload({ source: 'preset', preset_key: 'income' }));
    saveHealthConfig.mockRejectedValueOnce(new Error('boom'));
    render(<HealthYardstick onChanged={onChanged} />);
    fireEvent.click(await screen.findByText('Change'));

    pick('Growth');

    expect(await screen.findByText(/Your settings are unchanged/)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Score my portfolio as')).toHaveTextContent('Income / dividend');
  });

  it('gives a customised config somewhere to sit in the picker', async () => {
    getHealthConfig.mockResolvedValue(payload({ source: 'custom', preset_key: null }));
    await open();
    expect(screen.getByLabelText('Score my portfolio as')).toHaveTextContent('Custom settings');
    expect(screen.getByText(/your own settings/)).toBeInTheDocument();
  });
});
