import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCompanyFacts } from "../scripts/providers/secEdgar.mjs";

const fy = (start, end, val, filed, form = "10-K") => ({ start, end, val, filed, form, fp: "FY", accn: `accn-${filed}` });
const inst = (end, val, filed, form = "10-K") => ({ end, val, filed, form, fp: "FY" });

const facts = {
  facts: {
    "us-gaap": {
      // Company switched revenue tags in 2018: both must merge.
      Revenues: { units: { USD: [fy("2016-01-01", "2016-12-31", 100, "2017-02-01"), fy("2017-01-01", "2017-12-31", 110, "2018-02-01")] } },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            fy("2018-01-01", "2018-12-31", 120, "2019-02-01"),
            // Quarterly figure in a 10-K must be ignored.
            fy("2018-10-01", "2018-12-31", 35, "2019-02-01"),
            // Same period from a 10-Q is ignored.
            fy("2018-01-01", "2018-12-31", 999, "2018-11-01", "10-Q"),
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            fy("2016-01-01", "2016-12-31", 10, "2017-02-01"),
            fy("2017-01-01", "2017-12-31", 11, "2018-02-01"),
            // Restated later: the newest filing wins.
            fy("2017-01-01", "2017-12-31", 12, "2019-02-01"),
            fy("2018-01-01", "2018-12-31", 13, "2019-02-01"),
          ],
        },
      },
      EarningsPerShareDiluted: { units: { "USD/shares": [fy("2018-01-01", "2018-12-31", 1.3, "2019-02-01")] } },
      Assets: { units: { USD: [inst("2018-12-31", 500, "2019-02-01")] } },
      StockholdersEquity: { units: { USD: [inst("2018-12-31", 200, "2019-02-01")] } },
    },
  },
};

test("normalizeCompanyFacts merges tags, keeps annual 10-K values and latest restatements", () => {
  const years = normalizeCompanyFacts(facts);
  assert.deepEqual(years.map((y) => y.fiscalYear), [2016, 2017, 2018]);
  assert.deepEqual(years.map((y) => y.revenue), [100, 110, 120]);
  assert.equal(years[1].netIncome, 12);
  assert.equal(years[2].epsDiluted, 1.3);
  assert.equal(years[0].epsDiluted, null);
});

test("normalizeCompanyFacts records the filing each value came from", () => {
  const years = normalizeCompanyFacts(facts);
  // The restated 2017 net income comes from the 2019 filing.
  assert.equal(years[1].accn.netIncome, "accn-2019-02-01");
  assert.equal(years[1].accn.revenue, "accn-2018-02-01");
  assert.equal(years[0].accn.epsDiluted, undefined);
});

test("normalizeCompanyFacts derives total liabilities when not reported", () => {
  const latest = normalizeCompanyFacts(facts).at(-1);
  assert.equal(latest.totalLiabilities, 300);
  assert.equal(latest.totalLiabilitiesDerived, true);
});

test("normalizeCompanyFacts handles empty input", () => {
  assert.deepEqual(normalizeCompanyFacts({}), []);
});
