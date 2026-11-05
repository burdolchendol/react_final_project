// Shared by scripts/fetch-data.mjs (writer) and the app (reader).
// index.json stores each company's recent fiscal years as compact rows,
// [fiscalYear, periodEnd, ...INDEX_FIELDS], to keep thousands of companies small.

export const INDEX_FIELDS = [
  "revenue", "netIncome", "epsDiluted", "dilutedShares", "totalAssets", "totalLiabilities",
  "currentAssets", "currentLiabilities", "equity", "longTermDebt", "operatingCashFlow",
  "capex", "dividendsPerShare", "dividendsPaid",
];

// Metrics look back at most 11 years (10-year growth), so the index keeps that many.
export const INDEX_YEARS = 11;

export const toRow = (y) => [y.fiscalYear, y.periodEnd, ...INDEX_FIELDS.map((f) => y[f] ?? null)];

export function fromRow(row, fields = INDEX_FIELDS) {
  const year = { fiscalYear: row[0], periodEnd: row[1] };
  fields.forEach((f, i) => (year[f] = row[i + 2]));
  return year;
}

// Per-company file name (tickers can contain characters unsafe in paths).
export const companyFile = (ticker) => `${ticker.replace(/[^A-Za-z0-9.-]/g, "_")}.json`;
