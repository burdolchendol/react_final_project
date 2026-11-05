// Market registry. Each market says where its fundamentals and prices come
// from and which companies to snapshot. To add Singapore later, write an SGX
// fundamentals provider that returns the same shape as secEdgar.fetchFundamentals
// (see README "Data layer") and register it here with priceSymbol: (t) => `${t}.SI`.

import { readFileSync } from "node:fs";
import * as secEdgar from "../providers/secEdgar.mjs";
import * as yahoo from "../providers/yahooPrices.mjs";
import * as stooq from "../providers/stooqPrices.mjs";
import * as defeatBeta from "../providers/defeatBetaPrices.mjs";

const readTickers = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));

export const MARKETS = {
  us: {
    label: "United States",
    currency: "USD",
    // Fails before any download if required settings are missing.
    checkConfig: secEdgar.secUserAgent,
    // "all": every NYSE / Nasdaq / Cboe company, fundamentals from SEC's bulk zip.
    listAll: secEdgar.listedCompanies,
    bulkFundamentals: secEdgar.bulkFundamentals,
    // "list": a short watchlist (quick local runs), fundamentals per company.
    watchlist: () => readTickers("./us.tickers.json"),
    resolveTickers: secEdgar.resolveTickers,
    fundamentals: secEdgar.fetchFundamentals,
    // Price sources in order. Bulk: one file with every symbol (Defeat Beta on
    // Hugging Face). Then, for anything it lacks, Yahoo 20 symbols per request,
    // then per-ticker sources. --no-yahoo stops after the bulk file.
    priceBulk: { fetch: defeatBeta.fetchPricesBulk, symbol: (t) => t.replace(".", "-") },
    priceBatch: { fetch: yahoo.fetchPricesBatch, size: yahoo.SPARK_BATCH, symbol: (t) => t.replace(".", "-") },
    priceSources: [
      { fetch: yahoo.fetchPrices, symbol: (t) => t.replace(".", "-") },
      { fetch: stooq.fetchPrices, symbol: (t) => `${t.toLowerCase()}.us` },
    ],
  },
};
