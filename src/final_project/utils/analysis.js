import { generateHistory } from "../data/mockStocks";

/* ============================================================
   ANALYSIS HELPERS
============================================================ */

// Simple Moving Average: average of the last `window` closes,
// computed for every point in the series (null until enough data).
export function simpleMovingAverage(history, window) {
  return history.map((point, i) => {
    if (i < window - 1) return null;
    const slice = history.slice(i - window + 1, i + 1);
    const avg = slice.reduce((sum, p) => sum + p.close, 0) / window;
    return Number(avg.toFixed(2));
  });
}

// Takes one entry from STOCKS_META and returns it enriched with
// generated history, moving averages, latest price, and % change.
export function analyzeStock(meta) {
  const history = generateHistory(meta.basePrice, meta.seed);
  const sma20 = simpleMovingAverage(history, 20);
  const sma50 = simpleMovingAverage(history, 50);

  const chartData = history.map((point, i) => ({
    ...point,
    sma20: sma20[i],
    sma50: sma50[i],
  }));

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const changePct = ((latest.close - prev.close) / prev.close) * 100;

  return { ...meta, chartData, latestClose: latest.close, changePct };
}

// Shared number formatter (e.g. 1234.5 -> "1,234.50")
export const fmt = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
