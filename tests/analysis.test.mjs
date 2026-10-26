import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, DEFAULT_SETTINGS } from "../src/final_project/utils/metrics.js";
import { DEFAULT_RULES, evaluateRules } from "../src/final_project/utils/rules.js";

// 11 fiscal years of a steady, conservatively financed company.
const fiscalYears = Array.from({ length: 11 }, (_, i) => ({
  fiscalYear: 2014 + i,
  periodEnd: `${2014 + i}-12-31`,
  revenue: 5e9 * 1.05 ** i,
  netIncome: 5e8 * 1.05 ** i,
  epsDiluted: 5 * 1.05 ** i,
  dilutedShares: 1e8,
  totalAssets: 8e9,
  totalLiabilities: 3e9,
  currentAssets: 4e9,
  currentLiabilities: 1.5e9,
  equity: 5e9,
  longTermDebt: 1e9,
  operatingCashFlow: 7e8,
  capex: 2e8,
  dividendsPerShare: 2,
  dividendsPaid: 2e8,
}));
const company = { fiscalYears, price: { last: 90, asOf: "2025-01-02" } };

test("computeMetrics derives core ratios", () => {
  const m = computeMetrics(company);
  const latestEps = 5 * 1.05 ** 10;
  assert.ok(Math.abs(m.pe - 90 / latestEps) < 1e-9);
  assert.equal(m.pb, 90 / 50);
  assert.equal(m.currentRatio, 4e9 / 1.5e9);
  assert.equal(m.debtToNetCurrentAssets, 1e9 / 2.5e9);
  assert.equal(m.debtToEquity, 0.2);
  assert.ok(Math.abs(m.revenueCagr - 0.05) < 1e-9);
  assert.ok(Math.abs(m.epsCagr - 0.05) < 1e-9);
  assert.equal(m.positiveEpsYears, 11);
  assert.equal(m.dividendYears, 11);
  assert.equal(m.marketCap, 9e9);
  assert.equal(m.fcf, 5e8);
});

test("intrinsic value follows Graham's revised formula", () => {
  const m = computeMetrics(company, DEFAULT_SETTINGS);
  const g = 5; // 5% EPS CAGR
  const expected = (m.avgEps3 * (8.5 + 2 * g) * 4.4) / DEFAULT_SETTINGS.aaaYield;
  assert.ok(Math.abs(m.intrinsicValue - expected) < 1e-9);
  assert.ok(Math.abs(m.marginOfSafety - (expected - 90) / expected) < 1e-9);
});

test("negative working capital makes the debt test fail rather than vanish", () => {
  const years = fiscalYears.map((y) => ({ ...y, currentLiabilities: 5e9 }));
  assert.equal(computeMetrics({ ...company, fiscalYears: years }).debtToNetCurrentAssets, Infinity);
});

test("missing data yields null metrics, and rules report them as n/a", () => {
  const m = computeMetrics({ fiscalYears: [], price: null });
  assert.equal(m.pe, null);
  const verdict = evaluateRules(DEFAULT_RULES, m);
  assert.equal(verdict.passed, 0);
  assert.equal(verdict.applicable, 0);
  assert.ok(verdict.results.every((r) => r.status === "na"));
});

test("default Graham rules pass for the steady company", () => {
  const verdict = evaluateRules(DEFAULT_RULES, computeMetrics(company));
  const failed = verdict.results.filter((r) => r.status !== "pass").map((r) => r.rule.id);
  assert.deepEqual(failed, []);
  assert.equal(verdict.total, DEFAULT_RULES.filter((r) => r.enabled).length);
});

test("secFilingUrl builds the EDGAR filing index link", async () => {
  const { secFilingUrl } = await import("../src/final_project/utils/sources.js");
  assert.equal(
    secFilingUrl("0000320193", "0000320193-24-000123"),
    "https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/0000320193-24-000123-index.htm"
  );
  assert.equal(secFilingUrl(null, "x"), null);
});
