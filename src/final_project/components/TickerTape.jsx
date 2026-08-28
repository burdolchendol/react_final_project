import { useState, useMemo } from "react";
import { fmt } from "../utils/analysis";

// Signature scrolling strip of live-looking prices at the top of the app.
// Can toggle between showing all stocks or just the starred watchlist.
export default function TickerTape({ stocks, watchlist }) {
  const [mode, setMode] = useState("all"); // "all" | "favorites"

  const favorites = useMemo(
    () => stocks.filter((s) => watchlist.has(s.ticker)),
    [stocks, watchlist]
  );

  const visible = mode === "favorites" ? favorites : stocks;

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

      {mode === "favorites" && favorites.length === 0 ? (
        <div className="tape-empty">No favorites yet — star a stock on Home to add it here.</div>
      ) : (
        <div className="tape">
          {[...visible, ...visible].map((s, i) => (
            <span className="tape-item" key={i}>
              <b className="tape-ticker">{s.ticker}</b>{" "}
              <span className="mono">${fmt(s.latestClose)}</span>{" "}
              <span className={s.changePct >= 0 ? "up" : "down"}>
                {s.changePct >= 0 ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
