// SEC EDGAR fundamentals provider (US market).
// Free, no API key. Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
// SEC asks every client to send a User-Agent with a contact address and to stay under 10 requests/second.

import { fetchJson } from "../lib/http.mjs";

const USER_AGENT =
  process.env.SEC_USER_AGENT ||
  "react_final_project stock analyzer 321728857+burdolchendol@users.noreply.github.com";
const HEADERS = { "User-Agent": USER_AGENT, Accept: "application/json" };

// Each normalized field lists XBRL concepts in priority order. Companies switch
// tags over the years (e.g. Revenues -> RevenueFromContractWithCustomer...), so
// values are merged across concepts per fiscal year.
export const FIELD_CONCEPTS = {
  revenue: {
    kind: "duration",
    unit: "USD",
    concepts: [
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
      "SalesRevenueGoodsNet",
    ],
  },
  netIncome: { kind: "duration", unit: "USD", concepts: ["NetIncomeLoss", "ProfitLoss"] },
  epsDiluted: {
    kind: "duration",
    unit: "USD/shares",
    concepts: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted", "EarningsPerShareBasic"],
  },
  dilutedShares: {
    kind: "duration",
    unit: "shares",
    concepts: ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"],
  },
  totalAssets: { kind: "instant", unit: "USD", concepts: ["Assets"] },
  totalLiabilities: { kind: "instant", unit: "USD", concepts: ["Liabilities"] },
  currentAssets: { kind: "instant", unit: "USD", concepts: ["AssetsCurrent"] },
  currentLiabilities: { kind: "instant", unit: "USD", concepts: ["LiabilitiesCurrent"] },
  equity: {
    kind: "instant",
    unit: "USD",
    concepts: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  },
  longTermDebt: {
    kind: "instant",
    unit: "USD",
    concepts: ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations"],
  },
  operatingCashFlow: {
    kind: "duration",
    unit: "USD",
    concepts: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
  },
  capex: { kind: "duration", unit: "USD", concepts: ["PaymentsToAcquirePropertyPlantAndEquipment"] },
  dividendsPerShare: {
    kind: "duration",
    unit: "USD/shares",
    concepts: ["CommonStockDividendsPerShareDeclared", "CommonStockDividendsPerShareCashPaid"],
  },
  dividendsPaid: {
    kind: "duration",
    unit: "USD",
    concepts: ["PaymentsOfDividendsCommonStock", "PaymentsOfDividends"],
  },
};

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "10-KT"]);
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

function fieldSeries(usGaap, { kind, unit, concepts }) {
  const merged = new Map();
  for (const concept of concepts) {
    const entries = usGaap[concept]?.units?.[unit];
    if (!entries) continue;
    for (const [end, fact] of annualFacts(entries, kind)) {
      if (!merged.has(end)) merged.set(end, fact);
    }
  }
  return merged;
}

// Pure transform: SEC companyfacts JSON -> ascending list of fiscal years.
export function normalizeCompanyFacts(companyFacts) {
  const usGaap = companyFacts?.facts?.["us-gaap"] ?? {};
  const series = Object.fromEntries(
    Object.entries(FIELD_CONCEPTS).map(([field, spec]) => [field, fieldSeries(usGaap, spec)])
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

let tickerMapPromise;
async function tickerToCik(ticker) {
  tickerMapPromise ??= fetchJson("https://www.sec.gov/files/company_tickers.json", { headers: HEADERS }).then(
    (data) => new Map(Object.values(data).map((c) => [c.ticker.toUpperCase(), c]))
  );
  const entry = (await tickerMapPromise).get(ticker.toUpperCase());
  if (!entry) throw new Error(`${ticker} not found in SEC ticker list`);
  return { cik: String(entry.cik_str).padStart(10, "0"), name: entry.title };
}

export async function fetchFundamentals(ticker) {
  const { cik, name } = await tickerToCik(ticker);
  const [facts, submissions] = await Promise.all([
    fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: HEADERS }),
    fetchJson(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: HEADERS }).catch(() => null),
  ]);

  return {
    cik,
    name: submissions?.name || facts.entityName || name,
    sector: submissions?.sicDescription || null,
    exchange: submissions?.exchanges?.[0] || null,
    fiscalYears: normalizeCompanyFacts(facts),
    source: {
      label: "SEC EDGAR (XBRL company facts)",
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`,
    },
  };
}
