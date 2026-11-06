import { useState } from "react";
import { formatMoney } from "../utils/format";

// Scrolling strip of last closes from the data snapshot, in the currency chosen
// on the Screener. Change is against the previous week's close.
// Toggles between the biggest companies and the ones starred on the Screener.
export default function TickerTape({ all, favorites, currency = "USD", rate = 1 }) {
  const [mode, setMode] = useState("all"); // "all" | "favorites"

  const visible = mode === "favorites" ? favorites : all;

  return (
    <div className="tape-wrap">
      <div className="tape-toggle">
        <button
          onClick={() => setMode("all")}
          className={`tape-toggle-btn ${mode === "all" ? "tape-toggle-btn-active" : ""}`}
        >
          All
        </button>
        <button
          onClick={() => setMode("favorites")}
          className={`tape-toggle-btn ${mode === "favorites" ? "tape-toggle-btn-active" : ""}`}
        >
          ★ Favorites
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="tape-empty">
          {mode === "favorites"
            ? "No favorites yet — star a company on the Screener to add it here."
            : "No prices yet — run npm run fetch:us to load them."}
        </div>
      ) : (
        <div className="tape">
          {[...visible, ...visible].map((s, i) => (
            <span
              className="tape-item"
              key={i}
              title={`Close ${s.asOf}${s.changePct != null ? " · change vs the week before" : ""}`}
            >
              <b className="tape-ticker">{s.ticker}</b>{" "}
              <span className="mono">{formatMoney(s.last * rate, currency)}</span>{" "}
              {s.changePct != null && (
                <span className={s.changePct >= 0 ? "up" : "down"}>
                  {s.changePct >= 0 ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
