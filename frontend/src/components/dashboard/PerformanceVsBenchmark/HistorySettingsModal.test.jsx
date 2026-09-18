import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import HistorySettingsModal, {
  HISTORY_DEFAULT,
  historyCutoff,
  loadHistoryPref,
  qualityLines,
  saveHistoryPref,
} from './HistorySettingsModal';

const DATES = { importedAt: '2026-07-31' };

/** @param {any} props */
const renderModal = (props = {}) =>
  render(
    <HistorySettingsModal
      open
      onClose={vi.fn()}
      pref={HISTORY_DEFAULT}
      onChange={vi.fn()}
      {...DATES}
      {...props}
    />,
  );

describe('HistorySettingsModal', () => {
  it('discloses what the reconstruction cannot know, not just that it exists', () => {
    renderModal();

    expect(screen.getByText(/assumes the transaction list on your statement is complete/i)).toBeInTheDocument();
    expect(screen.getByText(/carries the last price it has forward/i)).toBeInTheDocument();
    expect(screen.getByText(/opened and closed entirely before the statement period/i)).toBeInTheDocument();
    expect(screen.getByText(/corporate actions such as splits/i)).toBeInTheDocument();
  });

  it('names the upload date, which is the one the radio buttons act on', () => {
    renderModal();

    expect(screen.getByText(/Uploaded 31 July 2026/)).toBeInTheDocument();
  });

  it('offers the two sources and reports which one was picked', async () => {
    const onChange = vi.fn();
    renderModal({ onChange });

    await userEvent.click(screen.getByRole('radio', { name: /only since i uploaded/i }));

    expect(onChange).toHaveBeenCalledWith({ source: 'imported', limit: 'ALL' });
  });

  it('greys out the reconstruction limit when there is no reconstruction to limit', () => {
    renderModal({ pref: { source: 'imported', limit: 'ALL' } });

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('changes the limit without losing the source', async () => {
    const onChange = vi.fn();
    renderModal({ onChange });

    await userEvent.selectOptions(screen.getByRole('combobox'), '3M');

    expect(onChange).toHaveBeenCalledWith({ source: 'reconstructed', limit: '3M' });
  });

  it('says nothing rather than guessing when the upload date is missing', () => {
    renderModal({ importedAt: null });

    expect(screen.queryByText(/Uploaded/)).not.toBeInTheDocument();
  });
});

describe('historyCutoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T08:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cuts at the upload date when the user only wants what was recorded', () => {
    expect(historyCutoff({ source: 'imported', limit: 'ALL' }, DATES.importedAt)).toBe('2026-07-31');
  });

  it('measures the limit back from today, not forward from the first snapshot', () => {
    expect(historyCutoff({ source: 'reconstructed', limit: '3M' }, DATES.importedAt)).toBe('2026-06-12');
    expect(historyCutoff({ source: 'reconstructed', limit: '1Y' }, DATES.importedAt)).toBe('2025-09-12');
  });

  it('does not cut at all on everything', () => {
    expect(historyCutoff({ source: 'reconstructed', limit: 'ALL' }, DATES.importedAt)).toBeNull();
  });

  it('does not cut when there is no upload date to cut at', () => {
    expect(historyCutoff({ source: 'imported', limit: 'ALL' }, null)).toBeNull();
  });
});

describe('the stored preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('survives a round trip', () => {
    saveHistoryPref({ source: 'imported', limit: '6M' });
    expect(loadHistoryPref()).toEqual({ source: 'imported', limit: '6M' });
  });

  it('falls back to the default rather than trusting whatever is in storage', () => {
    window.localStorage.setItem('performance_history_pref', '{"source":"nonsense","limit":"7Y"}');
    expect(loadHistoryPref()).toEqual(HISTORY_DEFAULT);

    window.localStorage.setItem('performance_history_pref', 'not json');
    expect(loadHistoryPref()).toEqual(HISTORY_DEFAULT);
  });

  it('keeps working when storage itself throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(loadHistoryPref()).toEqual(HISTORY_DEFAULT);
    expect(() => saveHistoryPref(HISTORY_DEFAULT)).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('qualityLines', () => {
  it('reports what the reconstruction managed, in numbers', () => {
    const lines = qualityLines({
      first_day: '2026-02-04',
      priced_value_pct: 94.2,
      unpriced_tickers: ['XYZ.JO'],
      ledger_conflicts: 2,
      suspect_dates: ['2026-03-04'],
    });

    expect(lines).toContain('We could price 94% of your book.');
    expect(lines.some((l) => l.includes('4 February 2026'))).toBe(true);
    expect(lines).toContain('No cached prices for XYZ.JO, so it is not in the reconstructed values.');
    expect(lines).toContain('2 transactions disagree with your closing holdings.');
    expect(lines.some((l) => l.includes('may be a share split'))).toBe(true);
  });

  it('says nothing about checks this load did not run', () => {
    const lines = qualityLines({
      first_day: null, priced_value_pct: 0,
      unpriced_tickers: [], ledger_conflicts: null, suspect_dates: null,
    });

    expect(lines).toEqual([]);
  });

  it('has nothing to say when the payload carries no report at all', () => {
    expect(qualityLines(null)).toEqual([]);
  });});