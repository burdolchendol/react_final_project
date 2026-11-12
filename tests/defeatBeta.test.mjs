import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { fetchPricesBulk } from "../scripts/providers/defeatBetaPrices.mjs";

test("fetchPricesBulk keeps the last close of each week for the requested symbols", async () => {
  const dir = mkdtempSync(join(tmpdir(), "defeatbeta-"));
  try {
    // A tiny stock_prices.parquet with the dataset's column types.
    const day = (offset) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    const instance = await DuckDBInstance.create(":memory:");
    const db = await instance.connect();
    await db.run(`
      COPY (
        SELECT * FROM (VALUES
          ('AAPL', '${day(9)}', 100.0::DECIMAL(16,4)),
          ('AAPL', '${day(8)}', 101.0::DECIMAL(16,4)),
          ('AAPL', '${day(1)}', 110.5::DECIMAL(16,4)),
          ('KO',   '${day(1)}', 60.0::DECIMAL(16,4)),
          ('AAPL', '2001-01-02', 1.0::DECIMAL(16,4))
        ) t(symbol, report_date, close)
      ) TO '${join(dir, "stock_prices.parquet")}' (FORMAT parquet)`);
    db.closeSync();
    instance.closeSync();

    const out = await fetchPricesBulk(["AAPL", "MSFT"], { fileDir: dir, cacheDir: dir });
    assert.deepEqual([...out.keys()], ["AAPL"]);
    const aapl = out.get("AAPL");
    assert.equal(aapl.last, 110.5);
    assert.equal(aapl.asOf, day(1));
    // 2001 is outside the 5-year window; the two closes 8-9 days ago may share a week.
    assert.ok(aapl.history.length >= 2 && aapl.history.length <= 3);
    assert.ok(aapl.history.every(([d]) => d > "2015-01-01"));
    // A file the user supplied is not deleted.
    assert.ok(existsSync(join(dir, "stock_prices.parquet")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
