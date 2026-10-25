// Markets the app knows about. Data for each one is a static snapshot under
// public/data/<id>/, built by scripts/fetch-data.mjs (see README).
export const MARKETS = [
  { id: "us", label: "United States", currency: "USD", available: true },
  { id: "sg", label: "Singapore", currency: "SGD", available: false },
];

const BASE = `${import.meta.env.BASE_URL}data`;
const cache = new Map();

function load(path) {
  if (!cache.has(path)) {
    const request = fetch(`${BASE}/${path}`).then((res) => {
      if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
      return res.json();
    });
    // Let a failed request be retried later.
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return cache.get(path);
}

export const loadMarketIndex = (market) => load(`${market}/index.json`);
export const loadPriceHistory = (market, ticker) => load(`${market}/prices/${ticker}.json`);
