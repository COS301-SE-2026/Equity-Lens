// Keyword mock responses for demo.
// More categories are added in later commits.

export const normalize = (input = '') =>
  input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Returned when no keyword matches.
const FALLBACK = {
  text:
    "I'm a demo assistant (Send hi/hello/hey or get fallback message)",
};

// Card snapshots
const TICKERS = {
  npn: { symbol: 'NPN', name: 'Naspers', aliases: ['naspers'], price: 3842.5, changePct: 1.84 },
  mtn: { symbol: 'MTN', name: 'MTN Group', aliases: ['mtn group'], price: 84.17, changePct: -2.05 },
  sol: { symbol: 'SOL', name: 'Sasol', aliases: ['sasol'], price: 138.6, changePct: 0.92 },
  fsr: { symbol: 'FSR', name: 'FirstRand', aliases: ['firstrand', 'first rand'], price: 71.34, changePct: 0.41 },
};

export const getMockResponse = (rawInput) => {
  const text = normalize(rawInput);

  if (/\b(hi|hello|hey)\b/.test(text)) {
    return {
      text: "Hi. Good day",
    };
  }

  for (const key of Object.keys(TICKERS)) {
    const t = TICKERS[key];
    const keywords = [key, ...t.aliases];
    if (keywords.some((word) => new RegExp(`\\b${word}\\b`).test(text))) {
      return {
        text: `${t.name} (${t.symbol}) is trading at R${t.price.toFixed(2)}, ${Math.abs(t.changePct).toFixed(2)}% on the day.`,
        trend: t.changePct >= 0 ? 'up' : 'down',
      };
    }
  }

  return FALLBACK;
};
