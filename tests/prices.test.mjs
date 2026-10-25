import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeYahooChart } from "../scripts/providers/yahooPrices.mjs";
import { parseStooqCsv } from "../scripts/providers/stooqPrices.mjs";

test("normalizeYahooChart skips null closes and returns the last close", () => {
  const json = {
    chart: {
      result: [
        {
          meta: { currency: "USD" },
          timestamp: [1704205800, 1704292200, 1704378600],
          indicators: { quote: [{ close: [185.64, null, 181.91] }] },
        },
      ],
    },
  };
  const p = normalizeYahooChart(json);
  assert.equal(p.history.length, 2);
  assert.equal(p.last, 181.91);
  assert.equal(p.asOf, "2024-01-04");
  assert.equal(p.currency, "USD");
});

test("normalizeYahooChart surfaces API errors", () => {
  assert.throws(() => normalizeYahooChart({ chart: { result: null, error: { description: "No data found" } } }), /No data found/);
});

test("parseStooqCsv filters by date", () => {
  const csv = "Date,Open,High,Low,Close,Volume\n2019-01-02,1,1,1,10,5\n2024-01-02,1,1,1,20,5\n";
  const p = parseStooqCsv(csv, "2020-01-01");
  assert.deepEqual(p.history, [["2024-01-02", 20]]);
  assert.equal(p.last, 20);
});
