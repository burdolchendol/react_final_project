// Converts a foreign filer's fiscal years into USD so they can be compared with
// US companies. Each year uses the exchange rate at its period end.

import { FIELD_CONCEPTS } from "../providers/secEdgar.mjs";

const CONVERTED = Object.entries(FIELD_CONCEPTS)
  .filter(([, spec]) => spec.unit === "money" || spec.unit === "perShare")
  .map(([field]) => field);

// series: ascending [[date, unitsPerUsd], ...]. Uses the last rate on or before
// `date`, or the first one after it when the series starts later.
export function rateOn(series, date) {
  if (!series?.length) return null;
  let rate = series[0][1];
  for (const [d, r] of series) {
    if (d > date) break;
    rate = r;
  }
  return rate;
}

// Returns the years in USD, or null when there is no rate for `currency`.
export function convertYearsToUsd(years, currency, series) {
  if (currency === "USD") return years;
  if (!series?.length) return null;
  return years.map((y) => {
    const rate = rateOn(series, y.periodEnd);
    const out = { ...y, fxRate: rate };
    for (const field of CONVERTED) if (typeof y[field] === "number") out[field] = y[field] / rate;
    return out;
  });
}
