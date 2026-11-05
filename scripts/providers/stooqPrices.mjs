// Stooq daily CSV: free, no key. Used as a fallback price source.

import { fetchText } from "../lib/http.mjs";

// Pure transform: Stooq CSV (Date,Open,High,Low,Close,Volume) -> price snapshot.
export function parseStooqCsv(csv, sinceDate) {
  const lines = csv.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith("Date")) throw new Error("Unexpected Stooq response");
  const history = [];
  for (const line of lines.slice(1)) {
    const [date, , , , close] = line.split(",");
    if (date >= sinceDate && close && !Number.isNaN(Number(close))) history.push([date, Number(close)]);
  }
  if (!history.length) throw new Error("No prices in Stooq response");
  const [asOf, last] = history[history.length - 1];
  return { last, asOf, currency: null, history };
}

export async function fetchPrices(symbol) {
  const since = new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10);
  const csv = await fetchText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=w`, { minIntervalMs: 500 });
  const prices = parseStooqCsv(csv, since);
  return { ...prices, source: { label: "Stooq", url: `https://stooq.com/q/d/?s=${symbol}` } };
}
