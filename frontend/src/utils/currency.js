/** @param {number} n */
export const zar = (n) => `R ${Math.round(n).toLocaleString('en-ZA')}`;

/** @param {number} n */
export const zarFull = (n) =>
  `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
