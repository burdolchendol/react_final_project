import { useMemo, useState } from "react";
import { loadMarketIndex } from "../data/markets";
import useAsync from "../hooks/useAsync";
import { METRICS, computeMetrics } from "../utils/metrics";
import { evaluateRules } from "../utils/rules";
import { formatMetric } from "../utils/format";
import MarketPicker from "./MarketPicker";
import DataStatus from "./DataStatus";

const COLUMNS = ["price", "pe3", "pb", "currentRatio", "debtToEquity", "roe", "epsCagr", "intrinsicValue", "marginOfSafety"];

export default function ScreenerView({ market, setMarket, rules, settings, onOpenCompany }) {
  const { data, error, loading } = useAsync(() => loadMarketIndex(market), market);
  const [sort, setSort] = useState({ key: "score", dir: -1 });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.companies.map((company) => {
      const metrics = computeMetrics(company, settings);
      return { company, metrics, verdict: evaluateRules(rules, metrics) };
    });
  }, [data, rules, settings]);

  const sorted = useMemo(() => {
    const value = (r) => {
      if (sort.key === "score") return r.verdict.applicable ? r.verdict.passed / r.verdict.total : -1;
      if (sort.key === "ticker") return r.company.ticker;
      return r.metrics[sort.key];
    };
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sort.dir;
    });
  }, [rows, sort]);

  const toggleSort = (key) =>
    setSort((prev) => ({ key, dir: prev.key === key ? -prev.dir : key === "ticker" ? 1 : -1 }));
  const arrow = (key) => (sort.key === key ? (sort.dir > 0 ? " ▲" : " ▼") : "");

  return (
    <div className="page2">
      <h2 className="h2">Fundamentals Screener</h2>
      <p className="page-sub">
        Real company financials from annual reports, scored against your rules. Click a company for the full
        picture. Information only, not financial advice.
      </p>

      <MarketPicker market={market} setMarket={setMarket} />
      <DataStatus loading={loading} error={error} index={data} />

      {sorted.length > 0 && (
        <div className="table-wrap">
          <table className="table screener-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("ticker")}>Company{arrow("ticker")}</th>
                <th className="sortable" onClick={() => toggleSort("score")}>Rules passed{arrow("score")}</th>
                {COLUMNS.map((key) => (
                  <th key={key} className="sortable" onClick={() => toggleSort(key)}>
                    {METRICS[key].label}
                    {arrow(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ company, metrics, verdict }) => (
                <tr key={company.ticker} className="clickable-row" onClick={() => onOpenCompany(company.ticker)}>
                  <td>
                    <div className="mono bold">{company.ticker}</div>
                    <div className="cell-sub">{company.name}</div>
                  </td>
                  <td>
                    <ScoreBadge verdict={verdict} />
                  </td>
                  {COLUMNS.map((key) => (
                    <td key={key} className="mono">
                      {formatMetric(metrics[key], METRICS[key].format, company.currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ScoreBadge({ verdict }) {
  const { passed, total, applicable } = verdict;
  const share = total ? passed / total : 0;
  const tone = share >= 0.75 ? "score-good" : share >= 0.5 ? "score-mid" : "score-bad";
  return (
    <span className={`score-badge ${tone}`} title={`${total - applicable} rule(s) had no data`}>
      {passed}/{total}
    </span>
  );
}
