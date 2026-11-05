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
import { DEFAULT_RULES } from "../utils/rules";
import { DEFAULT_SETTINGS } from "../utils/metrics";

export default function StockAnalyzer() {
  const stocks = useMemo(() => STOCKS_META.map(analyzeStock), []);

  const [watchlist] = useState(new Set());
  const [activeNav, setActiveNav] = useState("Screener");

  // Real-data screener state. Rules and settings persist across visits.
  const [market, setMarket] = useStoredState("analyzer.market", "us");
  const [openTicker, setOpenTicker] = useState(null);
  const [rules, setRules] = useStoredState("analyzer.rules.v1", DEFAULT_RULES);
  const [settings, setSettings] = useStoredState("analyzer.settings.v1", DEFAULT_SETTINGS);

  const validViews = ["Screener", "My Rules", "Why Invest", "Graham's Analysis"];
  const isCurrentViewValid = validViews.includes(activeNav);

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
      {activeNav === "Why Invest" && <WhyInvestView />}
      {activeNav === "Graham's Analysis" && <GrahamAnalysisView stocks={stocks} />}
      
      {!isCurrentViewValid && <NotFoundView setActiveNav={setActiveNav} />}

      <Footer />
      <ScrollToTheTop />
    </div>
  );
}
