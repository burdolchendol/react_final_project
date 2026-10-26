// Builds the static data snapshot the app reads (public/data/<market>/).
//   node scripts/fetch-data.mjs --market us [--tickers AAPL,MSFT]
// Run by .github/workflows/refresh-data.yml on a schedule, or locally.

import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { MARKETS } from "./markets/index.mjs";

function parseArgs(argv) {
  const args = { market: "us", tickers: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--market") args.market = argv[++i];
    else if (argv[i] === "--tickers") args.tickers = argv[++i].split(",").map((t) => t.trim().toUpperCase());
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

async function snapshotCompany(marketId, market, ticker) {
  const fundamentals = await market.fundamentals(ticker);
  let prices = null;
  let priceError = null;
  try {
    prices = await fetchPrices(market, ticker);
  } catch (err) {
    priceError = err.message;
  }

  const { history, source: priceSource, ...priceSummary } = prices ?? {};
  return {
    summary: {
      market: marketId,
      ticker,
      cik: fundamentals.cik ?? null,
      name: fundamentals.name,
      sector: fundamentals.sector,
      exchange: fundamentals.exchange,
      currency: priceSummary.currency || market.currency,
      price: prices ? { ...priceSummary, source: priceSource } : null,
      priceError,
      fiscalYears: fundamentals.fiscalYears,
      sources: [fundamentals.source, priceSource].filter(Boolean),
    },
    history: history ?? [],
  };
}

async function main() {
  const { market: marketId, tickers: onlyTickers } = parseArgs(process.argv.slice(2));
  const market = MARKETS[marketId];
  if (!market) throw new Error(`Unknown market "${marketId}". Known: ${Object.keys(MARKETS).join(", ")}`);

  const tickers = onlyTickers ?? market.tickers();
  const outDir = new URL(`../public/data/${marketId}/`, import.meta.url);
  const pricesDir = new URL("prices/", outDir);
  mkdirSync(pricesDir, { recursive: true });

  const companies = [];
  const failures = [];
  for (const ticker of tickers) {
    try {
      const { summary, history } = await snapshotCompany(marketId, market, ticker);
      companies.push(summary);
      writeFileSync(new URL(`${ticker}.json`, pricesDir), JSON.stringify(history));
      console.log(`✓ ${ticker}: ${summary.fiscalYears.length} fiscal years, price ${summary.price?.last ?? "n/a"}`);
    } catch (err) {
      failures.push({ ticker, error: err.message });
      console.error(`✗ ${ticker}: ${err.message}`);
    }
  }

  if (!companies.length) throw new Error("Every ticker failed; keeping the previous snapshot.");

  // Drop price files for tickers that are no longer in the list.
  const keep = new Set(companies.map((c) => `${c.ticker}.json`));
  if (!onlyTickers) {
    for (const f of readdirSync(pricesDir)) if (!keep.has(f)) unlinkSync(new URL(f, pricesDir));
  }

  const index = {
    market: marketId,
    label: market.label,
    currency: market.currency,
    generatedAt: new Date().toISOString(),
    companies,
    failures,
  };
  writeFileSync(new URL("index.json", outDir), JSON.stringify(index, null, 1));
  console.log(`Wrote ${companies.length} companies (${failures.length} failed) to public/data/${marketId}/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
