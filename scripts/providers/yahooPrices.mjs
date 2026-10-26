// Yahoo Finance chart endpoint: free, no key, covers US and SGX (".SI") tickers.
// Unofficial, so stooqPrices.mjs is used as a fallback for US tickers.

import { fetchJson } from "../lib/http.mjs";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; react_final_project stock analyzer)" };

// Pure transform: Yahoo chart JSON -> { last, asOf, currency, history: [[date, close], ...] }
export function normalizeYahooChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description || "Empty Yahoo chart response");
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const history = [];
  result.timestamp?.forEach((ts, i) => {
    const close = closes[i];
    if (close == null) return;
    history.push([new Date(ts * 1000).toISOString().slice(0, 10), Number(close.toFixed(4))]);
  });
  if (!history.length) throw new Error("No prices in Yahoo chart response");
  const [asOf, last] = history[history.length - 1];
  return { last, asOf, currency: result.meta?.currency || null, history };
}

export async function fetchPrices(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;
  const prices = normalizeYahooChart(await fetchJson(url, { headers: HEADERS }));
  return { ...prices, source: { label: "Yahoo Finance", url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/` } };
}
