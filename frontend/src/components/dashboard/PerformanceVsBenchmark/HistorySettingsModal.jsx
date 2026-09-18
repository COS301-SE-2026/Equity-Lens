import { longDate } from '../../../utils/eventNarrative';
import Modal from '../../common/Modal/Modal';

const STORAGE_KEY = 'performance_history_pref';

/** @typedef {{ source: 'reconstructed'|'imported', limit: 'ALL'|'3M'|'6M'|'1Y' }} HistoryPref */

/** @type {HistoryPref} */
export const HISTORY_DEFAULT = { source: 'reconstructed', limit: 'ALL' };

/** @type {{ key: HistoryPref['limit'], label: string, months: number|null }[]} */
const LIMITS = [
  { key: '3M', label: '3 months', months: 3 },
  { key: '6M', label: '6 months', months: 6 },
  { key: '1Y', label: '1 year', months: 12 },
  { key: 'ALL', label: 'Everything', months: null },
];

const CANNOT_KNOW = [
  'It assumes the transaction list on your statement is complete.',
  'On a day with no cached closing price it carries the last price it has forward, so those days read as flat rather than missing.',
  'It works backwards from what you hold now, so a position you opened and closed entirely before the statement period leaves no trace.',
  'It does not adjust for corporate actions such as splits or scrip dividends.',
];

/**
 * @param {any} quality
 * @returns {string[]}
 */
export function qualityLines(quality) {
  if (!quality) return [];
  const lines = [];

  if (typeof quality.priced_value_pct === 'number' && quality.priced_value_pct > 0) {
    lines.push(`We could price ${quality.priced_value_pct.toFixed(0)}% of your book.`);
  }
  if (quality.first_day) {
    lines.push(`The reconstruction starts on ${longDate(quality.first_day)}, the first day every holding could be priced.`);
  }
  for (const ticker of quality.unpriced_tickers ?? []) {
    lines.push(`No cached prices for ${ticker}, so it is not in the reconstructed values.`);
  }
  if (quality.ledger_conflicts) {
    const n = quality.ledger_conflicts;
    lines.push(`${n} transaction${n === 1 ? '' : 's'} disagree with your closing holdings.`);
  }
  for (const day of quality.suspect_dates ?? []) {
    lines.push(`A large unexplained price move on ${longDate(day)} may be a share split.`);
  }

  return lines;
}

/** @returns {HistoryPref} */
export function loadHistoryPref() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return HISTORY_DEFAULT;
    return {
      source: parsed.source === 'imported' ? 'imported' : 'reconstructed',
      limit: LIMITS.some((l) => l.key === parsed.limit) ? parsed.limit : 'ALL',
    };
  } catch {
    return HISTORY_DEFAULT;
  }
}

/** @param {HistoryPref} pref */
export function saveHistoryPref(pref) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {//
  }
}

/**
 * @param {HistoryPref} pref
 * @param {string|null|undefined} importedAt
 * @returns {string|null}
 */
export function historyCutoff(pref, importedAt) {
  if (pref.source === 'imported') return importedAt ?? null;

  const months = LIMITS.find((l) => l.key === pref.limit)?.months;
  if (!months) return null;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const month = String(cutoff.getMonth() + 1).padStart(2, '0');
  const day = String(cutoff.getDate()).padStart(2, '0');
  return `${cutoff.getFullYear()}-${month}-${day}`;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   pref: HistoryPref,
 *   onChange: (pref: HistoryPref) => void,
 *   importedAt?: string|null,
 *   historyQuality?: any,
 * }} props
 */
const HistorySettingsModal = ({ open, onClose, pref, onChange, importedAt, historyQuality }) => (
  <Modal open={open} onClose={onClose} title="Performance history">
    <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
      How the chart is built
    </h3>
    <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      Before the day you uploaded your statement, the value of your book is worked out backwards
      from the transactions on that statement and the closing prices that are stored. After it,
      every point is a value we recorded on the day.
    </p>

    <h3 className="mt-4 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
      What the reconstruction cannot know
    </h3>
    <ul className="mt-1 space-y-1">
      {CANNOT_KNOW.map((line) => (
        <li key={line} className="flex gap-2 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          <span aria-hidden="true" style={{ color: 'var(--text-ghost)' }}>-</span>
          {line}
        </li>
      ))}
    </ul>
      
      {qualityLines(historyQuality).length > 0 && (
      <>
        <h3 className="mt-4 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
          What it managed with your holdings
        </h3>
        <ul className="mt-1 space-y-1">
          {qualityLines(historyQuality).map((line) => (
            <li key={line} className="flex gap-2 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden="true" style={{ color: 'var(--text-ghost)' }}>-</span>
              {line}
            </li>
          ))}
        </ul>
      </>
    )}

    <fieldset className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <legend className="sr-only">What to plot</legend>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="history-source"
          checked={pref.source === 'reconstructed'}
          onChange={() => onChange({ ...pref, source: 'reconstructed' })}
          className="mt-0.5"
        />
        <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
          Reconstructed history
          <span className="block text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            Everything we can work out back to your first transaction.
          </span>
        </span>
      </label>

      <label className="mt-3 flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="history-source"
          checked={pref.source === 'imported'}
          onChange={() => onChange({ ...pref, source: 'imported' })}
          className="mt-0.5"
        />
        <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
          Only since I uploaded
          <span className="block text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            Just the values we recorded ourselves.
          </span>
        </span>
      </label>

      <label className="mt-4 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        Go back at most
        <select
          value={pref.limit}
          disabled={pref.source === 'imported'}
          onChange={(e) => onChange({ ...pref, limit: /** @type {any} */ (e.target.value) })}
          className="rounded-lg px-2 py-1 font-mono text-[12px] outline-none disabled:opacity-40"
          style={{
            background: 'var(--surface-inset)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        >
          {LIMITS.map((limit) => (
            <option key={limit.key} value={limit.key}>{limit.label}</option>
          ))}
        </select>
      </label>
    </fieldset>
    
    {importedAt && (
      <p className="mt-4 font-mono text-[11px] leading-relaxed" style={{ color: 'var(--text-ghost)' }}>
        Uploaded {longDate(importedAt)}
      </p>
    )}
  </Modal>
);

export default HistorySettingsModal;
