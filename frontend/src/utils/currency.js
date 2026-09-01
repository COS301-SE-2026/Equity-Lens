const SYMBOLS = { ZAR: 'R', USD: '$' };
const LOCALES = { ZAR: 'en-ZA', USD: 'en-US' };

/** @param {number} n @param {'ZAR'|'USD'} [currency] */
export const zar = (n, currency = 'ZAR') =>
  `${SYMBOLS[currency]} ${Math.round(n).toLocaleString(LOCALES[currency])}`;

/** @param {number} n @param {'ZAR'|'USD'} [currency] */
export const zarFull = (n, currency = 'ZAR') =>
  `${SYMBOLS[currency]} ${n.toLocaleString(LOCALES[currency], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
