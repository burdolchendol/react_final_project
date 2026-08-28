import { fmt } from "../utils/analysis";

export default function StockCard({ stock, isSelected, isWatched, onSelect, onToggleWatch }) {
  return (
    <div
      onClick={onSelect}
      className={`stock-card ${isSelected ? "stock-card-active" : ""}`}
    >
      <div className="stock-card-top">
        <div>
          <div className="stock-ticker mono">{stock.ticker}</div>
          <div className="stock-name">{stock.name}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatch();
          }}
          className="star-btn"
          aria-label="Toggle watchlist"
        >
          {isWatched ? "★" : "☆"}
        </button>
      </div>
      <div className="stock-card-bottom mono">
        <span>${fmt(stock.latestClose)}</span>
        <span className={stock.changePct >= 0 ? "up bold" : "down bold"}>
          {stock.changePct >= 0 ? "+" : ""}
          {stock.changePct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
