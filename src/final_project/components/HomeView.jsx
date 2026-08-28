import StockList from "./StockList";
import StockChart from "./StockChart";

export default function HomeView({
  stocks,
  selectedTicker,
  setSelectedTicker,
  watchlist,
  toggleWatch,
  sortMode,
  setSortMode,
}) {
  const selected = stocks.find((s) => s.ticker === selectedTicker);

  return (
    <>
      <header className="header">
        <h1 className="h1">Ledger — Mock Watchlist</h1>
        <p className="sub">10 tickers · 90 days of simulated daily closes · SMA(20) / SMA(50)</p>
      </header>

      <div className="layout">
        <StockList
          stocks={stocks}
          sortMode={sortMode}
          setSortMode={setSortMode}
          selectedTicker={selectedTicker}
          setSelectedTicker={setSelectedTicker}
          watchlist={watchlist}
          toggleWatch={toggleWatch}
        />
        <StockChart stock={selected} />
      </div>
    </>
  );
}
