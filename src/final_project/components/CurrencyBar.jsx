import { useState } from "react";
import { DISPLAY_CURRENCIES, currencyLabel } from "../data/currencies";

// "Show money in" dropdown plus the rate in use, which you can override.
// Rates are units of the chosen currency per 1 US dollar.
export default function CurrencyBar({ currency, setCurrency, marketRates, customRates, setCustomRates, asOf }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const custom = customRates[currency];
  const market = marketRates[currency];
  const rate = custom ?? market;

  const startEdit = () => {
    setDraft(rate ? String(rate) : "");
    setEditing(true);
  };
  const apply = () => {
    const v = Number(draft);
    if (v > 0) setCustomRates((prev) => ({ ...prev, [currency]: v }));
    setEditing(false);
  };
  const useMarket = () =>
    setCustomRates((prev) => {
      const next = { ...prev };
      delete next[currency];
      return next;
    });

  return (
    <div className="currency-bar">
      <label className="control-label" htmlFor="display-currency">Show money in</label>
      <select
        id="display-currency"
        className="form-input"
        value={currency}
        onChange={(e) => {
          setCurrency(e.target.value);
          setEditing(false);
        }}
      >
        {DISPLAY_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label ?? c.code} · {c.name}
          </option>
        ))}
      </select>

      {currency === "USD" ? (
        <span className="rate-chip">Prices as listed in US dollars</span>
      ) : editing ? (
        <span className="rate-chip">
          <label htmlFor="custom-rate">1 USD =</label>
          <input
            id="custom-rate"
            className="form-input rate-input"
            type="number"
            step="any"
            min="0"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          {currencyLabel(currency)}
          <button className="sort-btn sort-btn-active" onClick={apply}>Apply</button>
          <button className="sort-btn" onClick={() => setEditing(false)}>Cancel</button>
        </span>
      ) : rate ? (
        <span className="rate-chip">
          <span className="mono">
            1 USD = {rate.toLocaleString("en-US", { maximumFractionDigits: 4 })} {currencyLabel(currency)}
          </span>
          <span className={`rate-pill ${custom ? "rate-pill-custom" : ""}`} title={custom ? "" : asOf ? `Market close ${asOf}` : ""}>
            {custom ? "your rate" : "market"}
          </span>
          <button className="sort-btn" onClick={startEdit}>Edit</button>
          {custom && market && (
            <button className="sort-btn" onClick={useMarket}>Use market rate</button>
          )}
        </span>
      ) : (
        <span className="rate-chip">
          No market rate for {currencyLabel(currency)} yet.
          <button className="sort-btn sort-btn-active" onClick={startEdit}>Enter a rate</button>
        </span>
      )}
    </div>
  );
}
