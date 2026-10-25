/* ============================================================
   RULES
   A rule is "metric <op> threshold". The defaults follow Benjamin
   Graham's seven tests for the defensive investor (The Intelligent
   Investor, ch. 14), plus a few modern checks switched off by default.
   Users edit these on the "My Rules" page; they live in localStorage.
============================================================ */

export const DEFAULT_RULES = [
  {
    id: "size",
    label: "Adequate size",
    metric: "revenue",
    op: ">=",
    threshold: 2_000_000_000,
    enabled: true,
    why: "Graham avoided small companies; $2B of annual sales is a common modern equivalent of his cut-off.",
  },
  {
    id: "current-ratio",
    label: "Strong financial condition",
    metric: "currentRatio",
    op: ">=",
    threshold: 2,
    enabled: true,
    why: "Current assets at least twice current liabilities.",
  },
  {
    id: "debt-vs-nca",
    label: "Debt covered by working capital",
    metric: "debtToNetCurrentAssets",
    op: "<=",
    threshold: 1,
    enabled: true,
    why: "Long-term debt should not exceed net current assets.",
  },
  {
    id: "earnings-stability",
    label: "Earnings stability",
    metric: "positiveEpsYears",
    op: ">=",
    threshold: 10,
    enabled: true,
    why: "Positive earnings in each of the past 10 years.",
  },
  {
    id: "dividend-record",
    label: "Dividend record",
    metric: "dividendYears",
    op: ">=",
    threshold: 10,
    enabled: true,
    why: "Uninterrupted dividends (Graham asked for 20 years; SEC XBRL data goes back to about 2009).",
  },
  {
    id: "earnings-growth",
    label: "Earnings growth",
    metric: "epsGrowth10y",
    op: ">=",
    threshold: 0.33,
    enabled: true,
    why: "At least one-third growth in 3-year average EPS over ten years.",
  },
  {
    id: "moderate-pe",
    label: "Moderate P/E",
    metric: "pe3",
    op: "<=",
    threshold: 15,
    enabled: true,
    why: "Price no more than 15× average earnings of the past 3 years.",
  },
  {
    id: "moderate-pb",
    label: "Moderate price to assets",
    metric: "grahamMultiplier",
    op: "<=",
    threshold: 22.5,
    enabled: true,
    why: "P/E × P/B no more than 22.5 (equivalent to P/E 15 with P/B 1.5).",
  },
  {
    id: "margin-of-safety",
    label: "Margin of safety",
    metric: "marginOfSafety",
    op: ">=",
    threshold: 0.25,
    enabled: false,
    why: "Price at least 25% below the Graham-formula intrinsic value.",
  },
  {
    id: "roe",
    label: "Return on equity",
    metric: "roe",
    op: ">=",
    threshold: 0.15,
    enabled: false,
    why: "Profitable use of shareholders' money.",
  },
  {
    id: "debt-to-equity",
    label: "Low leverage",
    metric: "debtToEquity",
    op: "<=",
    threshold: 0.5,
    enabled: false,
    why: "Long-term debt at most half of equity.",
  },
  {
    id: "revenue-growth",
    label: "Growing sales",
    metric: "revenueCagr",
    op: ">=",
    threshold: 0.05,
    enabled: false,
    why: "Revenue compounding at 5% a year or better.",
  },
];

// "pass" | "fail" | "na" (data missing for this company)
export function evaluateRule(rule, metrics) {
  const value = metrics[rule.metric];
  if (value == null || Number.isNaN(value)) return { status: "na", value: null };
  const pass = rule.op === "<=" ? value <= rule.threshold : value >= rule.threshold;
  return { status: pass ? "pass" : "fail", value };
}

export function evaluateRules(rules, metrics) {
  const results = rules
    .filter((r) => r.enabled)
    .map((rule) => ({ rule, ...evaluateRule(rule, metrics) }));
  const passed = results.filter((r) => r.status === "pass").length;
  const applicable = results.filter((r) => r.status !== "na").length;
  return { results, passed, applicable, total: results.length };
}
