// Defeat Beta bulk prices: daily US prices for every listed symbol in one
// ~470 MB parquet file on Hugging Face (free, ODC-BY licence, originally from
// Yahoo Finance, refreshed about daily). One download instead of thousands of
// requests. https://huggingface.co/datasets/defeatbeta/yahoo-finance-data
// The file is read with DuckDB, a little at a time, with capped memory and threads.

import { join } from "node:path";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { fetchJson, downloadToFile } from "../lib/http.mjs";

const DATASET = "https://huggingface.co/datasets/defeatbeta/yahoo-finance-data/resolve/main";
const FILE = "stock_prices.parquet";

const sourceFor = (symbol) => ({
  label: "Yahoo Finance data via Defeat Beta",
  url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/history/`,
});

// Returns { file, ours }. A copy you downloaded into fileDir is used as is and
// never deleted; otherwise the cached copy is refreshed when the dataset is newer.
async function pricesFile({ fileDir, cacheDir }) {
  if (fileDir && existsSync(join(fileDir, FILE))) {
    console.log(`Using your ${join(fileDir, FILE)}`);
    return { file: join(fileDir, FILE), ours: false };
  }
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, FILE);
  const spec = await fetchJson(`${DATASET}/spec.json`).catch(() => null);
  const updated = Date.parse(spec?.files?.[`US/${FILE}`] ?? spec?.update_time ?? "");
  if (existsSync(file) && (!updated || statSync(file).mtimeMs > updated)) {
    console.log(`Using cached ${file}`);
    return { file, ours: true };
  }
  console.log(`Downloading ${FILE} from Hugging Face (~470 MB) …`);
  const partial = `${file}.part`;
  try {
    await downloadToFile(`${DATASET}/data/US/${FILE}`, partial);
  } catch (err) {
    rmSync(partial, { force: true });
    throw err;
  }
  renameSync(partial, file);
  return { file, ours: true };
}

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Weekly closes (last trading day of each week) for the past 5 years.
// Returns Map(symbol -> { last, asOf, currency, history, source }).
export async function fetchPricesBulk(symbols, { fileDir, cacheDir, keepFiles = false } = {}) {
  const { file, ours } = await pricesFile({ fileDir, cacheDir });
  const since = new Date(Date.now() - 5 * 365 * 86_400_000).toISOString().slice(0, 10);
  const out = new Map();
  const instance = await DuckDBInstance.create(":memory:", { memory_limit: "1GB", threads: "2" });
  const db = await instance.connect();
  try {
    await db.run("CREATE TEMP TABLE wanted (symbol VARCHAR)");
    for (let i = 0; i < symbols.length; i += 1000) {
      const values = symbols.slice(i, i + 1000).map((s) => `(${sqlString(s)})`).join(",");
      if (values) await db.run(`INSERT INTO wanted VALUES ${values}`);
    }
    const result = await db.stream(`
      SELECT p.symbol, max(p.report_date) AS d, CAST(arg_max(p.close, p.report_date) AS DOUBLE) AS c
      FROM read_parquet(${sqlString(file)}) p
      JOIN wanted w ON w.symbol = p.symbol
      WHERE p.report_date >= ${sqlString(since)} AND p.close IS NOT NULL
      GROUP BY p.symbol, date_trunc('week', CAST(p.report_date AS DATE))
      ORDER BY p.symbol, d`);
    for (let chunk = await result.fetchChunk(); chunk && chunk.rowCount > 0; chunk = await result.fetchChunk()) {
      for (const [symbol, date, close] of chunk.getRows()) {
        let entry = out.get(symbol);
        if (!entry) out.set(symbol, (entry = { currency: "USD", history: [], source: sourceFor(symbol) }));
        entry.history.push([String(date).slice(0, 10), Number(close.toFixed(4))]);
      }
    }
  } finally {
    db.closeSync();
    instance.closeSync();
    if (ours && !keepFiles) rmSync(file, { force: true });
  }
  for (const entry of out.values()) [entry.asOf, entry.last] = entry.history[entry.history.length - 1];
  return out;
}

const FX_FILE = "exchange_rate.parquet";

// Exchange rates from the same dataset (Yahoo symbols like "EUR=X" = euros per
// US dollar). Small file (~3 MB). Returns Map(currency -> ascending [[date, rate]]).
export async function fetchFxRates(currencies, { fileDir, cacheDir } = {}) {
  const wanted = [...new Set(currencies)].filter((c) => c && c !== "USD");
  const out = new Map();
  if (!wanted.length) return out;

  let file = fileDir && join(fileDir, FX_FILE);
  let ours = false;
  if (!file || !existsSync(file)) {
    mkdirSync(cacheDir, { recursive: true });
    file = join(cacheDir, FX_FILE);
    ours = true;
    await downloadToFile(`${DATASET}/data/US/${FX_FILE}`, file);
  }
  const instance = await DuckDBInstance.create(":memory:", { memory_limit: "512MB", threads: "1" });
  const db = await instance.connect();
  try {
    const symbols = wanted.map((c) => sqlString(`${c}=X`)).join(",");
    const result = await db.stream(`
      SELECT symbol, report_date, CAST(close AS DOUBLE)
      FROM read_parquet(${sqlString(file)})
      WHERE symbol IN (${symbols}) AND close > 0
      ORDER BY symbol, report_date`);
    for (let chunk = await result.fetchChunk(); chunk && chunk.rowCount > 0; chunk = await result.fetchChunk()) {
      for (const [symbol, date, rate] of chunk.getRows()) {
        const currency = symbol.replace("=X", "");
        if (!out.has(currency)) out.set(currency, []);
        out.get(currency).push([String(date).slice(0, 10), rate]);
      }
    }
  } finally {
    db.closeSync();
    instance.closeSync();
    if (ours) rmSync(file, { force: true });
  }
  return out;
}
