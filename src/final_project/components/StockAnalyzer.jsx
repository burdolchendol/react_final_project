import { useState, useMemo } from "react";
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
import { DEFAULT_SETTINGS, computeMetrics } from "../utils/metrics";
import { displayRate } from "../data/currencies";

const TAPE_SIZE = 30;

export default function StockAnalyzer() {

  // Companies starred on the Screener, saved in this browser.
  const [starred, setStarred] = useStoredState("analyzer.starred.v1", []);
  const watchlist = useMemo(() => new Set(starred), [starred]);
  const [hiddenColumns, setHiddenColumns] = useStoredState("analyzer.hiddenColumns.v1", []);
  const [displayCurrency, setDisplayCurrency] = useStoredState("analyzer.displayCurrency.v1", "USD");
  const [customRates, setCustomRates] = useStoredState("analyzer.customRates.v1", {});
  const [columnOrder, setColumnOrder] = useStoredState("analyzer.columnOrder.v1", []);
  const [columnWidths, setColumnWidths] = useStoredState("analyzer.columnWidths.v1", {});
  const toggleStar = (ticker) =>
    setStarred((prev) => (prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]));
  const [activeNav, setActiveNav] = useState("Screener");

  // Real-data screener state. Rules and settings persist across visits.
  const [market, setMarket] = useStoredState("analyzer.market", "us");
  const marketIndex = useAsync(() => loadMarketIndex(market), market);
  // Ticker tape: real closes from the snapshot. "All" is the biggest companies
  // by market value; "Favorites" is what you starred on the Screener.
  const tape = useMemo(() => {
    const priced = (marketIndex.data?.companies ?? [])
      .filter((c) => c.price?.last != null)
      .map((c) => ({
        ticker: c.ticker,
        last: c.price.last,
        asOf: c.price.asOf,
        changePct: c.price.prev ? (c.price.last / c.price.prev - 1) * 100 : null,
        size: computeMetrics(c, DEFAULT_SETTINGS).marketCap ?? -1,
      }));
    return {
      all: [...priced].sort((a, b) => b.size - a.size).slice(0, TAPE_SIZE),
      favorites: priced.filter((c) => watchlist.has(c.ticker)),
    };
  }, [marketIndex.data, watchlist]);
  const tapeMoney = displayRate(displayCurrency, customRates, marketIndex.data?.fx?.rates);
  const [openTicker, setOpenTicker] = useState(null);
  const [rules, setRules] = useStoredState("analyzer.rules.v1", DEFAULT_RULES);
  const [settings, setSettings] = useStoredState("analyzer.settings.v1", DEFAULT_SETTINGS);

  const validViews = ["Screener", "My Rules", "Why Invest", "Graham's Analysis"];
  const isCurrentViewValid = validViews.includes(activeNav);

  return (
    <div className="page">
      <TickerTape all={tape.all} favorites={tape.favorites} currency={tapeMoney.currency} rate={tapeMoney.rate} />
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
          clearStars={() => setStarred([])}
          hiddenColumns={hiddenColumns}
          setHiddenColumns={setHiddenColumns}
          displayCurrency={displayCurrency}
          setDisplayCurrency={setDisplayCurrency}
          customRates={customRates}
          setCustomRates={setCustomRates}
          columnOrder={columnOrder}
          setColumnOrder={setColumnOrder}
          columnWidths={columnWidths}
          setColumnWidths={setColumnWidths}
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
      {activeNav === "Graham's Analysis" && (
        <GrahamAnalysisView
          companies={marketIndex.data?.companies ?? []}
          loading={marketIndex.loading}
          rules={rules}
          settings={settings}
          watchlist={watchlist}
          currency={tapeMoney.currency}
          rate={tapeMoney.rate}
          onOpenCompany={(ticker) => {
            setActiveNav("Screener");
            setOpenTicker(ticker);
            window.scrollTo(0, 0);
          }}
        />
      )}
      
      {!isCurrentViewValid && <NotFoundView setActiveNav={setActiveNav} />}

      <Footer />
      <ScrollToTheTop />
    </div>
  );
}
