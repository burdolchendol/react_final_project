import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { factsProfile, normalizeCompanyFacts } from "../scripts/providers/secEdgar.mjs";
import { convertYearsToUsd, rateOn } from "../scripts/lib/fx.mjs";
import { fetchFxRates } from "../scripts/providers/defeatBetaPrices.mjs";
import { computeMetrics } from "../src/final_project/utils/metrics.js";

const fy = (start, end, val) => ({
  start,
  end,
  val,
  filed: `${Number(end.slice(0, 4)) + 1}-04-01`,
  form: "20-F",
  fp: "FY",
  accn: "0000000002-24-000001",
});
const inst = (end, val) => ({ end, val, filed: `${Number(end.slice(0, 4)) + 1}-04-01`, form: "20-F", fp: "FY" });

// An IFRS filer reporting in Taiwan dollars.
const ifrsFacts = {
  facts: {
    "ifrs-full": {
      Revenue: { units: { TWD: [fy("2024-01-01", "2024-12-31", 3000)] } },
      ProfitLossAttributableToOwnersOfParent: { units: { TWD: [fy("2024-01-01", "2024-12-31", 300)] } },
      DilutedEarningsLossPerShare: { units: { "TWD/shares": [fy("2024-01-01", "2024-12-31", 30)] } },
      Assets: { units: { TWD: [inst("2024-12-31", 6000)] } },
      CurrentAssets: { units: { TWD: [inst("2024-12-31", 2000)] } },
      CurrentLiabilities: { units: { TWD: [inst("2024-12-31", 1000)] } },
      EquityAttributableToOwnersOfParent: { units: { TWD: [inst("2024-12-31", 4000)] } },
      CashAndCashEquivalents: { units: { TWD: [inst("2024-12-31", 900)] } },
    },
  },
};

test("factsProfile detects IFRS, the reporting currency and a foreign filer", () => {
  assert.deepEqual(factsProfile(ifrsFacts), { taxonomy: "ifrs-full", currency: "TWD", foreign: true });
  const us = { facts: { "us-gaap": { Assets: { units: { USD: [{ end: "2024-12-31", val: 1, form: "10-K" }] } } } } };
  assert.deepEqual(factsProfile(us), { taxonomy: "us-gaap", currency: "USD", foreign: false });
});

test("normalizeCompanyFacts reads IFRS concepts in the reporting currency", () => {
  const [year] = normalizeCompanyFacts(ifrsFacts);
  assert.equal(year.revenue, 3000);
  assert.equal(year.netIncome, 300);
  assert.equal(year.epsDiluted, 30);
  assert.equal(year.currentAssets, 2000);
  assert.equal(year.equity, 4000);
  assert.equal(year.cash, 900);
});

test("convertYearsToUsd uses the year-end rate and leaves share counts alone", () => {
  const years = [{ periodEnd: "2024-12-31", revenue: 3000, epsDiluted: 30, dilutedShares: 10 }];
  const series = [["2024-12-30", 30], ["2025-01-02", 32]];
  assert.equal(rateOn(series, "2024-12-31"), 30);
  const [usd] = convertYearsToUsd(years, "TWD", series);
  assert.equal(usd.revenue, 100);
  assert.equal(usd.epsDiluted, 1);
  assert.equal(usd.dilutedShares, 10);
  assert.equal(convertYearsToUsd(years, "TWD", []), null);
  assert.equal(convertYearsToUsd(years, "USD", null), years);
});

test("foreign filers keep balance-sheet ratios but hide price ratios", () => {
  const fiscalYears = [{ fiscalYear: 2024, periodEnd: "2024-12-31", revenue: 100, netIncome: 10, epsDiluted: 1,
    dilutedShares: 10, currentAssets: 40, currentLiabilities: 20, equity: 50 }];
  const m = computeMetrics({ fiscalYears, price: { last: 20 }, foreign: true });
  assert.equal(m.currentRatio, 2);
  assert.equal(m.roe, 0.2);
  assert.equal(m.revenue, 100);
  assert.equal(m.pe, null);
  assert.equal(m.intrinsicValue, null);
  // Not converted to USD: dollar amounts hidden too, ratios still shown.
  const raw = computeMetrics({ fiscalYears, price: { last: 20 }, foreign: true, financialCurrency: "TWD" });
  assert.equal(raw.revenue, null);
  assert.equal(raw.currentRatio, 2);
});

test("fetchFxRates reads Yahoo-style currency symbols from the parquet file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fx-"));
  try {
    const instance = await DuckDBInstance.create(":memory:");
    const db = await instance.connect();
    await db.run(`COPY (SELECT * FROM (VALUES
      ('TWD=X', '2024-12-30', 32.5::DECIMAL(16,4)),
      ('TWD=X', '2024-12-31', 32.8::DECIMAL(16,4)),
      ('EUR=X', '2024-12-31', 0.96::DECIMAL(16,4))
    ) t(symbol, report_date, close)) TO '${join(dir, "exchange_rate.parquet")}' (FORMAT parquet)`);
    db.closeSync();
    instance.closeSync();
    const rates = await fetchFxRates(["TWD", "USD", "JPY"], { fileDir: dir, cacheDir: dir });
    assert.deepEqual([...rates.keys()], ["TWD"]);
    assert.deepEqual(rates.get("TWD"), [["2024-12-30", 32.5], ["2024-12-31", 32.8]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
