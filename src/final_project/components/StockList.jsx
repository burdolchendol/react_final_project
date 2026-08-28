import { useMemo } from "react";
import StockCard from "./StockCard";

const SORT_MODES = ["ticker", "gainers", "losers"];

export default function StockList({
  stocks,
  sortMode,
  setSortMode,
  selectedTicker,
  setSelectedTicker,
  watchlist,
  toggleWatch,
}) {
  const sortedStocks = useMemo(() => {
    const copy = [...stocks];
    if (sortMode === "gainers") copy.sort((a, b) => b.changePct - a.changePct);
    else if (sortMode === "losers") copy.sort((a, b) => a.changePct - b.changePct);
    else copy.sort((a, b) => a.ticker.localeCompare(b.ticker));
    return copy;
  }, [stocks, sortMode]);

  return (
    <div>
      <div className="controls">
        <span className="control-label">Sort</span>
        {SORT_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`sort-btn ${sortMode === mode ? "sort-btn-active" : ""}`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="stock-list">
        {sortedStocks.map((s) => (
          <StockCard
            key={s.ticker}
            stock={s}
            isSelected={s.ticker === selectedTicker}
            isWatched={watchlist.has(s.ticker)}
            onSelect={() => setSelectedTicker(s.ticker)}
            onToggleWatch={() => toggleWatch(s.ticker)}
          />
        ))}
      </div>
    </div>
  );
}
