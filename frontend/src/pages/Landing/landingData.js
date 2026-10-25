export const DEMO_COMPANY = { name: 'Acacia Holdings', ticker: 'ACA' };

export const DEMO_PRICES = [
  38.4, 38.37, 38.56, 38.54, 38.5, 38.28, 38.26, 38.62, 38.79, 39.14, 39.26, 39.42, 39.52, 39.07,
  41.1, 41.41, 41.62, 41.83, 41.35, 40.86, 40.64, 40.55, 40.69, 40.72, 40.93, 40.78, 40.92, 41.09,
  40.94, 41.52, 41.74, 38.48, 38.87, 38.74, 38.57, 38.52, 38.54, 38.77, 38.89, 38.81, 38.58, 38.48,
  38.88, 38.69, 38.81, 38.98, 38.59, 38.65,
];

export const DEMO_MONTHS = [
  { label: 'Mar', day: 0 },
  { label: 'Apr', day: 22 },
  { label: 'May', day: 44 },
];

/**
 * @typedef {{
 *   id: string,
 *   day: number,
 *   date: string,
 *   movePct: number,
 *   marketPct: number,
 *   companyPct: number,
 *   sigma: number,
 *   headline: string,
 *   timing: string,
 * }} DemoEvent
 */

/** @type {DemoEvent[]} */
export const DEMO_EVENTS = [
  {
    id: 'drop',
    day: 31,
    date: '14 Apr',
    movePct: -7.8,
    marketPct: -1.1,
    companyPct: -6.7,
    sigma: 4.3,
    headline: 'Acacia Holdings lowers its full-year guidance',
    timing: 'Published the same day · about this company',
  },
  {
    id: 'jump',
    day: 14,
    date: '20 Mar',
    movePct: 5.2,
    marketPct: 3.6,
    companyPct: 1.6,
    sigma: 3.1,
    headline: 'Retail shares rise across the sector',
    timing: 'Published the day before · about the sector',
  },
];

export const STEPS = [
  { id: 'upload', title: 'Upload', body: 'Your EasyEquities PDF or our Excel template.' },
  {
    id: 'understand',
    title: 'Understand',
    body: 'A health score, benchmark return and indicators.',
  },
  {
    id: 'explain',
    title: 'Explain',
    body: 'Open an unusual day: market, company, news.',
  },
];

export const PAGES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    chip: 'Dashboard',
    route: '/dashboard',
    line: 'Value, health score and unusual days.',
    alt: 'The Dashboard chart of a sample portfolio against the Satrix 40, with dots on its unusual days.',
    shot: true,
    callouts: [
      { x: 53.5, y: 59.4, text: 'Each dot is a day one of your holdings moved unusually far.' },
      { x: 70.8, y: 35.7, text: 'Your return against a benchmark, the Satrix 40 here.' },
      { x: 79.9, y: 23.9, text: 'Pick the range, from one day to everything.' },
    ],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    chip: 'Portfolio',
    route: '/portfolio',
    line: 'Import a statement, see its figures.',
    alt: 'The Portfolio page with a saved portfolio, the statement upload and the figures from the statement.',
    shot: true,
    callouts: [
      { x: 62.8, y: 49.3, text: 'Upload an EasyEquities PDF or fill in the Excel template.' },
      { x: 63.5, y: 62.2, text: 'Contributions, dividends and expenses from your statement.' },
      { x: 93, y: 95.4, text: 'Download a Portfolio Summary PDF.' },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics',
    chip: 'Analytics',
    route: '/analytics',
    line: 'Sharpe, beta, RSI and more per holding.',
    alt: 'The Analytics page listing CAPM, P/E, Altman Z, Sharpe, beta, Sortino and RSI for each holding.',
    shot: true,
    callouts: [
      { x: 13.2, y: 24.6, text: 'One row for each holding.' },
      { x: 51.4, y: 29.9, text: 'Hover a label for a short explanation.' },
      { x: 89.6, y: 67.3, text: 'Each value gets a plain reading, such as overbought.' },
    ],
  },
  {
    id: 'news',
    name: 'News',
    chip: 'News',
    route: '/news',
    line: 'Stories on your shares and the market.',
    shot: false,
    callouts: [
      { x: 14, y: 33, text: 'Switch between news on your holdings and all market news.' },
      { x: 38, y: 44, text: 'Filter by holding.' },
      { x: 62, y: 15, text: 'Positive, negative and neutral stories counted for today.' },
    ],
  },
  {
    id: 'explore',
    name: 'Explore',
    chip: 'Explore',
    route: '/explore',
    line: 'Similar JSE shares, as ideas to research.',
    shot: false,
    callouts: [
      { x: 18, y: 18, text: 'Nine JSE shares like the ones you hold, each with a match score.' },
      { x: 58, y: 66, text: 'A map of the JSE with lines from your holdings to similar shares.' },
      { x: 84, y: 18, text: 'Ideas to research, not financial advice.' },
    ],
  },
  {
    id: 'assistant',
    name: 'AI Assistant',
    chip: 'Assistant',
    route: '/ai',
    line: 'Ask about your portfolio in plain words.',
    alt: 'The AI Assistant answering which holding adds the most risk to a sample portfolio.',
    shot: true,
    note: "The reply was scripted from this portfolio's figures for the screenshot.",
    callouts: [
      { x: 59, y: 24.3, text: 'Ask about your own holdings.' },
      { x: 29.5, y: 31.3, text: "Answers use your portfolio's figures." },
      { x: 17.4, y: 92, text: 'A daily limit for each user.' },
    ],
  },
];

/** @param {string} id */
export const fullImage = (id) => ({
  src: `/showcase/${id}-1440.webp`,
  srcSet: `/showcase/${id}-1440.webp 1440w, /showcase/${id}-2880.webp 2880w`,
  sizes: '(min-width: 1024px) 760px, 92vw',
});

export const SAMPLE_AMOUNTS = [
  { label: 'Portfolio value', value: 'R 248 310,55' },
  { label: 'Gain this year', value: 'R 19 482,10' },
  { label: 'Dividends', value: 'R 3 597,11' },
];

export const CONTACT_EMAIL = 'thebigfivetb5@gmail.com';
export const REPO_URL = 'https://github.com/COS301-SE-2026/Equity-Lens';
