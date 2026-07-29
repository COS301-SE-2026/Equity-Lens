/** @param {number} value */
export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value);

/** @param {number} value */
export const formatPercent = (value) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

/** @param {number} value */
export const formatShortCurrency = (value) => {
  const abs = Math.abs(value ?? 0);
  if (abs >= 1_000_000) {
    return `R ${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  }
  if (abs >= 10_000) {
    return `R ${(value / 1000).toFixed(0)}k`;
  }
  if (abs >= 1000) {
    const decimals = value < 0 ? 1 : 0;
    return `R ${(value / 1000).toFixed(decimals)}k`;
  }
  return `R ${Math.round(value ?? 0)}`;
};

/** @param {string} dateStr - "YYYY-MM" */
export const formatMonthYear = (dateStr) => {
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
};

/** @param {number} value */
export const formatNumber = (value) =>
  new Intl.NumberFormat('en-ZA').format(value);