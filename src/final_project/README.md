<h1> 📈 Benjamin Graham Stock Analyzer </h1>

<h3> 📝 <u> Project Description </u></h3>

The Benjamin Graham Stock Analyzer is a React-based web applicaiton designed to help investors evaluate stocks using Benjamin Graham's timeless principles. This app calculates the intrinsic value, tracks watchlists, updates market news and provide graphical analysis of the stock that the user is interested in. It helps the users make sound, defensive investment decisions.

<h3> 🚀 <u> Technologies Used </u></h3>

Frontend: React (Hooks: useState, useMemo, useState)
 
Styling: CSS / Modern Flexbox & Grid

State Management: React component state & native set objects for watchlists

Tooling: Vite

<h3> 🛠️ <u> Setup and Installation </u> </h3>

Instructions:
1. Clone the repository:
```bash
git clone https://github.com/your-username/your-repo-name.git
```
2. Navigate to the project directory: 
```bash 
cd your-repo-name
```
3. Install dependencies:
```bash
npm install
```
4. Run the development server: 
```bash
npm run dev
```
5. Open your browser:
Navigate to http://localhost:5173 (or the port you specified in your terminal)


<h3> 📊 <u> Fundamentals Screener (real data) </u></h3>

The **Screener** page scores real US companies against your own rules, using free data only:

| What | Source | Key needed? |
| --- | --- | --- |
| Annual financials (revenue, EPS, balance sheet, cash flow, dividends) | [SEC EDGAR XBRL API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | No |
| Daily closing prices (5 years) | Yahoo Finance chart endpoint, with Stooq as a fallback | No |

GitHub Pages can't call these APIs from the browser (no CORS, and SEC needs a User-Agent header), so the app reads a
**static snapshot** in `public/data/<market>/`. The *Refresh market data* GitHub Action rebuilds it every Monday
(or on demand from the Actions tab), commits it, and redeploys the site.

```bash
cp .env.example .env                                        # then put your name and email in it (SEC requires this)
npm run fetch:us                                            # refresh every ticker in scripts/markets/us.tickers.json
node scripts/fetch-data.mjs --market us --tickers AAPL,KO   # quick test with a few tickers (overwrites the index)
npm test                                                    # unit tests for parsers, metrics and rules
```

- **Pick tickers:** edit `scripts/markets/us.tickers.json`. US filers of 10-K reports only (no ADRs, and dual-class
  quirks like BRK-B make per-share ratios misleading).
- **SEC contact (required):** SEC refuses requests (HTTP 403) that don't name who is asking. Locally, set
  `SEC_USER_AGENT="Your Name you@example.com"` in `.env` (git-ignored). For the GitHub Action, add the same value as a
  repository variable: Settings → Secrets and variables → Actions → Variables → `SEC_USER_AGENT`.
- **Your rules:** the *My Rules* page starts with Graham's seven defensive-investor tests. Change thresholds, switch rules on or
  off, or add rules on any metric. They are saved in your browser.

**Data layer.** Each market is registered in `scripts/markets/index.mjs` with a fundamentals provider and a list of price
sources. Every provider returns the same shape (`fiscalYears: [{ fiscalYear, periodEnd, revenue, netIncome, epsDiluted, … }]`),
so the app does not care where the numbers came from. Adding Singapore means writing an SGX fundamentals provider
(prices already work through Yahoo with `.SI` tickers) and enabling the market in `src/final_project/data/markets.js`.

<h3> 🌐 <u> Live Demo </u></h3>

🚀 Check out the live deployment of the application here 🚀:
<p align="center">
  <a href="http://localhost:5173/" target="_blank">
    <p>👉  Click Here to View Live Demo </p>
  </a>
</p>

<h3> 📸 <u> Screenshots </u></h3>

| <div align="center"> <img src="./pictures/Homepage.png" width="800"><br><h3><strong>Home Page</strong></h3></div> | <div align="center"> <img src="./pictures/WhyInvestPage.png" width="800"><br><h3><strong>Why do we invest?</strong></h3></div> |
| :---: | :---: |
| <div align="center"> <img src="./pictures/GrahamAnalysis.png" width="800"><br><h3><strong>Graham's Analysis</strong></h3></div> | <div align="center"> <img src="./pictures/ScrollButtonTop.png" width="800"><br><h3><strong>Showcasing the scroll to top button</strong></h3></div> |
| <div align="center"> <img src="./pictures/GrahamProfile.png" width="800"><br><h3><strong>Graham's Profile</strong></h3></div> | <div align="center"> <img src="./pictures/UserProfile.png" width="800"><br><h3><strong>User's profile</strong></h3></div> |
| <div align="center"> <img src="./pictures/NewsFeed.png" width="800"><br><h3><strong>News Feed</strong></h3></div> | <div align="center"> <img src="./pictures/ContactUs.png" width="800"><br><h3><strong>Contact Us</strong></h3></div> |
| <div align="center"> <img src="./pictures/error404.png" width="800"><br><h3><strong>Error page</strong></h3></div> 
