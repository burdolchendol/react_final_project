# Formulas and data sources

This file explains where every number in the app comes from and how each column is calculated. It matches the code in `scripts/providers/secEdgar.mjs`, `scripts/lib/fx.mjs`, `scripts/fetch-data.mjs` and `src/final_project/utils/metrics.js`. If you change one of those, update this file too.

Contents

1. [Where the data comes from](#1-where-the-data-comes-from)
2. [How a filing becomes a fiscal year](#2-how-a-filing-becomes-a-fiscal-year)
3. [Raw fields: which XBRL tag each one uses](#3-raw-fields-which-xbrl-tag-each-one-uses)
4. [Screener columns: the calculations](#4-screener-columns-the-calculations)
5. [Other values (company page, Graham's Analysis, ticker tape)](#5-other-values)
6. [Foreign companies: 20-F filers](#6-foreign-companies-20-f-filers)
7. [Foreign companies: 40-F filers](#7-foreign-companies-40-f-filers)
8. [Currencies and exchange rates](#8-currencies-and-exchange-rates)
9. [Worked example: tracing a number back to the filing](#9-worked-example-tracing-a-number-back-to-the-filing)

---

## 1. Where the data comes from

| What | Source | File |
|---|---|---|
| Financial statements (revenue, assets, EPS…) | SEC EDGAR XBRL "company facts". These are the numbers companies tag in their annual reports. | `companyfacts.zip` (bulk) or `data.sec.gov/api/xbrl/companyfacts/CIK##########.json` |
| Company name, industry, exchange | SEC EDGAR submissions | `submissions.zip` (bulk) or `data.sec.gov/submissions/CIK##########.json` |
| Which companies are listed | SEC ticker list, keeping only NYSE, Nasdaq and Cboe. One ticker per company, so GOOGL and GOOG count once. | `sec.gov/files/company_tickers_exchange.json` |
| Share prices | Defeat Beta dataset on Hugging Face (Yahoo Finance data, ODC-BY licence). Yahoo is only a fallback. | `stock_prices.parquet` |
| Exchange rates | Same Defeat Beta dataset. Symbols like `SGD=X` mean SGD per 1 USD. | `exchange_rate.parquet` |

Nothing is typed in by hand. Every financial number can be clicked on the company page, and the link opens the SEC filing it came from.

---

## 2. How a filing becomes a fiscal year

Companies tag every number in their annual report with an XBRL concept (for example `us-gaap:Revenues`), a period and a unit. The script turns those tags into one row per fiscal year like this:

1. **Only annual reports count.** The accepted forms are 10-K, 10-K/A and 10-KT for US companies, plus 20-F, 20-F/A, 40-F and 40-F/A for foreign ones. Quarterly 10-Qs are ignored.
2. **Only full-year figures.** Income-statement and cash-flow items cover a period. These are kept only if the period is 340 to 390 days long, which drops quarterly or 6-month figures quoted inside an annual report. Balance-sheet items are a single date and are kept as they are.
3. **The most recent filing wins.** Every 10-K repeats the previous one or two years for comparison, and those older figures are sometimes restated. When the same period appears in several filings, the value from the most recently filed one is used. That's why BAC's 2011 revenue links to the 10-K filed in 2014: it's the latest report that includes 2011.
4. **Tags are merged in priority order.** Companies change tags over time, for example `Revenues` became `RevenueFromContractWithCustomerExcludingAssessedTax` in 2018. For each year, the first tag in the list (section 3) that has a value is used.
5. **A fiscal year exists** wherever there's annual revenue or net income. It's labelled by the calendar year of its period end, so a year ending 31 Jan 2024 is shown as 2024. The last 15 years are kept.
6. **Each value remembers its filing.** The accession number (e.g. `0000070858-14-000012`) is stored, and the link is
   `https://www.sec.gov/Archives/edgar/data/<CIK>/<accession without dashes>/<accession>-index.htm`.
7. **Companies with no annual figures are skipped.** These are funds, SPACs and very new listings.

The Screener shows the **latest fiscal year** unless a column says otherwise.

---

## 3. Raw fields: which XBRL tag each one uses

The tags are tried in this order. The first one with a value for that year wins. "US GAAP" is used by 10-K filers and by foreign filers who report in US GAAP. "IFRS" is used by foreign filers who report in IFRS (see sections 6 and 7).

| Field | Type | US GAAP tags (`us-gaap:`) | IFRS tags (`ifrs-full:`) |
|---|---|---|---|
| Revenue | full year | `Revenues` → `RevenueFromContractWithCustomerExcludingAssessedTax` → `RevenueFromContractWithCustomerIncludingAssessedTax` → `SalesRevenueNet` → `SalesRevenueGoodsNet` | `Revenue` → `RevenueFromContractsWithCustomers` |
| Net income | full year | `NetIncomeLoss` → `ProfitLoss` | `ProfitLossAttributableToOwnersOfParent` → `ProfitLoss` |
| EPS (diluted) | full year, per share | `EarningsPerShareDiluted` → `EarningsPerShareBasicAndDiluted` → `EarningsPerShareBasic` | `DilutedEarningsLossPerShare` → `BasicEarningsLossPerShare` |
| Diluted shares | full year average | `WeightedAverageNumberOfDilutedSharesOutstanding` → `WeightedAverageNumberOfSharesOutstandingBasic` | `AdjustedWeightedAverageShares` → `WeightedAverageShares` |
| Total assets | year end | `Assets` | `Assets` |
| Total liabilities | year end | `Liabilities`. If it's missing: total assets − equity. | `Liabilities` (same fallback) |
| Current assets | year end | `AssetsCurrent` | `CurrentAssets` |
| Current liabilities | year end | `LiabilitiesCurrent` | `CurrentLiabilities` |
| Shareholders' equity | year end | `StockholdersEquity` → `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest` | `EquityAttributableToOwnersOfParent` → `Equity` |
| Long-term debt | year end | `LongTermDebtNoncurrent` → `LongTermDebt` → `LongTermDebtAndCapitalLeaseObligations` | `NoncurrentPortionOfNoncurrentBorrowings` → `LongtermBorrowings` → `NoncurrentFinancialLiabilities` |
| Debt due within a year (one total) | year end | `DebtCurrent` | `CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings` |
| Current part of long-term debt | year end | `LongTermDebtCurrent` → `LongTermDebtAndCapitalLeaseObligationsCurrent` | `CurrentPortionOfNoncurrentBorrowings` → `CurrentPortionOfLongtermBorrowings` |
| Short-term borrowings | year end | `ShortTermBorrowings` → `CommercialPaper` | `ShorttermBorrowings` |
| Cash & equivalents | year end | `CashAndCashEquivalentsAtCarryingValue` → `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents` → `CashAndDueFromBanks` → `Cash` | `CashAndCashEquivalents` → `Cash` |
| Goodwill | year end | `Goodwill` | `Goodwill` |
| Intangibles (excluding goodwill) | year end | `IntangibleAssetsNetExcludingGoodwill` → `FiniteLivedIntangibleAssetsNet` | `IntangibleAssetsOtherThanGoodwill` |
| Intangibles including goodwill (one total) | year end | `IntangibleAssetsNetIncludingGoodwill` | `IntangibleAssetsAndGoodwill` |
| Operating cash flow | full year | `NetCashProvidedByUsedInOperatingActivities` → `NetCashProvidedByUsedInOperatingActivitiesContinuingOperations` | `CashFlowsFromUsedInOperatingActivities` |
| Capital expenditure | full year | `PaymentsToAcquirePropertyPlantAndEquipment` | `PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities` → `PurchaseOfPropertyPlantAndEquipment` |
| Dividends per share | full year | `CommonStockDividendsPerShareDeclared` → `CommonStockDividendsPerShareCashPaid` | `DividendsRecognisedAsDistributionsToOwnersPerShare` |
| Dividends paid (total) | full year | `PaymentsOfDividendsCommonStock` → `PaymentsOfDividends` | `DividendsPaidClassifiedAsFinancingActivities` → `DividendsPaid` → `DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities` |

**EPS fallback:** if a year has no EPS tag, EPS = net income ÷ diluted shares.

**Banks:** `Revenues` for a bank is normally total revenue **net of interest expense**. That's interest income − interest expense + non-interest income, which is the "Total revenue, net of interest expense" line on its income statement.

---

## 4. Screener columns: the calculations

"Latest" means the most recent fiscal year. A dash (—) means a figure needed for the calculation wasn't reported. On the Screener, green means the value passes your rule and red means it fails.

### Price and size

| Column | Calculation | Where to find it |
|---|---|---|
| **Price** | Last weekly closing price in the price file. | Defeat Beta `stock_prices.parquet`; Yahoo Finance history page for the ticker. |
| **Market cap** | Price × latest diluted shares | Shares: the income statement's "weighted average diluted shares". This is an estimate, because the true market cap uses shares outstanding today. |
| **Revenue (latest FY)** | Latest revenue as reported | Income statement, top line. |

### Balance sheet (all at the latest year end)

| Column | Calculation | Where to find it |
|---|---|---|
| **Current assets** | As reported | Balance sheet, "Total current assets" |
| **Current liabilities** | As reported | Balance sheet, "Total current liabilities" |
| **Cash & equivalents** | As reported | Balance sheet, first line under assets |
| **Total debt** | Long-term debt + debt due within a year | Balance sheet, or the debt note |
| **Shareholders' equity** | As reported (excluding minority interests where possible) | Balance sheet, "Total shareholders' equity" |
| **Intangibles & goodwill** | Goodwill + other intangibles | Balance sheet |

**Total debt:**
- debt due within a year = `DebtCurrent` if it's tagged, otherwise (current part of long-term debt + short-term borrowings), counting any missing piece as 0
- total debt = long-term debt + debt due within a year, counting a missing piece as 0
- If neither piece is reported, it's —.

**Intangibles & goodwill:**
- If goodwill or intangibles is reported, the value is goodwill + intangibles, counting a missing one as 0.
- Otherwise, the company's combined "intangibles including goodwill" figure is used.

### Ratios

| Column | Calculation | Notes |
|---|---|---|
| **Current ratio** | current assets ÷ current liabilities | Graham wanted at least 2. |
| **LT debt ÷ net current assets** | long-term debt ÷ (current assets − current liabilities) | Graham: long-term debt should not exceed net current assets, so ≤ 1. If net current assets are 0 or negative, it shows ∞. |
| **Debt / equity** | long-term debt ÷ shareholders' equity | Only when equity > 0. |
| **Liabilities / equity** | total liabilities ÷ equity | Only when equity > 0. |
| **Return on equity** | latest net income ÷ latest equity | Only when equity > 0. Year-end equity is used, not the average. |
| **Net margin** | net income ÷ revenue | |

### Earnings record

| Column | Calculation |
|---|---|
| **Years of positive earnings (in a row)** | Count back from the latest year while EPS > 0. Stops at the first loss or missing year. |
| **Years of dividends (in a row)** | Count back from the latest year while dividends per share > 0 **or** dividends paid > 0. |
| **EPS growth, 3-yr avg vs 10 yrs ago** | (average EPS of the last 3 years ÷ average EPS of the first 3 years in the last 11) − 1. It needs at least 6 years, and the old average must be > 0. This is Graham's "earnings growth" test, which looks for at least +33%. |
| **EPS growth (CAGR)** | (last EPS ÷ first EPS)^(1 ÷ years between) − 1, over up to the last 10 years. Both EPS values must be > 0. |
| **Revenue growth (CAGR)** | The same formula, applied to revenue. |

### Valuation (uses the price)

| Column | Calculation |
|---|---|
| **P/E (latest EPS)** | price ÷ latest EPS. Only when EPS > 0. |
| **P/E (3-yr avg EPS)** | price ÷ average EPS of the last 3 years. Only when that average is > 0. Graham: ≤ 15. |
| **P/B** | price ÷ book value per share, where book value per share = equity ÷ diluted shares. Only when it's > 0. |
| **P/E × P/B** | P/E (3-yr avg) × P/B. Graham: ≤ 22.5. |
| **Dividend yield** | latest dividends per share ÷ price |
| **Free cash flow yield** | (operating cash flow − capital expenditure) ÷ market cap |
| **Graham number** | √(22.5 × latest EPS × book value per share). Only when both are > 0. |
| **Intrinsic value (Graham formula)** | V = average EPS (3 yrs) × (8.5 + 2g) × 4.4 ÷ Y |
| **Margin of safety** | (intrinsic value − price) ÷ intrinsic value |

**Intrinsic value formula:**
- **g** is the EPS growth (CAGR) as a percentage, kept between 0 and the cap on My Rules (default 15).
- **Y** is the AAA corporate bond yield set on My Rules (default 5.0).
- 8.5 is Graham's P/E for a company with no growth.
- 4.4 was the AAA yield when Graham wrote the formula.
- This is Graham's revised formula from *The Intelligent Investor*, using a 3-year average EPS to smooth one-off years.

**Margin of safety:** a positive value means the price is below the estimate. Your rule default is 25% (switched off).

### Rules passed

**Rules passed** is the number of switched-on rules the company passes, out of the number switched on.
- A rule passes when `value >= threshold` or `value <= threshold`, depending on the rule.
- A rule with no value (—) counts as **not passed**. The badge's tooltip says how many had no data.
- The default rules are Graham's seven tests for the defensive investor:

| Rule | Test |
|---|---|
| Adequate size | revenue ≥ $2B |
| Strong financial condition | current ratio ≥ 2 |
| Debt covered by working capital | LT debt ÷ net current assets ≤ 1 |
| Earnings stability | ≥ 10 years of positive earnings |
| Dividend record | ≥ 10 years of dividends |
| Earnings growth | ≥ 33% |
| Moderate P/E | P/E (3-yr) ≤ 15 |
| Moderate price to assets | P/E × P/B ≤ 22.5 |

Margin of safety, return on equity and low leverage are also available but start switched off. All thresholds can be edited on My Rules.

---

## 5. Other values

| Where | Value | Calculation |
|---|---|---|
| Company page | Price chart | Weekly closes for the last 5 years (the last close of each week). |
| Graham's Analysis | Week's move | (latest close ÷ previous week's close) − 1 |
| Graham's Analysis | vs 10-week avg | (latest close ÷ average of the last 10 weekly closes) − 1. 10 weeks ≈ 50 trading days. This is a trend check, not one of Graham's tests, and it doesn't affect the verdict. |
| Graham's Analysis | Verdict | **Value buy** if the margin of safety is at least 20% and at least 75% of your rules pass. **Overpriced** if the margin of safety is below 0. **Watch** otherwise. **No estimate** if there's no intrinsic value. |
| Graham's Analysis / ticker tape | "Biggest 30" | The 30 companies with the largest market cap (see above). |
| Ticker tape | ▲ / ▼ % | The same as Week's move. |

---

## 6. Foreign companies: 20-F filers

**Who they are:** foreign private issuers from any country outside Canada that list shares (often ADRs) in the US. Examples are TSM (Taiwan), NVO (Denmark) and SONY (Japan). Their annual report is a **Form 20-F**.

**How they're recognised:** a company is marked **foreign** if any annual fact it filed is on a 20-F or 40-F.

**Which tags:**
- If the company files with US GAAP tags, the US GAAP column in section 3 is used.
- If it only has IFRS facts (`ifrs-full:`), the IFRS column is used. This is the usual case for 20-F filers.
- If both exist, US GAAP wins.

**Reporting currency:** this is the currency unit that appears most often across the company's annual Assets and Revenue facts, for example TWD for TSM or JPY for Sony.

**Conversion to USD** (so it can be compared with US companies):
- money value in USD = reported value ÷ (units of that currency per 1 USD on the fiscal year-end date)
- The rate is the last one on or before the period end, from `exchange_rate.parquet` (e.g. `TWD=X`). If the rate history starts later, its first rate is used.
- Per-share figures (EPS, dividends per share) are converted the same way. Share counts are not converted.
- Each year uses its own year-end rate. The rate is stored as `fxRate` in `public/data/us/companies/<TICKER>.json`.
- The Screener also shows the figure as reported underneath. For example, "NT$3.20T reported" is the latest year's USD value × that year's rate.

**What's not shown for foreign filers:**

| Hidden | Why |
|---|---|
| P/E, P/E 3-yr, P/B, P/E × P/B, market cap, dividend yield, FCF yield, Graham number, intrinsic value, margin of safety | One US-traded ADR often equals several home-market shares (TSM: 1 ADR = 5 shares). EPS and shares in the filing are per home share, so dividing the ADR price by them would be wrong. |
| Every money column (revenue, balance sheet items) | Only when no exchange rate was found for the currency. They're hidden rather than shown in a mix of currencies. |

All the other ratios (current ratio, debt ratios, ROE, margins, earnings record, growth) don't depend on the currency, so they're calculated exactly as in section 4.

**Where to find the numbers in a 20-F:** they're in **Item 18, Financial Statements**, usually near the end of the main 20-F document. Some companies put them in an exhibit (e.g. Exhibit 15 or 99) instead. Look for "Consolidated Statements of Profit or Loss" (IFRS) or "Consolidated Statements of Income" (US GAAP), "Consolidated Statements of Financial Position" or "Balance Sheets", and "Consolidated Statements of Cash Flows".

**Things that differ from 10-K companies:**
- A 20-F is due up to four months after year end, so their latest year can lag behind US companies.
- IFRS "profit attributable to owners of the parent" is used for net income. That excludes minority interests, like US GAAP `NetIncomeLoss`.
- Under IFRS, interest paid and dividends can sit in different cash-flow sections. Only the capital expenditure and operating cash flow tags listed above are used.

---

## 7. Foreign companies: 40-F filers

**Who they are:** Canadian companies that use the Multijurisdictional Disclosure System (MJDS) to file their Canadian annual report with the SEC as a **Form 40-F**. Examples are Canadian banks such as RY and TD, and energy companies such as CNQ and SU.

**Recognition, tags, currency and conversion:** these all work exactly as for 20-F filers (section 6). In practice:
- Most 40-F filers report under **IFRS**, so the `ifrs-full:` tags are used. A few report under US GAAP, so the US GAAP tags are used.
- The currency is often **CAD**, converted with `CAD=X`. Some report in **USD** already, so nothing is converted.
- The same price ratios are hidden. Most 40-F companies trade one-for-one in New York, but the app can't verify that per company, so it treats every foreign filer the same.

**Where to find the numbers in a 40-F:** the 40-F form itself is mostly a cover document. The financial statements are attached as **exhibits**. Look for the exhibit called "Audited Annual Consolidated Financial Statements", usually Exhibit 99.2 or 99.3, with "Management's Discussion and Analysis" (MD&A) as another exhibit. Open the filing index page the app links to and pick that exhibit.

**Things that differ from 10-K companies:**
- Canadian banks' fiscal year ends on 31 October, so their year is labelled by that date's year.
- Foreign filers using IFRS only had to tag their statements in XBRL from about 2018, and this applies to 20-F filers too. So their history in the app may only be a few years long, which affects the "years of earnings/dividends" and the 10-year growth tests.

---

## 8. Currencies and exchange rates

The app stores every money figure in **USD**. When you pick another currency on the Screener:

- **Money shown** = USD value × rate. The rate is units of the chosen currency per 1 USD.
- **Rate used:** your own rate if you set one with Edit. Otherwise it's the market rate, which is the latest close of `<CODE>=X` in `exchange_rate.parquet`, saved when you run `npm run fetch:us`. If there's no rate, money stays in USD.
- The price also shows the original USD figure underneath ("$190.00 in New York").
- **Rules always use the USD figures**, so changing the currency never changes which companies pass.
- The ticker tape and Graham's Analysis use the same currency and rate as the Screener.
- The Chinese currency is shown as RMB. Its ISO code, CNY, is what's looked up in the rate file.

The available currencies are USD, SGD, EUR, GBP, JPY, RMB (CNY), HKD, TWD, KRW, INR, AUD, CAD, CHF, SEK, NOK, DKK, NZD, MXN, BRL, ZAR and MYR.

---

## 9. Worked example: tracing a number back to the filing

**BAC 2011 revenue, $93.45B**

1. On BAC's company page, click the 2011 revenue figure. It opens the filing index for accession `0000070858-14-000012`, which is the 10-K for fiscal 2013, filed 2014-02-25.
2. Why this filing: it's the most recent annual report that includes 2011 (section 2, step 3). Every 10-K repeats the two previous years.
3. Open the main document, `bac-12312013x10k.htm`, and search for **"Consolidated Statement of Income"**.
4. In the 2011 column, the line **"Total revenue, net of interest expense"** reads about 93,454 (millions of dollars), which is $93.45B.
5. In the XBRL data file (`bac-20131231.xml`) the same figure is tagged `us-gaap:Revenues`, with a period of 2011-01-01 to 2011-12-31.

The same method works for any number:
- **Income statement and cash-flow items:** look in the column for that year.
- **Balance-sheet items:** look at the column for that year-end date.
- **Calculated columns (section 4):** find each input the same way, then apply the formula.
- **20-F and 40-F companies:** convert using that year's `fxRate` from `companies/<TICKER>.json`.
