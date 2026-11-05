// Builds the static data snapshot the app reads (public/data/<market>/).
//   node scripts/fetch-data.mjs --market us                      every listed company (SEC bulk zips + Defeat Beta price file)
//   node scripts/fetch-data.mjs --market us --no-prices          same, financials only (minutes once zips are cached)
//   node scripts/fetch-data.mjs --market us --zip-dir ~/Downloads use companyfacts.zip / submissions.zip you downloaded
//   node scripts/fetch-data.mjs --market us --universe list      the watchlist in scripts/markets/us.tickers.json
//   node scripts/fetch-data.mjs --market us --tickers AAPL,KO    just these
// Run by .github/workflows/refresh-data.yml on a schedule, or locally.
// Needs SEC_USER_AGENT (see .env.example).

import { mkdirSync, writeFileSync, rmSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MARKETS } from "./markets/index.mjs";
import { mapPool } from "./lib/http.mjs";
import { INDEX_FIELDS, INDEX_YEARS, toRow, companyFile } from "../src/final_project/data/snapshotFormat.js";

// Bulk downloads go here (git-ignored). Deleted after the run unless --keep-zips.
const CACHE_DIR = fileURLToPath(new URL("../.cache/sec/", import.meta.url));

function parseArgs(argv) {
  const args = { market: "us", universe: "all", tickers: null, zipDir: process.env.SEC_ZIP_DIR || null, prices: true, yahoo: true, sectors: true, keepZips: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--market") args.market = argv[++i];
    else if (argv[i] === "--universe") args.universe = argv[++i];
    // Folder with files you downloaded yourself: companyfacts.zip, submissions.zip, stock_prices.parquet.
    else if (argv[i] === "--zip-dir") args.zipDir = argv[++i];
    else if (argv[i] === "--no-prices") args.prices = false;
    else if (argv[i] === "--no-yahoo") args.yahoo = false; // only use the bulk price file
    else if (argv[i] === "--no-sectors") args.sectors = false; // skip submissions.zip (industry names)
    else if (argv[i] === "--keep-zips") args.keepZips = true; // keep the ~2.5 GB of SEC zips for a rerun today
    else if (argv[i] === "--tickers") {
      args.tickers = argv[++i].split(",").map((t) => t.trim().toUpperCase());
      args.universe = "list";
    }
  }
  return args;
}

async function fetchPrices(market, ticker) {
  const errors = [];
  for (const source of market.priceSources) {
    try {
      return await source.fetch(source.symbol(ticker));
    } catch (err) {
      errors.push(err.message);
    }
  }
  throw new Error(`All price sources failed: ${errors.join(" | ")}`);
}

const isSec403 = (err) => /^HTTP 403 .*sec\.gov/.test(err.message);
const sec403Help = () =>
  new Error(
    `SEC refused the request (HTTP 403). Check SEC_USER_AGENT is "Your Name your@email.com" ` +
      `(currently "${process.env.SEC_USER_AGENT}"), and that you are not on a VPN or blocked network.`
  );

// Yields { company, fundamentals } for every company in the chosen universe.
async function* fundamentalsFor(market, args, failures) {
  if (args.universe === "all") {
    const companies = await market.listAll();
    console.log(`${companies.length} listed companies`);
    yield* market.bulkFundamentals(companies, { cacheDir: CACHE_DIR, zipDir: args.zipDir, withSectors: args.sectors, keepZips: args.keepZips });
    return;
  }
  const companies = await market.resolveTickers(args.tickers ?? market.watchlist());
  for (const company of companies) {
    try {
      yield { company, fundamentals: await market.fundamentals(company) };
    } catch (err) {
      if (isSec403(err)) throw sec403Help();
      failures.push({ ticker: company.ticker, error: err.message });
      console.error(`✗ ${company.ticker}: ${err.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const market = MARKETS[args.market];
  if (!market) throw new Error(`Unknown market "${args.market}". Known: ${Object.keys(MARKETS).join(", ")}`);
  market.checkConfig?.();

  // Build into a staging folder and swap it in at the end, so a failed run
  // leaves the previous snapshot untouched.
  const finalDir = new URL(`../public/data/${args.market}/`, import.meta.url);
  const outDir = new URL(`../public/data/${args.market}.partial/`, import.meta.url);
  const detailDir = new URL("companies/", outDir);
  const pricesDir = new URL("prices/", outDir);
  rmSync(outDir, { recursive: true, force: true });
  for (const dir of [detailDir, pricesDir]) mkdirSync(dir, { recursive: true });
  try {
    await buildSnapshot(args, market, outDir, detailDir, pricesDir);
  } catch (err) {
    rmSync(outDir, { recursive: true, force: true });
    throw err;
  }
  rmSync(finalDir, { recursive: true, force: true });
  renameSync(outDir, finalDir);
  console.log(`Snapshot ready in public/data/${args.market}/`);
}

async function buildSnapshot(args, market, outDir, detailDir, pricesDir) {

  // 1. Fundamentals, one company at a time. Each company's full history goes
  //    straight to its own file; only the compact index row stays in memory.
  //    Companies with no annual 10-K data (funds, SPACs, foreign filers) are skipped.
  const failures = [];
  const companies = [];
  let skipped = 0;
  try {
    for await (const { company, fundamentals } of fundamentalsFor(market, args, failures)) {
      const years = fundamentals.fiscalYears;
      if (!years.length) {
        skipped++;
        continue;
      }
      writeFileSync(new URL(companyFile(company.ticker), detailDir), JSON.stringify({ fiscalYears: years }));
      companies.push({
        ticker: company.ticker,
        cik: fundamentals.cik,
        name: fundamentals.name,
        sector: fundamentals.sector,
        exchange: fundamentals.exchange,
        currency: market.currency,
        price: null,
        years: years.slice(-INDEX_YEARS).map(toRow),
      });
    }
  } catch (err) {
    throw isSec403(err) ? sec403Help() : err;
  }
  console.log(`Fundamentals: ${companies.length} companies (${skipped} without annual reports skipped)`);
  if (!companies.length) throw new Error("No company data fetched; keeping the previous snapshot.");

  // 2. Prices: one bulk file first, then batched requests, then one by one, each
  //    only for whatever the previous step missed.
  let priced = 0;
  if (args.prices) {
    const save = (c, prices) => {
      const { history, source, ...summary } = prices;
      c.price = { last: summary.last, asOf: summary.asOf };
      if (summary.currency) c.currency = summary.currency;
      writeFileSync(new URL(companyFile(c.ticker), pricesDir), JSON.stringify({ history, source }));
      priced++;
    };

    let missing = companies;
    // The bulk file is ~470 MB, worth it only for the full universe.
    if (market.priceBulk && args.universe === "all") {
      const { fetch, symbol } = market.priceBulk;
      try {
        const found = await fetch(companies.map((c) => symbol(c.ticker)), {
          fileDir: args.zipDir,
          cacheDir: CACHE_DIR,
          keepFiles: args.keepZips,
        });
        for (const c of companies) {
          const p = found.get(symbol(c.ticker));
          if (p) save(c, p);
        }
      } catch (err) {
        console.error(`Bulk prices failed: ${err.message}`);
      }
      missing = companies.filter((c) => !c.price);
      console.log(`Bulk prices: ${priced}/${companies.length}; ${missing.length} missing`);
    }
    if (!args.yahoo) missing = [];

    if (market.priceBatch && missing.length) {
      const { fetch, size, symbol } = market.priceBatch;
      const batches = [];
      for (let i = 0; i < missing.length; i += size) batches.push(missing.slice(i, i + size));
      let done = 0;
      await mapPool(batches, 2, async (batch) => {
        try {
          const found = await fetch(batch.map((c) => symbol(c.ticker)));
          for (const c of batch) {
            const p = found.get(symbol(c.ticker));
            if (p) save(c, p);
          }
        } catch (err) {
          console.error(`Price batch failed (${batch[0].ticker}…): ${err.message}`);
        }
        if (++done % 50 === 0) console.log(`Prices: ${done}/${batches.length} batches`);
      });
      missing = missing.filter((c) => !c.price);
      console.log(`Batched prices: ${priced}/${companies.length}; ${missing.length} left to try one by one`);
      if (missing.length > 500) {
        console.warn("Many prices are missing from the batch results; the one-by-one fallback will be slow.");
      }
    }

    await mapPool(missing, 3, async (c, i) => {
      try {
        save(c, await fetchPrices(market, c.ticker));
      } catch (err) {
        if (args.universe === "list") console.error(`✗ ${c.ticker} price: ${err.message}`);
      }
      if ((i + 1) % 250 === 0) console.log(`Prices (one by one): ${i + 1}/${missing.length}`);
    });
  }

  const index = {
    market: args.market,
    label: market.label,
    currency: market.currency,
    universe: args.universe,
    generatedAt: new Date().toISOString(),
    fields: INDEX_FIELDS,
    companies,
    failures,
  };
  writeFileSync(new URL("index.json", outDir), JSON.stringify(index));
  console.log(`${companies.length} companies, ${priced} with prices`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
