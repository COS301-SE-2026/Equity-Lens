
export const getMockIndicatorData = () => [
  {
    ticker: 'NPN', name: 'Naspers',
    capm:     { value: 14.82, unit: '%' },
    pe_ratio: { value: 60.11, unit: 'x' },
    altman_z: { value: 3.24,  unit: '' },
    sharpe:   { value: 0.61,  unit: '' },
    beta:     { value: 1.35,  unit: '' },
    sortino:  { value: 0.84,  unit: '' },
    rsi:      { value: 62,    unit: '' },
  },
  {
    ticker: 'MTN', name: 'MTN Group',
    capm:     { value: 13.35, unit: '%' },
    pe_ratio: { value: 16.83, unit: 'x' },
    altman_z: { value: 2.61,  unit: '' },
    sharpe:   { value: 0.25,  unit: '' },
    beta:     { value: 0.95,  unit: '' },
    sortino:  { value: 0.41,  unit: '' },
    rsi:      { value: 48,    unit: '' },
  },
];