import { MARKETS } from "../data/markets";

export default function MarketPicker({ market, setMarket }) {
  return (
    <div className="controls market-picker">
      <span className="control-label">Market</span>
      {MARKETS.map((m) => (
        <button
          key={m.id}
          disabled={!m.available}
          onClick={() => setMarket(m.id)}
          className={`sort-btn ${market === m.id ? "sort-btn-active" : ""}`}
          title={m.available ? m.label : `${m.label}: coming soon`}
        >
          {m.label}
          {!m.available && " (soon)"}
        </button>
      ))}
    </div>
  );
}
