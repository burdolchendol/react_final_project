/* ============================================================
   METRICS
   Turns one company snapshot (see public/data/<market>/index.json)
   into the ratios the rules and tables use. Every metric is a
   plain number, or null when the data needed is missing.
============================================================ */

// Catalog used by the tables and the rules editor.
// format: "x" ratio, "pct" fraction shown as %, "money", "years", "count"
export const METRICS = {
  price: { label: "Price", format: "money" },
  currentAssets: { label: "Current assets", format: "money" },
  currentLiabilities: { label: "Current liabilities", format: "money" },
  cash: { label: "Cash & equivalents", format: "money" },
  totalDebt: { label: "Total debt", format: "money", hint: "Long-term debt plus debt due within a year" },
  equity: { label: "Shareholders' equity", format: "money" },
  intangiblesGoodwill: { label: "Intangibles & goodwill", format: "money" },
  marketCap: { label: "Market cap", format: "money" },
  revenue: { label: "Revenue (latest FY)", format: "money" },
  pe: { label: "P/E (latest EPS)", format: "x" },
  pe3: { label: "P/E (3-yr avg EPS)", format: "x" },
  pb: { label: "P/B", format: "x" },
  grahamMultiplier: { label: "P/E × P/B", format: "x", hint: "Graham's combined limit is 22.5" },
  currentRatio: { label: "Current ratio", format: "x" },
  debtToNetCurrentAssets: { label: "LT debt ÷ net current assets", format: "x" },
  debtToEquity: { label: "Debt / equity", format: "x", hint: "Long-term debt ÷ shareholders' equity" },
  liabilitiesToEquity: { label: "Liabilities / equity", format: "x" },
  roe: { label: "Return on equity", format: "pct" },
  netMargin: { label: "Net margin", format: "pct" },
  revenueCagr: { label: "Revenue growth (CAGR)", format: "pct" },
  epsCagr: { label: "EPS growth (CAGR)", format: "pct" },
  epsGrowth10y: { label: "EPS growth, 3-yr avg vs 10 yrs ago", format: "pct" },
  positiveEpsYears: { label: "Years of positive earnings (in a row)", format: "years" },
  dividendYears: { label: "Years of dividends (in a row)", format: "years" },
  dividendYield: { label: "Dividend yield", format: "pct" },
  fcfYield: { label: "Free cash flow yield", format: "pct" },
  grahamNumber: { label: "Graham number", format: "money" },
  intrinsicValue: { label: "Intrinsic value (Graham formula)", format: "money" },
  marginOfSafety: { label: "Margin of safety", format: "pct" },
};

export const DEFAULT_SETTINGS = {
  // Graham's revised formula scales by 4.4 / current AAA corporate bond yield.
  aaaYield: 5.0,
  // Cap on the growth rate fed into the intrinsic value formula, in %.
  maxGrowth: 15,
};

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const ratio = (a, b) => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);
const avg = (xs) => (xs.length && xs.every(isNum) ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// Compound annual growth between the first and last value, over `years` years.
function cagr(first, last, years) {
  if (!isNum(first) || !isNum(last) || first <= 0 || last <= 0 || years <= 0) return null;
  return (last / first) ** (1 / years) - 1;
}

// Growth over (up to) the last `span` fiscal years.
function seriesCagr(years, field, span = 10) {
  const rows = years.filter((y) => isNum(y[field])).slice(-(span + 1));
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  return cagr(first[field], last[field], last.fiscalYear - first.fiscalYear);
}

// How many of the most recent years in a row satisfy `test`.
function streak(years, test) {
  let n = 0;
  for (let i = years.length - 1; i >= 0 && test(years[i]); i--) n++;
  return n;
}

// Long-term debt (non-current) plus debt due within a year; null when nothing is reported.
export function totalDebtOf(y) {
  const current = isNum(y.debtCurrent)
    ? y.debtCurrent
    : isNum(y.longTermDebtCurrent) || isNum(y.shortTermBorrowings)
      ? (y.longTermDebtCurrent ?? 0) + (y.shortTermBorrowings ?? 0)
      : null;
  if (!isNum(y.longTermDebt) && current == null) return null;
  return (y.longTermDebt ?? 0) + (current ?? 0);
}

export function intangiblesGoodwillOf(y) {
  if (isNum(y.goodwill) || isNum(y.intangibles)) return (y.goodwill ?? 0) + (y.intangibles ?? 0);
  return isNum(y.intangiblesInclGoodwill) ? y.intangiblesInclGoodwill : null;
}

const epsOf = (y) => (isNum(y.epsDiluted) ? y.epsDiluted : ratio(y.netIncome, y.dilutedShares));

export function computeMetrics(company, settings = DEFAULT_SETTINGS) {
  const years = company.fiscalYears ?? [];
  const latest = years[years.length - 1] ?? {};
  const price = company.price?.last ?? null;

  const eps = epsOf(latest);
  const recentEps = years.slice(-3).map(epsOf);
  const avgEps3 = recentEps.length === 3 ? avg(recentEps) : null;

  const shares = latest.dilutedShares;
  const bvps = ratio(latest.equity, shares);
  const pe = eps > 0 ? ratio(price, eps) : null;
  const pe3 = avgEps3 > 0 ? ratio(price, avgEps3) : null;
  const pb = bvps > 0 ? ratio(price, bvps) : null;

  const netCurrentAssets =
    isNum(latest.currentAssets) && isNum(latest.currentLiabilities)
      ? latest.currentAssets - latest.currentLiabilities
      : null;
  let debtToNetCurrentAssets = null;
  if (isNum(latest.longTermDebt) && isNum(netCurrentAssets)) {
    debtToNetCurrentAssets = netCurrentAssets > 0 ? latest.longTermDebt / netCurrentAssets : Infinity;
  }

  // Graham: average EPS of the last 3 years vs the 3 years a decade earlier.
  const window = years.slice(-11);
  const oldAvg = window.length >= 6 ? avg(window.slice(0, 3).map(epsOf)) : null;
  const epsGrowth10y = avgEps3 != null && oldAvg > 0 ? avgEps3 / oldAvg - 1 : null;

  const epsCagr = seriesCagr(years.map((y) => ({ ...y, eps: epsOf(y) })), "eps");
  const marketCap = isNum(price) && isNum(shares) ? price * shares : null;
  const fcf =
    isNum(latest.operatingCashFlow) && isNum(latest.capex) ? latest.operatingCashFlow - latest.capex : null;

  // Graham's revised formula: V = EPS × (8.5 + 2g) × 4.4 / Y
  let intrinsicValue = null;
  if (avgEps3 > 0) {
    const g = Math.min(Math.max((epsCagr ?? 0) * 100, 0), settings.maxGrowth);
    intrinsicValue = (avgEps3 * (8.5 + 2 * g) * 4.4) / settings.aaaYield;
  }

  return {
    price,
    currentAssets: latest.currentAssets ?? null,
    currentLiabilities: latest.currentLiabilities ?? null,
    cash: latest.cash ?? null,
    totalDebt: years.length ? totalDebtOf(latest) : null,
    equity: latest.equity ?? null,
    intangiblesGoodwill: years.length ? intangiblesGoodwillOf(latest) : null,
    marketCap,
    revenue: latest.revenue ?? null,
    eps,
    avgEps3,
    bvps,
    pe,
    pe3,
    pb,
    grahamMultiplier: pe3 != null && pb != null ? pe3 * pb : null,
    currentRatio: ratio(latest.currentAssets, latest.currentLiabilities),
    netCurrentAssets,
    debtToNetCurrentAssets,
    debtToEquity: latest.equity > 0 ? ratio(latest.longTermDebt, latest.equity) : null,
    liabilitiesToEquity: latest.equity > 0 ? ratio(latest.totalLiabilities, latest.equity) : null,
    roe: latest.equity > 0 ? ratio(latest.netIncome, latest.equity) : null,
    netMargin: ratio(latest.netIncome, latest.revenue),
    revenueCagr: seriesCagr(years, "revenue"),
    epsCagr,
    epsGrowth10y,
    positiveEpsYears: years.length ? streak(years, (y) => epsOf(y) > 0) : null,
    dividendYears: years.length ? streak(years, (y) => y.dividendsPerShare > 0 || y.dividendsPaid > 0) : null,
    dividendYield: isNum(latest.dividendsPerShare) ? ratio(latest.dividendsPerShare, price) : null,
    fcf,
    fcfYield: ratio(fcf, marketCap),
    grahamNumber: eps > 0 && bvps > 0 ? Math.sqrt(22.5 * eps * bvps) : null,
    intrinsicValue,
    marginOfSafety: intrinsicValue != null && isNum(price) ? (intrinsicValue - price) / intrinsicValue : null,
    yearsOfData: years.length,
  };
}
