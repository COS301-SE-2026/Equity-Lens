export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(value);

export const formatPercent = (value) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export const formatShortCurrency = (value) =>
  `R ${(value / 1000).toFixed(0)}k`;

export const formatMonthYear = (dateStr) => {
  const [year, month] = dateStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
};

export const formatNumber = (value) =>
  new Intl.NumberFormat('en-ZA').format(value);