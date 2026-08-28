import { useState, useMemo } from "react";
import { STOCKS_META } from "../data/mockStocks";
import { analyzeStock } from "../utils/analysis";
import TickerTape from "./TickerTape";
import NavBar from "./NavBar";
import HomeView from "./HomeView";
import WhyInvestView from "./WhyInvestView";
import GrahamAnalysisView from "./GrahamAnalysisView";
import ProfileView from "./ProfileView";
import NewsFeedView from "./NewsFeedView";
import GrahamsProfile from "./GrahamsProfile";
import Footer from "./Footer";
import NotFoundView from "./NotFoundView";
import ScrollToTheTop from "./ScrollToTheTop";
import ContactView from "./ContactView";

export default function StockAnalyzer() {
  const stocks = useMemo(() => STOCKS_META.map(analyzeStock), []);

  const [selectedTicker, setSelectedTicker] = useState(stocks[0].ticker);
  const [watchlist, setWatchlist] = useState(new Set());
  const [sortMode, setSortMode] = useState("ticker");
  const [activeNav, setActiveNav] = useState("Homefaidsfj");

  const validViews = ["Home", "Why Invest", "Graham's Profile", "Graham's Analysis", "Profile", "News Feed", "Contact"];
  const isCurrentViewValid = validViews.includes(activeNav);

  const toggleWatch = (ticker) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(ticker) ? next.delete(ticker) : next.add(ticker);
      return next;
    });
  };

  return (
    <div className="page">
      <TickerTape stocks={stocks} watchlist={watchlist} />
      <NavBar activeNav={activeNav} setActiveNav={setActiveNav} />

      {activeNav === "Home" && (
        <HomeView
          stocks={stocks}
          selectedTicker={selectedTicker}
          setSelectedTicker={setSelectedTicker}
          watchlist={watchlist}
          toggleWatch={toggleWatch}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      )}
      {activeNav === "Why Invest" && <WhyInvestView />}
      {activeNav === "Graham's Profile" && <GrahamsProfile stocks={stocks} />}
      {activeNav === "Graham's Analysis" && <GrahamAnalysisView stocks={stocks} />}
      {activeNav === "Profile" && <ProfileView watchlist={watchlist} stocks={stocks} />}
      {activeNav === "News Feed" && <NewsFeedView stocks={stocks} />}
      {activeNav === "Contact" && <ContactView />}
      
      {!isCurrentViewValid && <NotFoundView setActiveNav={setActiveNav} />}

      <Footer />
      <ScrollToTheTop />
    </div>
  );
}
