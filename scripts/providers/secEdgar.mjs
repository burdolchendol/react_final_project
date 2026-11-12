// SEC EDGAR fundamentals provider (US market).
// Free, no API key. Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
// SEC asks every client to send a User-Agent with a contact address and to stay under 10 requests/second.

import { join } from "node:path";
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import yauzl from "yauzl";
import { fetchJson, downloadToFile } from "../lib/http.mjs";

// SEC blocks requests whose User-Agent doesn't name a person/company and a contact
// email (HTTP 403), so this must be set by whoever runs the fetch. See README.
export function secUserAgent() {
  const ua = process.env.SEC_USER_AGENT?.trim();
  if (!ua || !/\S+@\S+\.\S+/.test(ua)) {
    throw new Error(
      'SEC_USER_AGENT is not set. SEC requires a name and contact email, e.g. SEC_USER_AGENT="Jane Doe jane@example.com". ' +
        "Put it in a .env file (see .env.example) or set it as a GitHub repository variable."
    );
  }
  return ua;
}

const headers = () => ({ "User-Agent": secUserAgent(), Accept: "application/json", "Accept-Encoding": "gzip, deflate" });

// Each normalized field lists XBRL concepts in priority order: `concepts` for
// US GAAP filers (10-K), `ifrs` for foreign filers using IFRS (20-F / 40-F).
// Companies switch tags over the years (e.g. Revenues -> RevenueFromContractWithCustomer...),
// so values are merged across concepts per fiscal year. `unit` is "money"
// (the company's reporting currency), "perShare" or "shares".
export const FIELD_CONCEPTS = {
  revenue: {
    kind: "duration",
    unit: "money",
    concepts: [
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
    ],
    ifrs: ["Revenue", "RevenueFromContractsWithCustomers"],
  },
  netIncome: {
    kind: "duration",
    unit: "money",
    concepts: ["NetIncomeLoss", "ProfitLoss"],
    ifrs: ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
  },
  epsDiluted: {
    kind: "duration",
    unit: "perShare",
    concepts: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
    ifrs: ["DilutedEarningsLossPerShare", "BasicEarningsLossPerShare"],
  },
  dilutedShares: {
    kind: "duration",
    unit: "shares",
    concepts: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"],
    ifrs: ["AdjustedWeightedAverageShares", "WeightedAverageShares"],
  },
  totalAssets: { kind: "instant", unit: "money", concepts: ["Assets"], ifrs: ["Assets"] },
  totalLiabilities: { kind: "instant", unit: "money", concepts: ["Liabilities"], ifrs: ["Liabilities"] },
  currentAssets: { kind: "instant", unit: "money", concepts: ["AssetsCurrent"], ifrs: ["CurrentAssets"] },
  currentLiabilities: { kind: "instant", unit: "money", concepts: ["LiabilitiesCurrent"], ifrs: ["CurrentLiabilities"] },
  equity: {
    kind: "instant",
    unit: "money",
    concepts: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    ifrs: ["EquityAttributableToOwnersOfParent", "Equity"],
  },
  longTermDebt: {
    kind: "instant",
    unit: "money",
    concepts: ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations"],
    ifrs: ["NoncurrentPortionOfNoncurrentBorrowings", "LongtermBorrowings", "NoncurrentFinancialLiabilities"],
  },
  // Total debt = long-term debt (non-current) + debt due within a year. Filers tag
  // the short-term part either as one total or as its pieces.
  debtCurrent: {
    kind: "instant",
    unit: "money",
    concepts: ["DebtCurrent"],
    ifrs: ["CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings"],
  },
  longTermDebtCurrent: {
    kind: "instant",
    unit: "money",
    concepts: ["LongTermDebtCurrent", "LongTermDebtAndCapitalLeaseObligationsCurrent"],
    ifrs: ["CurrentPortionOfNoncurrentBorrowings", "CurrentPortionOfLongtermBorrowings"],
  },
  shortTermBorrowings: {
    kind: "instant",
    unit: "money",
    concepts: ["ShortTermBorrowings", "CommercialPaper"],
    ifrs: ["ShorttermBorrowings"],
  },
  cash: {
    kind: "instant",
    unit: "money",
    concepts: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
      "CashAndDueFromBanks",
      "Cash",
    ],
    ifrs: ["CashAndCashEquivalents", "Cash"],
  },
  goodwill: { kind: "instant", unit: "money", concepts: ["Goodwill"], ifrs: ["Goodwill"] },
  intangibles: {
    kind: "instant",
    unit: "money",
    concepts: ["IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"],
    ifrs: ["IntangibleAssetsOtherThanGoodwill"],
  },
  // Some filers report one combined figure instead of the two above.
  intangiblesInclGoodwill: {
    kind: "instant",
    unit: "money",
    concepts: ["IntangibleAssetsNetIncludingGoodwill"],
    ifrs: ["IntangibleAssetsAndGoodwill"],
  },
  operatingCashFlow: {
    kind: "duration",
    unit: "money",
    concepts: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    ifrs: ["CashFlowsFromUsedInOperatingActivities"],
  },
  capex: {
    kind: "duration",
    unit: "money",
    concepts: ["PaymentsToAcquirePropertyPlantAndEquipment"],
    ifrs: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfPropertyPlantAndEquipment"],
  },
  dividendsPerShare: {
    kind: "duration",
    unit: "perShare",
    concepts: ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
    ifrs: ["DividendsRecognisedAsDistributionsToOwnersPerShare"],
  },
  dividendsPaid: {
    kind: "duration",
    unit: "money",
    concepts: ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"],
    ifrs: ["DividendsPaidClassifiedAsFinancingActivities", "DividendsPaid", "DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities"],
  },
};

// 10-K for US companies; 20-F and 40-F are the annual reports of foreign companies.
const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "10-KT", "20-F", "20-F/A", "40-F", "40-F/A"]);
const MAX_YEARS = 15;

const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

// Returns Map(periodEnd -> { val, filed, form }) for one concept, keeping the
// most recently filed value so restatements win.
function annualFacts(entries, kind) {
  const byEnd = new Map();
  for (const e of entries) {
    if (!ANNUAL_FORMS.has(e.form)) continue;
    if (kind === "duration") {
      if (!e.start) continue;
      const days = daysBetween(e.start, e.end);
      if (days < 340 || days > 390) continue;
    }
    const prev = byEnd.get(e.end);
    if (!prev || e.filed > prev.filed) byEnd.set(e.end, { val: e.val, filed: e.filed, form: e.form, accn: e.accn });
  }
  return byEnd;
}

const unitName = (unit, currency) =>
  unit === "money" ? currency : unit === "perShare" ? `${currency}/shares` : "shares";

function fieldSeries(facts, concepts, kind, unit) {
  const merged = new Map();
  for (const concept of concepts ?? []) {
    const entries = facts[concept]?.units?.[unit];
    if (!entries) continue;
    for (const [end, fact] of annualFacts(entries, kind)) {
      if (!merged.has(end)) merged.set(end, fact);
    }
  }
  return merged;
}

// Which taxonomy and reporting currency a filer uses, and whether it files the
// foreign annual reports (20-F / 40-F). US GAAP wins when both are present.
export function factsProfile(companyFacts) {
  const all = companyFacts?.facts ?? {};
  const hasAnnual = (ns) =>
    Object.values(all[ns]?.Assets?.units ?? {}).some((entries) => entries.some((e) => ANNUAL_FORMS.has(e.form)));
  const taxonomy = hasAnnual("us-gaap") ? "us-gaap" : hasAnnual("ifrs-full") ? "ifrs-full" : "us-gaap";

  // Reporting currency = the unit with the most annual Assets / Revenue facts.
  const counts = new Map();
  let foreignForm = false;
  for (const concept of ["Assets", ...FIELD_CONCEPTS.revenue.concepts, ...FIELD_CONCEPTS.revenue.ifrs]) {
    for (const [unit, entries] of Object.entries(all[taxonomy]?.[concept]?.units ?? {})) {
      for (const e of entries) {
        if (!ANNUAL_FORMS.has(e.form)) continue;
        counts.set(unit, (counts.get(unit) ?? 0) + 1);
        if (e.form.startsWith("20-F") || e.form.startsWith("40-F")) foreignForm = true;
      }
    }
  }
  const currency = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";
  return { taxonomy, currency, foreign: foreignForm };
}

// Pure transform: SEC companyfacts JSON -> ascending list of fiscal years, in the
// company's reporting currency (see factsProfile).
export function normalizeCompanyFacts(companyFacts, profile = factsProfile(companyFacts)) {
  const facts = companyFacts?.facts?.[profile.taxonomy] ?? {};
  const listKey = profile.taxonomy === "ifrs-full" ? "ifrs" : "concepts";
  const series = Object.fromEntries(
    Object.entries(FIELD_CONCEPTS).map(([field, spec]) => [
      field,
      fieldSeries(facts, spec[listKey], spec.kind, unitName(spec.unit, profile.currency)),
    ])
  );

  // A fiscal year exists wherever we have annual revenue or net income.
  const periodEnds = [...new Set([...series.revenue.keys(), ...series.netIncome.keys()])]
    .sort()
    .slice(-MAX_YEARS);

  return periodEnds.map((periodEnd) => {
    const row = { fiscalYear: Number(periodEnd.slice(0, 4)), periodEnd };
    let filed = null;
    // Accession number of the filing each value came from, so the app can link to it.
    const accn = {};
    for (const field of Object.keys(FIELD_CONCEPTS)) {
      const fact = series[field].get(periodEnd);
      row[field] = fact ? fact.val : null;
      if (fact?.accn) accn[field] = fact.accn;
      if (fact && (!filed || fact.filed > filed)) filed = fact.filed;
    }
    // Some filers omit total liabilities; derive it when the parts exist.
    if (row.totalLiabilities == null && row.totalAssets != null && row.equity != null) {
      row.totalLiabilities = row.totalAssets - row.equity;
      row.totalLiabilitiesDerived = true;
    }
    row.filed = filed;
    row.accn = accn;
    return row;
  });
}

// Exchanges kept when screening "all" companies. OTC and unlisted filers are left out.
const LISTED_EXCHANGES = new Set(["NYSE", "Nasdaq", "CBOE"]);

const sourceFor = (cik) => ({
  label: "SEC EDGAR (XBRL company facts)",
  url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`,
});

let companyListPromise;
// Every ticker SEC knows, with CIK and exchange: [{ ticker, cik, name, exchange }].
// One small file (~1 MB), not a per-company call; it maps tickers to the CIKs in the zips.
function secCompanyList() {
  companyListPromise ??= fetchJson("https://www.sec.gov/files/company_tickers_exchange.json", {
    headers: headers(),
  }).then(({ fields, data }) =>
    data.map((row) => {
      const c = Object.fromEntries(fields.map((f, i) => [f, row[i]]));
      return { ticker: c.ticker.toUpperCase(), cik: String(c.cik).padStart(10, "0"), name: c.name, exchange: c.exchange };
    })
  );
  return companyListPromise;
}

// One entry per listed company. Share classes of the same company (GOOGL/GOOG)
// share one set of financials, so only the first ticker SEC lists is kept.
export async function listedCompanies() {
  const seen = new Set();
  return (await secCompanyList()).filter((c) => {
    if (!LISTED_EXCHANGES.has(c.exchange) || seen.has(c.cik)) return false;
    seen.add(c.cik);
    return true;
  });
}

export async function resolveTickers(tickers) {
  const byTicker = new Map((await secCompanyList()).map((c) => [c.ticker, c]));
  return tickers.map((t) => byTicker.get(t.toUpperCase()) ?? { ticker: t.toUpperCase(), missing: true });
}

// Per-company API: two requests each. Best for a short list of tickers.
export async function fetchFundamentals(company) {
  if (company.missing) throw new Error(`${company.ticker} not found in SEC ticker list`);
  const { cik } = company;
  const [facts, submissions] = await Promise.all([
    fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: headers() }),
    fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: headers() }).catch(() => null),
  ]);
  const profile = factsProfile(facts);
  return {
    cik,
    name: submissions?.name || facts.entityName || company.name,
    sector: submissions?.sicDescription || null,
    exchange: submissions?.exchanges?.[0] || company.exchange || null,
    currency: profile.currency,
    foreign: profile.foreign,
    fiscalYears: normalizeCompanyFacts(facts, profile),
    source: sourceFor(cik),
  };
}

export const BULK_FILES = {
  "companyfacts.zip": "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
  "submissions.zip": "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
};
// SEC rebuilds the zips nightly, so a download younger than this is reused.
const MAX_AGE_MS = 20 * 60 * 60 * 1000;

// Returns { file, ours }. A zip you downloaded yourself into zipDir is used as is
// (and never deleted); otherwise it is downloaded into cacheDir, once a day at most.
async function bulkZip(name, { zipDir, cacheDir }) {
  if (zipDir && existsSync(join(zipDir, name))) {
    console.log(`Using your ${join(zipDir, name)}`);
    return { file: join(zipDir, name), ours: false };
  }
  return { file: await cachedZip(name, cacheDir), ours: true };
}

async function cachedZip(name, cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, name);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS) {
    console.log(`Using cached ${file}`);
    return file;
  }
  console.log(`Downloading ${BULK_FILES[name]} (over 1 GB, this takes a while) …`);
  const partial = `${file}.part`;
  try {
    await downloadToFile(BULK_FILES[name], partial, { headers: headers() });
  } catch (err) {
    rmSync(partial, { force: true });
    throw err;
  }
  renameSync(partial, file);
  return file;
}

// Bulk path: SEC publishes every filer's data nightly as two zips. All company
// data is read from them; no per-company API calls are made. The JSON is read
// straight out of the zip, one company at a time, so nothing is extracted to disk.
// Yields { company, fundamentals } for each requested company found.
export async function* bulkFundamentals(companies, { cacheDir, zipDir, withSectors = true, keepZips = true } = {}) {
  const downloaded = [];
  try {
    yield* readBulk(companies, { cacheDir, zipDir, withSectors, downloaded });
  } finally {
    // The zips are large; don't leave them behind unless asked to.
    if (!keepZips) for (const f of downloaded) rmSync(f, { force: true });
  }
}

async function* readBulk(companies, { cacheDir, zipDir, withSectors, downloaded }) {
  const byFile = new Map(companies.map((c) => [`CIK${c.cik}.json`, c]));

  // Industry (SIC description) comes from submissions.zip.
  const sectors = new Map();
  if (withSectors) {
    const { file, ours } = await bulkZip("submissions.zip", { zipDir, cacheDir });
    if (ours) downloaded.push(file);
    for await (const [name, json] of readZipEntries(file, (n) => byFile.has(n))) {
      if (json.sicDescription) sectors.set(name, json.sicDescription);
    }
    console.log(`Industries found for ${sectors.size} companies`);
  }

  const { file, ours } = await bulkZip("companyfacts.zip", { zipDir, cacheDir });
  if (ours) downloaded.push(file);
  let done = 0;
  for await (const [name, json] of readZipEntries(file, (n) => byFile.has(n))) {
    const c = byFile.get(name);
    if (++done % 1000 === 0) console.log(`Financials: ${done}/${companies.length}`);
    const profile = factsProfile(json);
    yield {
      company: c,
      fundamentals: {
        cik: c.cik,
        name: json.entityName || c.name,
        sector: sectors.get(name) ?? null,
        exchange: c.exchange ?? null,
        currency: profile.currency,
        foreign: profile.foreign,
        fiscalYears: normalizeCompanyFacts(json, profile),
        source: sourceFor(c.cik),
      },
    };
  }
}

// Reads matching JSON entries one at a time so memory stays small.
async function* readZipEntries(file, include) {
  const zip = await new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true }, (err, z) => (err ? reject(err) : resolve(z)))
  );
  const nextEntry = () =>
    new Promise((resolve, reject) => {
      const onEntry = (entry) => {
        zip.off("end", onEnd);
        zip.off("error", reject);
        resolve(entry);
      };
      const onEnd = () => {
        zip.off("entry", onEntry);
        resolve(null);
      };
      zip.once("entry", onEntry);
      zip.once("end", onEnd);
      zip.once("error", reject);
      zip.readEntry();
    });
  const readEntry = (entry) =>
    new Promise((resolve, reject) =>
      zip.openReadStream(entry, (err, stream) => {
        if (err) return reject(err);
        const chunks = [];
        stream.on("data", (c) => chunks.push(c));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        stream.on("error", reject);
      })
    );
  try {
    for (let entry = await nextEntry(); entry; entry = await nextEntry()) {
      if (!include(entry.fileName)) continue;
      try {
        yield [entry.fileName, JSON.parse(await readEntry(entry))];
      } catch (err) {
        console.error(`Skipping ${entry.fileName}: ${err.message}`);
      }
    }
  } finally {
    zip.close();
  }
}
