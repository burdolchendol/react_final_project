import { useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { loadMarketIndex, loadCompanyDetail, loadPriceHistory } from "../data/markets";
import useAsync from "../hooks/useAsync";
import { METRICS, computeMetrics } from "../utils/metrics";
import { evaluateRules } from "../utils/rules";
import { formatMetric, formatMoney } from "../utils/format";
import { ScoreBadge } from "./ScreenerView";
import { secFilingUrl } from "../utils/sources";

const KEY_METRICS = [
  "marketCap", "pe", "pe3", "pb", "currentRatio", "debtToEquity", "roe", "netMargin",
  "revenueCagr", "epsCagr", "dividendYield", "fcfYield", "grahamNumber", "intrinsicValue", "marginOfSafety",
];

const RANGES = { "1Y": 365, "3Y": 365 * 3, "5Y": 365 * 5 };

const FINANCIAL_ROWS = [
  ["revenue", "Revenue", "money"],
  ["netIncome", "Net income", "money"],
  ["epsDiluted", "EPS (diluted)", "eps"],
  ["dividendsPerShare", "Dividends / share", "eps"],
  ["totalAssets", "Total assets", "money"],
  ["totalLiabilities", "Total liabilities", "money"],
  ["equity", "Shareholders' equity", "money"],
  ["currentAssets", "Current assets", "money"],
  ["currentLiabilities", "Current liabilities", "money"],
  ["longTermDebt", "Long-term debt", "money"],
  ["operatingCashFlow", "Operating cash flow", "money"],
  ["capex", "Capital expenditure", "money"],
];

const AXIS = { fill: "#7C8AA0", fontSize: 11 };
const TOOLTIP = {
  contentStyle: { background: "#121B2E", border: "1px solid #1E2A42", borderRadius: 6 },
  labelStyle: { color: "#E8ECF1" },
  itemStyle: { fontSize: 12 },
};

export default function CompanyView({ market, ticker, rules, settings, onBack }) {
  const index = useAsync(() => loadMarketIndex(market), market);
  const detail = useAsync(() => loadCompanyDetail(market, ticker), `${market}:${ticker}`);
  const prices = useAsync(() => loadPriceHistory(market, ticker), `${market}:${ticker}`);
  const history = prices.data?.history;
  const [range, setRange] = useState("1Y");

  const company = index.data?.companies.find((c) => c.ticker === ticker);
  const metrics = useMemo(() => company && computeMetrics(company, settings), [company, settings]);
  const verdict = useMemo(() => metrics && evaluateRules(rules, metrics), [rules, metrics]);

  const chartData = useMemo(() => {
    if (!history?.length) return [];
    const last = Date.parse(history[history.length - 1][0]);
    const since = last - RANGES[range] * 86_400_000;
    return history.filter(([d]) => Date.parse(d) >= since).map(([date, close]) => ({ date, close }));
  }, [history, range]);

  if (index.loading) return <div className="page2"><p className="data-note">Loading…</p></div>;
  if (!company) {
    return (
      <div className="page2">
        <button className="sort-btn" onClick={onBack}>← Back to screener</button>
        <p className="data-note data-note-error">{index.error?.message ?? `${ticker} is not in the data snapshot.`}</p>
      </div>
    );
  }

  const currency = company.currency;
  // The detail file has the full history and the SEC filing behind each number.
  const years = detail.data?.fiscalYears ?? company.fiscalYears;
  const priceSource = prices.data?.source;
  const secSource = {
    label: "SEC EDGAR filings",
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=10-K`,
  };
  const latestFy = years[years.length - 1];

  return (
    <div className="page2">
      <button className="sort-btn back-btn" onClick={onBack}>← Back to screener</button>

      <div className="detail company-detail">
        <div className="detail-header">
          <div>
            <div className="detail-ticker mono">{company.ticker}</div>
            <div className="detail-name">
              {company.name}
              {company.sector && ` · ${company.sector}`}
              {company.exchange && ` · ${company.exchange}`}
            </div>
          </div>
          <div className="detail-price mono">
            {formatMetric(metrics.price, "money", currency)}
            <span className="detail-change cell-sub">
              {company.price ? `close ${company.price.asOf}` : "price unavailable"}
              {priceSource && (
                <>
                  {" · "}
                  <a className="source-link" href={priceSource.url} target="_blank" rel="noreferrer">
                    {priceSource.label} history ↗
                  </a>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="controls">
          <span className="control-label">Range</span>
          {Object.keys(RANGES).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`sort-btn ${range === r ? "sort-btn-active" : ""}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="chart-wrap">
          {chartData.length > 0 ? (
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1E2A42" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={AXIS} minTickGap={40} />
                <YAxis domain={["auto", "auto"]} tick={AXIS} width={60} />
                <Tooltip {...TOOLTIP} />
                <Line type="monotone" dataKey="close" stroke="#E8ECF1" strokeWidth={2} dot={false} name="Close" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="data-note">{prices.loading ? "Loading prices…" : "No price history available."}</p>
          )}
        </div>
      </div>

      <div className="company-grid">
        <section className="detail">
          <div className="section-title">
            Your rules <ScoreBadge verdict={verdict} />
          </div>
          <ul className="rule-checklist">
            {verdict.results.map(({ rule, status, value }) => {
              const format = METRICS[rule.metric].format;
              return (
                <li key={rule.id} className={`rule-item rule-${status}`}>
                  <span className="rule-icon">{status === "pass" ? "✓" : status === "fail" ? "✗" : "?"}</span>
                  <span className="rule-label">{rule.label}</span>
                  <span className="mono rule-value">
                    {status === "na" ? "no data" : formatMetric(value, format, currency)} {rule.op}{" "}
                    {formatMetric(rule.threshold, format, currency)}
                  </span>
                </li>
              );
            })}
            {verdict.results.length === 0 && <li className="cell-sub">No rules switched on. Add some in My Rules.</li>}
          </ul>
        </section>

        <section className="detail">
          <div className="section-title">Key numbers</div>
          <dl className="metric-grid">
            {KEY_METRICS.map((key) => (
              <div key={key} className="metric-cell">
                <dt>{METRICS[key].label}</dt>
                <dd className="mono">{formatMetric(metrics[key], METRICS[key].format, currency)}</dd>
              </div>
            ))}
          </dl>
          <p className="cell-sub">
            Ratios use the latest fiscal year{latestFy && ` (ending ${latestFy.periodEnd})`} and the last close.
            Intrinsic value = 3-yr avg EPS × (8.5 + 2g) × 4.4 ÷ {settings.aaaYield}% AAA yield.
          </p>
        </section>
      </div>

      <section className="detail">
        <div className="section-title">Revenue and net income</div>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={years} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#1E2A42" strokeDasharray="3 3" />
              <XAxis dataKey="fiscalYear" tick={AXIS} />
              <YAxis tick={AXIS} width={70} tickFormatter={(v) => formatMoney(v, currency)} />
              <Tooltip {...TOOLTIP} formatter={(v) => formatMoney(v, currency)} cursor={{ fill: "#1E2A42" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#3FA9E5" />
              <Bar dataKey="netIncome" name="Net income" fill="#C9A227" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <div className="section-title">Financial history (annual reports)</div>
        <p className="cell-sub">Click any number to open the SEC filing it was taken from.</p>
        <div className="table-wrap">
          <table className="table financials-table">
            <thead>
              <tr>
                <th>Fiscal year</th>
                {years.map((y) => (
                  <th key={y.periodEnd} title={`Period ending ${y.periodEnd}`}>{y.fiscalYear}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FINANCIAL_ROWS.map(([field, label, kind]) => (
                <tr key={field}>
                  <td className="bold">{label}</td>
                  {years.map((y) => {
                    const text = kind === "eps" ? formatMetric(y[field], "x") : formatMoney(y[field], currency);
                    const url = secFilingUrl(company.cik, y.accn?.[field]);
                    return (
                      <td key={y.periodEnd} className="mono">
                        {url ? (
                          <a className="source-link" href={url} target="_blank" rel="noreferrer" title={`Source: SEC filing ${y.accn[field]}`}>
                            {text}
                          </a>
                        ) : (
                          <span title={field === "totalLiabilities" && y.totalLiabilitiesDerived ? "Derived: total assets minus equity" : undefined}>
                            {text}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="cell-sub sources">
        Sources:{" "}
        {[secSource, priceSource].filter(Boolean).map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
          </span>
        ))}
        . Figures are as reported in annual filings and may differ from data vendors.
      </p>
    </div>
  );
}
