import { useState, useMemo } from "react";
import { STOCKS_META } from "../data/mockStocks";
import { analyzeStock } from "../utils/analysis";
import TickerTape from "./TickerTape";
import NavBar from "./NavBar";
import WhyInvestView from "./WhyInvestView";
import GrahamAnalysisView from "./GrahamAnalysisView";
import Footer from "./Footer";
import NotFoundView from "./NotFoundView";
import ScrollToTheTop from "./ScrollToTheTop";
import ScreenerView from "./ScreenerView";
import CompanyView from "./CompanyView";
import RulesView from "./RulesView";
import useStoredState from "../hooks/useStoredState";
import useAsync from "../hooks/useAsync";
import { loadMarketIndex } from "../data/markets";
import { DEFAULT_RULES } from "../utils/rules";
import { DEFAULT_SETTINGS } from "../utils/metrics";

export default function StockAnalyzer() {
  const stocks = useMemo(() => STOCKS_META.map(analyzeStock), []);

  // Companies starred on the Screener, saved in this browser.
  const [starred, setStarred] = useStoredState("analyzer.starred.v1", []);
  const watchlist = useMemo(() => new Set(starred), [starred]);
  const [hiddenColumns, setHiddenColumns] = useStoredState("analyzer.hiddenColumns.v1", []);
  const toggleStar = (ticker) =>
    setStarred((prev) => (prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]));
  const [activeNav, setActiveNav] = useState("Screener");

  // Real-data screener state. Rules and settings persist across visits.
  const [market, setMarket] = useStoredState("analyzer.market", "us");
  const marketIndex = useAsync(() => loadMarketIndex(market), market);
  // Starred companies with their real last close, for the ticker tape.
  const favorites = useMemo(
    () =>
      (marketIndex.data?.companies ?? [])
        .filter((c) => watchlist.has(c.ticker) && c.price)
        .map((c) => ({ ticker: c.ticker, latestClose: c.price.last, changePct: null })),
    [marketIndex.data, watchlist]
  );
  const [openTicker, setOpenTicker] = useState(null);
  const [rules, setRules] = useStoredState("analyzer.rules.v1", DEFAULT_RULES);
  const [settings, setSettings] = useStoredState("analyzer.settings.v1", DEFAULT_SETTINGS);

  const validViews = ["Screener", "My Rules", "Why Invest", "Graham's Analysis"];
  const isCurrentViewValid = validViews.includes(activeNav);

  return (
    <div className="page">
      <TickerTape stocks={stocks} favorites={favorites} />
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
          watchlist={watchlist}
          toggleStar={toggleStar}
          hiddenColumns={hiddenColumns}
          setHiddenColumns={setHiddenColumns}
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
      {activeNav === "Why Invest" && <WhyInvestView />}
      {activeNav === "Graham's Analysis" && <GrahamAnalysisView stocks={stocks} />}
      
      {!isCurrentViewValid && <NotFoundView setActiveNav={setActiveNav} />}

      <Footer />
      <ScrollToTheTop />
    </div>
  );
}
