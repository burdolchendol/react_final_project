import { useMemo, useState } from "react";
import { loadMarketIndex } from "../data/markets";
import useAsync from "../hooks/useAsync";
import { METRICS, computeMetrics } from "../utils/metrics";
import { evaluateRules } from "../utils/rules";
import { formatMetric } from "../utils/format";
import MarketPicker from "./MarketPicker";
import DataStatus from "./DataStatus";

const PAGE_SIZE = 50;
const COLUMNS = ["price", "marketCap", "pe3", "pb", "currentRatio", "debtToEquity", "roe", "epsCagr", "intrinsicValue", "marginOfSafety"];

export default function ScreenerView({ market, setMarket, rules, settings, onOpenCompany }) {
  const { data, error, loading } = useAsync(() => loadMarketIndex(market), market);
  const [sort, setSort] = useState({ key: "score", dir: -1 });
  const [query, setQuery] = useState("");
  const [minPassed, setMinPassed] = useState(0);
  const [hideNoPrice, setHideNoPrice] = useState(true);
  const [shown, setShown] = useState(PAGE_SIZE);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.companies.map((company) => {
      const metrics = computeMetrics(company, settings);
      return { company, metrics, verdict: evaluateRules(rules, metrics) };
    });
  }, [data, rules, settings]);

  // Snapshots built without prices would otherwise hide everything.
  const anyPriced = useMemo(() => rows.some((r) => r.metrics.price != null), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      ({ company, metrics, verdict }) =>
        verdict.passed >= minPassed &&
        (!hideNoPrice || !anyPriced || metrics.price != null) &&
        (!q || company.ticker.toLowerCase().startsWith(q) || company.name.toLowerCase().includes(q))
    );
  }, [rows, query, minPassed, hideNoPrice, anyPriced]);

  const sorted = useMemo(() => {
    const value = (r) => {
      if (sort.key === "score") return r.verdict.applicable ? r.verdict.passed / r.verdict.total : -1;
      if (sort.key === "ticker") return r.company.ticker;
      return r.metrics[sort.key];
    };
    // Ties (common for scores) go to the bigger company.
    const bySize = (a, b) => (b.metrics.marketCap ?? -1) - (a.metrics.marketCap ?? -1);
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null && vb == null) return bySize(a, b);
      if (va == null) return 1;
      if (vb == null) return -1;
      const diff = (typeof va === "string" ? va.localeCompare(vb) : va - vb) * sort.dir;
      return diff || bySize(a, b);
    });
  }, [filtered, sort]);

  const enabledRules = rules.filter((r) => r.enabled).length;

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

      {rows.length > 0 && (
        <div className="controls screener-filters">
          <input
            className="form-input search-input"
            type="search"
            placeholder="Search ticker or company"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE_SIZE);
            }}
            aria-label="Search companies"
          />
          <label className="control-label" htmlFor="min-passed">Passes at least</label>
          <select
            id="min-passed"
            className="form-input"
            value={minPassed}
            onChange={(e) => {
              setMinPassed(Number(e.target.value));
              setShown(PAGE_SIZE);
            }}
          >
            {Array.from({ length: enabledRules + 1 }, (_, n) => (
              <option key={n} value={n}>{n} of {enabledRules} rules</option>
            ))}
          </select>
          <label className="control-label checkbox-label">
            <input type="checkbox" checked={hideNoPrice} onChange={(e) => setHideNoPrice(e.target.checked)} /> Hide
            companies without a price
          </label>
          <span className="cell-sub">{sorted.length.toLocaleString()} matching</span>
        </div>
      )}

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
              {sorted.slice(0, shown).map(({ company, metrics, verdict }) => (
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
      {sorted.length > shown && (
        <div className="controls show-more">
          <button className="sort-btn" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, sorted.length - shown)} more ({(sorted.length - shown).toLocaleString()} left)
          </button>
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
