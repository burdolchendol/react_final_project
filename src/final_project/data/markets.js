import { fromRow, companyFile } from "./snapshotFormat.js";

// Markets the app knows about. Data for each one is a static snapshot under
// public/data/<id>/, built by scripts/fetch-data.mjs (see README).
export const MARKETS = [
  { id: "us", label: "United States", currency: "USD", available: true },
  { id: "sg", label: "Singapore", currency: "SGD", available: false },
];

const BASE = `${import.meta.env.BASE_URL}data`;
const cache = new Map();

function load(path, { optional = false } = {}) {
  if (!cache.has(path)) {
    const request = fetch(`${BASE}/${path}`).then((res) => {
      if (res.status === 404 && optional) return null;
      if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`);
      return res.json();
    });
    // Let a failed request be retried later.
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return cache.get(path);
}

const expanded = new Map();

// The index stores fiscal years as compact rows; expand them once into objects.
export function loadMarketIndex(market) {
  if (!expanded.has(market)) {
    const request = load(`${market}/index.json`, { optional: true }).then((index) => {
      if (!index) return { market, generatedAt: null, companies: [], failures: [] };
      const companies = index.companies.map(({ years, ...c }) => ({
        ...c,
        fiscalYears: years.map((row) => fromRow(row, index.fields)),
      }));
      return { ...index, companies };
    });
    request.catch(() => expanded.delete(market));
    expanded.set(market, request);
  }
  return expanded.get(market);
}

// Loaded only when a company page opens, so the screener stays light.
// Full fiscal history, with the SEC filing (accession number) behind every value.
export const loadCompanyDetail = (market, ticker) => load(`${market}/companies/${companyFile(ticker)}`);
// { history: [[date, close], ...], source }, or null when no price was found.
export const loadPriceHistory = (market, ticker) =>
  load(`${market}/prices/${companyFile(ticker)}`, { optional: true });
