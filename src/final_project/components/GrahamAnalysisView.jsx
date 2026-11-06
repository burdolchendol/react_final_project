import { useMemo, useState } from "react";
import { computeMetrics } from "../utils/metrics";
import { evaluateRules, grahamVerdict, VALUE_BUY_MARGIN, VALUE_BUY_RULES } from "../utils/rules";
import { formatMoney } from "../utils/format";
import { ScoreBadge } from "./ScreenerView";

const LIST_SIZE = 30;
const VERDICT_CLASS = { "Value buy": "up", Overpriced: "down", Watch: "", "No estimate": "cell-sub" };
const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// Graham-style check on real data: price against its recent trend, the Graham
// formula's intrinsic value, the margin of safety, and how many of your rules pass.
export default function GrahamAnalysisView({
  companies, loading, rules, settings, watchlist, currency, rate, onOpenCompany,
}) {
  const [mode, setMode] = useState("biggest"); // "biggest" | "favorites"

  const rows = useMemo(() => {
    const all = companies
      .filter((c) => c.price?.last != null)
      .map((company) => {
        const metrics = computeMetrics(company, settings);
        const verdict = evaluateRules(rules, metrics);
        const { last, prev, avg10w } = company.price;
        return {
          company,
          metrics,
          verdict,
          weekMove: prev ? (last / prev - 1) * 100 : null,
          vsAverage: avg10w ? (last / avg10w - 1) * 100 : null,
          label: grahamVerdict(metrics.marginOfSafety, verdict.total ? verdict.passed / verdict.total : 0),
        };
      });
    if (mode === "favorites") return all.filter((r) => watchlist.has(r.company.ticker));
    return all.sort((a, b) => (b.metrics.marketCap ?? -1) - (a.metrics.marketCap ?? -1)).slice(0, LIST_SIZE);
  }, [companies, rules, settings, watchlist, mode]);

  const money = (usd) => (usd == null ? "—" : formatMoney(usd * rate, currency));

  return (
    <div className="page2">
      <h2 className="h2">Graham's Analysis</h2>
      <p className="page-sub">
        Real prices and annual reports, checked the way Benjamin Graham would: is the price below the Graham
        formula's intrinsic value, and does the company pass your rules? "Value buy" means a margin of safety of
        at least {VALUE_BUY_MARGIN * 100}% and at least {VALUE_BUY_RULES * 100}% of your rules passed. Not financial
        advice.
      </p>

      <div className="controls">
        <div className="tape-toggle graham-toggle">
          <button
            className={`tape-toggle-btn ${mode === "biggest" ? "tape-toggle-btn-active" : ""}`}
            onClick={() => setMode("biggest")}
          >
            Biggest {LIST_SIZE}
          </button>
          <button
            className={`tape-toggle-btn ${mode === "favorites" ? "tape-toggle-btn-active" : ""}`}
            onClick={() => setMode("favorites")}
          >
            ★ Favorites
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="cell-sub graham-empty">
          {loading
            ? "Loading…"
            : mode === "favorites"
              ? "No favorites yet — star a company on the Screener to see it here."
              : "No prices yet — run npm run fetch:us to load the data."}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Price</th>
                <th title="Change from the previous week's close">Week's move</th>
                <th title="Price against its 10-week average (about 50 trading days)">vs 10-week avg</th>
                <th title="Graham formula, using your AAA yield and growth cap from My Rules">Intrinsic value</th>
                <th>Margin of safety</th>
                <th>Rules passed</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ company, metrics, verdict, weekMove, vsAverage, label }) => (
                <tr key={company.ticker} className="clickable-row" onClick={() => onOpenCompany(company.ticker)}>
                  <td>
                    <div className="mono bold">{company.ticker}</div>
                    <div className="cell-sub">{company.name}</div>
                  </td>
                  <td className="mono" title={`Close ${company.price.asOf}`}>{money(metrics.price)}</td>
                  <td className={`mono ${weekMove == null ? "" : weekMove >= 0 ? "up" : "down"}`}>
                    {weekMove == null ? "—" : pct(weekMove)}
                  </td>
                  <td className={`mono ${vsAverage == null ? "" : vsAverage >= 0 ? "up" : "down"}`}>
                    {vsAverage == null ? "—" : `${vsAverage >= 0 ? "Above" : "Below"} by ${Math.abs(vsAverage).toFixed(1)}%`}
                  </td>
                  <td className="mono">{money(metrics.intrinsicValue)}</td>
                  <td className={`mono bold ${metrics.marginOfSafety == null ? "" : metrics.marginOfSafety >= 0 ? "up" : "down"}`}>
                    {metrics.marginOfSafety == null ? "—" : `${(metrics.marginOfSafety * 100).toFixed(1)}%`}
                  </td>
                  <td>
                    <ScoreBadge verdict={verdict} />
                  </td>
                  <td className={`bold ${VERDICT_CLASS[label]}`}>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
