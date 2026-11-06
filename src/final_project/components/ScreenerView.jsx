import { useEffect, useMemo, useRef, useState } from "react";
import { loadMarketIndex } from "../data/markets";
import useAsync from "../hooks/useAsync";
import { METRICS, computeMetrics } from "../utils/metrics";
import { evaluateRules } from "../utils/rules";
import { formatMetric } from "../utils/format";
import MarketPicker from "./MarketPicker";
import CurrencyBar from "./CurrencyBar";
import { displayRate } from "../data/currencies";
import DataStatus from "./DataStatus";
import useColumnLayout from "../hooks/useColumnLayout";
import { orderColumns, clampWidth, STAR_WIDTH, FALLBACK_WIDTH } from "../utils/columnLayout";

const PAGE_SIZE = 50;
// Shown after the columns for your rules, unless a rule already shows them.
const EXTRA_COLUMNS = [
  "marketCap", "pe3", "pb", "currentRatio", "debtToEquity", "roe", "epsCagr", "intrinsicValue", "marginOfSafety",
  "currentAssets", "currentLiabilities", "cash", "totalDebt", "equity", "intangiblesGoodwill",
];

// Money columns that come from the filings, so a foreign filer has a reported-currency figure.
const REPORTED_KEYS = new Set([
  "revenue", "currentAssets", "currentLiabilities", "cash", "totalDebt", "equity", "intangiblesGoodwill",
]);

// The exchange as SEC lists it ("NYSE", "Nasdaq", "CBOE"), in its usual spelling.
const exchangeName = (exchange) => (!exchange ? "US market" : exchange.toUpperCase() === "CBOE" ? "Cboe" : exchange);

// Per metric: "fail" if any rule on it fails, else "pass" if one passes, else "na".
function statusByMetric(verdict) {
  const out = {};
  for (const { rule, status } of verdict.results) {
    const prev = out[rule.metric];
    if (status === "fail" || (status === "pass" && prev !== "fail") || !prev) out[rule.metric] = status;
  }
  return out;
}

export default function ScreenerView({
  market, setMarket, rules, settings, watchlist, toggleStar, clearStars, hiddenColumns, setHiddenColumns,
  displayCurrency, setDisplayCurrency, customRates, setCustomRates,
  columnOrder, setColumnOrder, columnWidths, setColumnWidths, onOpenCompany,
}) {
  const { data, error, loading } = useAsync(() => loadMarketIndex(market), market);
  const [sort, setSort] = useState({ key: "score", dir: -1 });
  const [query, setQuery] = useState("");
  const [minPassed, setMinPassed] = useState(0);
  const [hideNoPrice, setHideNoPrice] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [origin, setOrigin] = useState("all"); // "all" | "us" | "foreign"
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
        (origin === "all" || (origin === "foreign") === Boolean(company.foreign)) &&
        (!hideNoPrice || !anyPriced || metrics.price != null) &&
        (!favoritesOnly || watchlist.has(company.ticker)) &&
        (!q || company.ticker.toLowerCase().startsWith(q) || company.name.toLowerCase().includes(q))
    );
  }, [rows, query, minPassed, hideNoPrice, anyPriced, origin, favoritesOnly, watchlist]);

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

  // One column per metric your rules check, in rule order, then the usual extras.
  const ruleColumns = useMemo(() => [...new Set(rules.filter((r) => r.enabled).map((r) => r.metric))], [rules]);
  const allColumns = useMemo(
    () => ["price", ...ruleColumns.filter((k) => k !== "price"), ...EXTRA_COLUMNS.filter((k) => !ruleColumns.includes(k))],
    [ruleColumns]
  );
  // "Rules passed" (score) moves like any other column; star and Company stay first.
  const movable = useMemo(() => orderColumns(["score", ...allColumns], columnOrder), [allColumns, columnOrder]);
  const columns = movable.filter((k) => !hiddenColumns.includes(k));
  const {
    tableRef, wrapRef, lineRef, ghostRef, tipRef, onHeaderPointerDown, onResizeStart, onResizeFit, wasDrag, measureWidths,
  } =
    useColumnLayout({ order: movable, setOrder: setColumnOrder, setWidths: setColumnWidths });
  // Until a column is resized the table sizes itself; after that, every column has a set width.
  const fixedWidths = Object.keys(columnWidths).length > 0;
  const widthOf = (key) => columnWidths[key] ?? FALLBACK_WIDTH;
  const tableWidth = STAR_WIDTH + widthOf("company") + columns.reduce((sum, k) => sum + widthOf(k), 0);
  const customLayout = fixedWidths || (columnOrder?.length ?? 0) > 0;

  // Money is stored in USD; show it in the chosen currency (your rate wins over the market rate).
  // Without any rate for it, fall back to USD.
  const marketRates = data?.fx?.rates ?? {};
  const { currency: shownCurrency, rate: fxRate } = displayRate(displayCurrency, customRates, marketRates);
  const cellText = (company, metrics, key) => {
    const { format } = METRICS[key];
    const value = metrics[key];
    if (format !== "money") return formatMetric(value, format, company.currency);
    const shown = formatMetric(value == null ? value : value * fxRate, "money", shownCurrency);
    // Foreign filers: also show the figure as reported, in their own currency.
    if (REPORTED_KEYS.has(key) && company.reportingCurrency && company.reportingRate && value != null
        && company.reportingCurrency !== shownCurrency) {
      return (
        <>
          {shown}
          <span className="cell-reported">
            {formatMetric(value * company.reportingRate, "money", company.reportingCurrency)} reported
          </span>
        </>
      );
    }
    if (key === "price" && shownCurrency !== "USD" && value != null) {
      return (
        <>
          {shown}
          <span className="cell-reported">{formatMetric(value, "money", "USD")} on {exchangeName(company.exchange)}</span>
        </>
      );
    }
    return shown;
  };
  const ruleTitle = (metric) =>
    rules
      .filter((r) => r.enabled && r.metric === metric)
      .map((r) => `${r.label}: ${r.op === ">=" ? "at least" : "at most"} ${formatMetric(r.threshold, METRICS[metric].format)}`)
      .join("\n");

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
          <label className="control-label" htmlFor="origin">Companies</label>
          <select
            id="origin"
            className="form-input"
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setShown(PAGE_SIZE);
            }}
          >
            <option value="all">All</option>
            <option value="us">US (10-K filers)</option>
            <option value="foreign">Foreign (20-F / 40-F filers)</option>
          </select>
          <label className="control-label checkbox-label">
            <input type="checkbox" checked={hideNoPrice} onChange={(e) => setHideNoPrice(e.target.checked)} /> Hide
            companies without a price
          </label>
          <label className="control-label checkbox-label">
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => {
                setFavoritesOnly(e.target.checked);
                setShown(PAGE_SIZE);
              }}
            />{" "}
            ★ Favorites only ({watchlist.size})
          </label>
          {watchlist.size > 0 && (
            <button
              className="sort-btn"
              onClick={() => {
                const n = watchlist.size;
                if (window.confirm(`Remove all ${n} favorite${n === 1 ? "" : "s"}? This can't be undone.`)) {
                  clearStars();
                  setFavoritesOnly(false);
                }
              }}
            >
              Clear favorites
            </button>
          )}
          <span className="cell-sub">{sorted.length.toLocaleString()} matching</span>
          <span className="cell-sub rule-legend">
            <span className="cell-pass">Green</span> passes your rule · <span className="cell-fail">red</span> fails ·
            hover a gold column heading to see its rule
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-toolbar">
          <CurrencyBar
            currency={displayCurrency}
            setCurrency={setDisplayCurrency}
            marketRates={marketRates}
            customRates={customRates}
            setCustomRates={setCustomRates}
            asOf={data?.fx?.asOf}
          />
          {customLayout && (
            <button
              className="sort-btn"
              onClick={() => {
                setColumnOrder([]);
                setColumnWidths({});
              }}
              title="Put columns back in their usual order and size"
            >
              Reset layout
            </button>
          )}
          <ColumnPicker
            columns={movable.filter((k) => k !== "score")}
            ruleColumns={ruleColumns}
            hidden={hiddenColumns}
            setHidden={setHiddenColumns}
            measureWidths={measureWidths}
            setWidths={setColumnWidths}
          />
        </div>
      )}

      {sorted.length > 0 && (
        <div className="table-wrap column-layout" ref={wrapRef}>
          <div className="col-drop-line" ref={lineRef} aria-hidden="true" />
          <table
            className={`table screener-table ${fixedWidths ? "fixed-widths" : ""}`}
            ref={tableRef}
            style={fixedWidths ? { width: tableWidth } : undefined}
          >
            {fixedWidths && (
              <colgroup>
                <col style={{ width: STAR_WIDTH }} />
                <col style={{ width: widthOf("company") }} />
                {columns.map((key) => <col key={key} style={{ width: widthOf(key) }} />)}
              </colgroup>
            )}
            <thead>
              <tr>
                <th className="star-cell" aria-label="Starred"></th>
                <th className="sortable" data-col="company" onClick={() => toggleSort("ticker")}>
                  <span className="col-label">Company{arrow("ticker")}</span>
                  <Resizer onStart={onResizeStart} onFit={onResizeFit} col="company" />
                </th>
                {columns.map((key) => {
                  const isRule = ruleColumns.includes(key);
                  const label = key === "score" ? "Rules passed" : METRICS[key].label;
                  return (
                    <th
                      key={key}
                      data-col={key}
                      data-label={label}
                      className={`sortable movable ${isRule ? "rule-col" : ""}`}
                      onPointerDown={(e) => onHeaderPointerDown(e, key)}
                      onClick={() => !wasDrag() && toggleSort(key)}
                      title={isRule ? ruleTitle(key) : `${label} · drag to move`}
                    >
                      <span className="col-label">
                        {label}
                        {arrow(key)}
                      </span>
                      <Resizer onStart={onResizeStart} onFit={onResizeFit} col={key} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, shown).map(({ company, metrics, verdict }) => {
                const status = statusByMetric(verdict);
                return (
                  <tr key={company.ticker} className="clickable-row" onClick={() => onOpenCompany(company.ticker)}>
                    <td className="star-cell">
                      <button
                        className={`star-btn ${watchlist.has(company.ticker) ? "star-on" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(company.ticker);
                        }}
                        aria-label={`${watchlist.has(company.ticker) ? "Unstar" : "Star"} ${company.ticker}`}
                      >
                        {watchlist.has(company.ticker) ? "★" : "☆"}
                      </button>
                    </td>
                    <td>
                      <div className="mono bold">{company.ticker}</div>
                      <div className="cell-sub">
                        {company.name}
                        {company.foreign && (
                          <span className="foreign-tag" title="Files 20-F / 40-F annual reports; price ratios not shown">
                            foreign
                          </span>
                        )}
                      </div>
                    </td>
                    {columns.map((key) =>
                      key === "score" ? (
                        <td key={key}>
                          <ScoreBadge verdict={verdict} />
                        </td>
                      ) : (
                        <td key={key} className={`mono ${status[key] ? `cell-${status[key]}` : ""}`}>
                          {cellText(company, metrics, key)}
                        </td>
                      )
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="col-drag-ghost" ref={ghostRef} aria-hidden="true" />
      <div className="col-width-tip" ref={tipRef} aria-hidden="true" />
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

// The grab line on a heading's right edge: drag to resize, double-click to fit.
function Resizer({ onStart, onFit, col }) {
  return (
    <span
      className="col-resizer"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to fit"
      onPointerDown={(e) => onStart(e, col)}
      onDoubleClick={(e) => onFit(e, col)}
      onClick={(e) => e.stopPropagation()}
    />
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

// "Columns" dropdown: tick the columns to show. Your choice is saved in this browser.
function ColumnPicker({ columns, ruleColumns, hidden, setHidden, measureWidths, setWidths }) {
  const [open, setOpen] = useState(false);
  // "Width" slider: scales every column from the widths they had when it opened.
  const [scaling, setScaling] = useState(null); // null | { base, percent }
  const scaleAll = (percent) => {
    setScaling((s) => ({ ...s, percent }));
    setWidths((prev) => {
      const next = { ...prev };
      for (const [key, w] of Object.entries(scaling.base)) next[key] = clampWidth((w * percent) / 100);
      return next;
    });
  };
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && (setOpen(false), setScaling(null));
    const onKey = (e) => e.key === "Escape" && (setOpen(false), setScaling(null));
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (key) =>
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const shownCount = columns.filter((k) => !hidden.includes(k)).length;

  return (
    <div className="column-picker" ref={ref}>
      <button className="sort-btn" onClick={() => {
          setOpen((o) => !o);
          setScaling(null);
        }} aria-expanded={open} aria-haspopup="true">
        Columns ({shownCount}/{columns.length}) ▾
      </button>
      {open && (
        <div className="column-menu" role="menu">
          <div className="column-menu-actions">
            <button className="sort-btn" onClick={() => setHidden([])}>Show all</button>
            <button className="sort-btn" onClick={() => setHidden(columns.filter((k) => k !== "price"))}>
              Hide all
            </button>
            <button
              className={`sort-btn ${scaling ? "sort-btn-active" : ""}`}
              onClick={() => setScaling((s) => (s ? null : { base: measureWidths(), percent: 100 }))}
              aria-expanded={Boolean(scaling)}
            >
              Width
            </button>
          </div>
          {scaling && (
            <div className="width-slider">
              <label htmlFor="all-widths">All column widths</label>
              <input
                id="all-widths"
                type="range"
                min="50"
                max="200"
                step="5"
                value={scaling.percent}
                onChange={(e) => scaleAll(Number(e.target.value))}
              />
              <span className="mono">{scaling.percent}%</span>
            </div>
          )}
          {columns.map((key) => (
            <label key={key} className="column-option">
              <input type="checkbox" checked={!hidden.includes(key)} onChange={() => toggle(key)} />
              <span className={ruleColumns.includes(key) ? "rule-col-label" : ""}>{METRICS[key].label}</span>
            </label>
          ))}
          <p className="cell-sub">Gold columns are checked by your rules.</p>
        </div>
      )}
    </div>
  );
}
