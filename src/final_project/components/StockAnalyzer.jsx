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
import ScreenerView from "./ScreenerView";
import CompanyView from "./CompanyView";
import RulesView from "./RulesView";
import useStoredState from "../hooks/useStoredState";
import { DEFAULT_RULES } from "../utils/rules";
import { DEFAULT_SETTINGS } from "../utils/metrics";

export default function StockAnalyzer() {
  const stocks = useMemo(() => STOCKS_META.map(analyzeStock), []);

  const [selectedTicker, setSelectedTicker] = useState(stocks[0].ticker);
  const [watchlist, setWatchlist] = useState(new Set());
  const [sortMode, setSortMode] = useState("ticker");
  const [activeNav, setActiveNav] = useState("Screener");

  // Real-data screener state. Rules and settings persist across visits.
  const [market, setMarket] = useStoredState("analyzer.market", "us");
  const [openTicker, setOpenTicker] = useState(null);
  const [rules, setRules] = useStoredState("analyzer.rules.v1", DEFAULT_RULES);
  const [settings, setSettings] = useStoredState("analyzer.settings.v1", DEFAULT_SETTINGS);

  const validViews = ["Screener", "My Rules", "Home", "Why Invest", "Graham's Profile", "Graham's Analysis", "Profile", "News Feed", "Contact"];
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
      <NavBar
        activeNav={activeNav}
        setActiveNav={(item) => {
          setOpenTicker(null);
          setActiveNav(item);
        }}
      />

      {activeNav === "Screener" && !openTicker && (
        <ScreenerView
          market={market}
          setMarket={setMarket}
          rules={rules}
          settings={settings}
          onOpenCompany={(ticker) => {
            setOpenTicker(ticker);
            window.scrollTo(0, 0);
          }}
        />
      )}
      {activeNav === "Screener" && openTicker && (
        <CompanyView
          market={market}
          ticker={openTicker}
          rules={rules}
          settings={settings}
          onBack={() => setOpenTicker(null)}
        />
      )}
      {activeNav === "My Rules" && (
        <RulesView rules={rules} setRules={setRules} settings={settings} setSettings={setSettings} />
      )}
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
