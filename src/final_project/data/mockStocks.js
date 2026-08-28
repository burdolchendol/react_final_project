/* ============================================================
   MOCK DATA
   This is the "format" you'd get from a real stock API.
   Each stock is an object with a ticker, name, sector, and a
   basePrice/seed used to generate a history array of
   { date, close, volume }. If you later swap in a real API
   (Alpha Vantage, Finnhub, etc), just make sure the data you
   fetch gets reshaped into { date, close, volume } per point —
   everything else (charts, moving averages, sorting) keeps
   working without changes.
============================================================ */

export const STOCKS_META = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", basePrice: 189, seed: 1 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", basePrice: 412, seed: 2 },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Technology", basePrice: 165, seed: 3 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer", basePrice: 178, seed: 4 },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Automotive", basePrice: 242, seed: 5 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", basePrice: 118, seed: 6 },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Finance", basePrice: 198, seed: 7 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", basePrice: 152, seed: 8 },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer", basePrice: 64, seed: 9 },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy", basePrice: 112, seed: 10 },
];

// Deterministic pseudo-random generator so the "fake" data looks
// the same every time you reload, instead of jumping around
// randomly (makes it much easier to debug your analysis code).
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateHistory(basePrice, seed, days = 90) {
  const rand = mulberry32(seed * 977);
  const history = [];
  let price = basePrice;
  const start = new Date();
  start.setDate(start.getDate() - days);

  for (let i = 0; i < days; i++) {
    // random daily drift between -2.2% and +2.2%
    const drift = (rand() - 0.5) * 0.044;
    price = Math.max(1, price * (1 + drift));
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    history.push({
      date: date.toISOString().slice(0, 10),
      close: Number(price.toFixed(2)),
      volume: Math.floor(1_000_000 + rand() * 20_000_000),
    });
  }
  return history;
}
