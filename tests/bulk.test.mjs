import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { bulkFundamentals } from "../scripts/providers/secEdgar.mjs";
import { mapPool } from "../scripts/lib/http.mjs";
import { toRow, fromRow, companyFile } from "../src/final_project/data/snapshotFormat.js";

const zipDir = fileURLToPath(new URL("./fixtures/", import.meta.url));

test("bulkFundamentals reads only the requested companies straight from the zip", async () => {
  const companies = [
    { ticker: "TST", cik: "0000000001", name: "Test", exchange: "NYSE" },
    { ticker: "BAD", cik: "0000000003", name: "Broken", exchange: "Nasdaq" },
  ];
  const out = [];
  for await (const item of bulkFundamentals(companies, { zipDir, withSectors: false, keepZips: false })) out.push(item);
  // CIK 2 wasn't asked for; CIK 3 is malformed and skipped.
  assert.equal(out.length, 1);
  assert.equal(out[0].company.ticker, "TST");
  assert.equal(out[0].fundamentals.name, "Test Corp");
  assert.deepEqual(out[0].fundamentals.fiscalYears.map((y) => [y.revenue, y.netIncome]), [[100, 10]]);
});

test("a zip the user supplied is never deleted", async () => {
  const { existsSync } = await import("node:fs");
  for await (const _ of bulkFundamentals([], { zipDir, withSectors: false, keepZips: false })) void _;
  assert.ok(existsSync(`${zipDir}/companyfacts.zip`));
});

test("index rows round-trip", () => {
  const year = { fiscalYear: 2024, periodEnd: "2024-12-31", revenue: 5, epsDiluted: 1.2, accn: { revenue: "x" } };
  const back = fromRow(toRow(year));
  assert.equal(back.revenue, 5);
  assert.equal(back.epsDiluted, 1.2);
  assert.equal(back.netIncome, null);
  assert.equal(back.accn, undefined);
});

test("companyFile makes tickers safe for paths", () => {
  assert.equal(companyFile("BRK-B"), "BRK-B.json");
  assert.equal(companyFile("A/B"), "A_B.json");
});

test("mapPool keeps order and limits concurrency", async () => {
  let active = 0;
  let peak = 0;
  const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
    peak = Math.max(peak, ++active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});
