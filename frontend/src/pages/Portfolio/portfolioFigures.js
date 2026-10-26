import { formatCurrency } from '../../utils/formatters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @param {number | null | undefined} value
 */
export const rand = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? formatCurrency(value) : '—';

/** @param {string | null | undefined} iso "2026-09-29" or "2026-10-19T09:00:00" */
export const shortDate = (iso) => {
  const [year, month, day] = String(iso ?? '').slice(0, 10).split('-');
  const name = MONTHS[Number(month) - 1];
  if (!name || !day || !year) return null;
  return `${Number(day)} ${name} ${year}`;
};

/** @param {string | null | undefined} id */
export const shortSnapshotId = (id) => (id ? String(id).slice(0, 8) : null);

/**
 * @param {{ name?: string|null, value: number, side?: string|null }[]} trading
 */
export const splitTrading = (trading) => {
  // a snapshot saved before the backend tagged each row has nothing to split on
  if (!trading?.some((row) => row.side)) return { bought: null, sold: null };
  const total = (/** @type {string} */ side) =>
    trading.filter((row) => row.side === side).reduce((sum, row) => sum + row.value, 0);
  return { bought: total('buy'), sold: total('sell') };
};

/**
 * @param {{ name?: string|null, value: number }[]} cashFlow
 */
export const splitCashFlow = (cashFlow) => {
  if (!cashFlow?.length) return { moneyIn: null, moneyOut: null };
  let moneyIn = 0;
  let moneyOut = 0;
  for (const row of cashFlow) {
    if (row.value >= 0) moneyIn += row.value;
    else moneyOut -= row.value;
  }
  return { moneyIn, moneyOut };
};

/**
 * @param {{ name?: string|null, gross_dividend: number, withholding_tax: number, net_dividend: number }[]} rows
 */
export const dividendBars = (rows) =>
  (rows ?? []).map((row) => ({
    name: row.name,
    net: row.net_dividend,
    tax: row.withholding_tax,
  }));
