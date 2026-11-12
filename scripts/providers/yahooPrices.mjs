// Yahoo Finance chart endpoint: free, no key, covers US and SGX (".SI") tickers.
// Unofficial, so stooqPrices.mjs is used as a fallback for US tickers.

import { fetchJson } from "../lib/http.mjs";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; react_final_project stock analyzer)" };

const sourceFor = (symbol) => ({
  label: "Yahoo Finance",
  url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,
});

// timestamps + closes -> { last, asOf, history: [[date, close], ...] }
function toHistory(timestamps, closes) {
  const history = [];
  timestamps?.forEach((ts, i) => {
    const close = closes[i];
    if (close == null) return;
    history.push([new Date(ts * 1000).toISOString().slice(0, 10), Number(close.toFixed(4))]);
  });
  if (!history.length) return null;
  const [asOf, last] = history[history.length - 1];
  return { last, asOf, history };
}

// Pure transform: Yahoo chart JSON -> { last, asOf, currency, history }
export function normalizeYahooChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description || "Empty Yahoo chart response");
  const prices = toHistory(result.timestamp, result.indicators?.quote?.[0]?.close ?? []);
  if (!prices) throw new Error("No prices in Yahoo chart response");
  return { ...prices, currency: result.meta?.currency || null };
}

// Pure transform: Yahoo spark JSON (many symbols) -> Map(symbol -> { last, asOf, currency, history }).
// Accepts both response shapes Yahoo uses: v8 { SYM: { timestamp, close } } and
// v7 { spark: { result: [{ symbol, response: [chart result] }] } }.
export function normalizeYahooSpark(json) {
  const out = new Map();
  const add = (symbol, timestamps, closes, currency) => {
    const prices = toHistory(timestamps, closes ?? []);
    if (symbol && prices) out.set(symbol, { ...prices, currency: currency || null });
  };
  if (Array.isArray(json?.spark?.result)) {
    for (const r of json.spark.result) {
      const chart = r.response?.[0];
      add(r.symbol, chart?.timestamp, chart?.indicators?.quote?.[0]?.close, chart?.meta?.currency);
    }
  } else if (json && typeof json === "object") {
    for (const [symbol, r] of Object.entries(json)) add(r?.symbol ?? symbol, r?.timestamp, r?.close, r?.currency);
  }
  return out;
}

// Yahoo's spark endpoint returns up to 20 symbols per request, so ~6,000
// companies take ~300 requests (a few minutes) instead of ~6,000.
export const SPARK_BATCH = 20;

export async function fetchPricesBatch(symbols) {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/spark?range=5y&interval=1wk&symbols=" +
    symbols.map(encodeURIComponent).join(",");
  const found = normalizeYahooSpark(await fetchJson(url, { headers: HEADERS, minIntervalMs: 500 }));
  return new Map([...found].map(([symbol, p]) => [symbol, { ...p, source: sourceFor(symbol) }]));
}

export async function fetchPrices(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1wk`;
  // About 2 requests a second: Yahoo has no bulk download and is unofficial, so stay gentle.
  const prices = normalizeYahooChart(await fetchJson(url, { headers: HEADERS, minIntervalMs: 500 }));
  return { ...prices, source: sourceFor(symbol) };
}
