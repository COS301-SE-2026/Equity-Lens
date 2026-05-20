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
    "I'm a demo assistant (Send a keyword to receive a prompt)",
};

// Card snapshots
const TICKERS = {
  npn: { symbol: 'NPN', name: 'Naspers', aliases: ['naspers'], price: 3842.5, changePct: 1.84 },
  mtn: { symbol: 'MTN', name: 'MTN Group', aliases: ['mtn group'], price: 84.17, changePct: -2.05 },
  sol: { symbol: 'SOL', name: 'Sasol', aliases: ['sasol'], price: 138.6, changePct: 0.92 },
  fsr: { symbol: 'FSR', name: 'FirstRand', aliases: ['firstrand', 'first rand'], price: 71.34, changePct: 0.41 },
};

// Maps TICKERS entry onto the StockTickerCard
const toCard = (t) => ({
  ticker: t.symbol,
  name: t.name,
  price: t.price,
  changePercent: t.changePct,
});

// portfolio vs JSE comparison.
const PORTFOLIO_VS_JSE = { portfolio: 8.42, jse: 5.17 };

export const getMockResponse = (rawInput) => {
  const text = normalize(rawInput);

  if (/\b(hi|hello|hey)\b/.test(text)) {
    return {
      text: "Hi. Good day",
    };
  }

  if (/\bcards?\b/.test(text)) {
    return {
      text: 'Here are your stock cards:',
      cards: Object.values(TICKERS).map(toCard),
    };
  }

  if (
    /\bportfolio\b/.test(text) &&
    /\b(jse|benchmark|all share|compar)/.test(text)
  ) {
    const { portfolio, jse } = PORTFOLIO_VS_JSE;
    const delta = portfolio - jse;
    const verb = delta >= 0 ? 'Outperforming' : 'Underperforming';
    return {
      text: `Your portfolio is up ${portfolio.toFixed(2)}% YTD versus the JSE All Share at ${jse.toFixed(2)}%. `,
      trend: delta >= 0 ? 'up' : 'down',
      changeText: `${verb} the benchmark by ${Math.abs(delta).toFixed(2)}%.`,
    };
  }

  for (const key of Object.keys(TICKERS)) {
    const t = TICKERS[key];
    const keywords = [key, ...t.aliases];
    if (keywords.some((word) => new RegExp(`\\b${word}\\b`).test(text))) {
      return {
        text: `${t.name} (${t.symbol}) is trading at R${t.price.toFixed(2)}, `,
        changeText: `${Math.abs(t.changePct).toFixed(2)}% on the day.`,
        trend: t.changePct >= 0 ? 'up' : 'down',
      };
    }
  }

  return FALLBACK;
};
