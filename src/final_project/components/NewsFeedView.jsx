import { useMemo } from "react";

// 9 Total templates: 3 standard market templates + 3 general templates + 3 AI-related templates
const TEMPLATES = [
  // Standard market action
  (s) => `${s.name} shares ${s.changePct >= 0 ? "climb" : "slip"} ${Math.abs(s.changePct).toFixed(1)}% in latest session`,
  (s) => `Analysts weigh in on ${s.ticker}'s recent price action`,
  (s) => `What's driving ${s.sector.toLowerCase()} stocks like ${s.ticker} this week`,
  // General business updates
  (s) => `Institutional investors adjust holdings in ${s.name}`,
  (s) => `Supply chain updates impact outlook for ${s.ticker}`,
  (s) => `Quarterly earnings preview: What to expect from ${s.name}`,
  // AI-related templates (3 items)
  (s) => `${s.name} announces new enterprise generative AI integrations`,
  (s) => `How artificial intelligence disruption is reshaping ${s.sector.toLowerCase()} leaders like ${s.ticker}`,
  (s) => `Tech sector buzz: ${s.ticker} scales up custom machine learning infrastructure`,
];

function buildHeadlines(stocks) {
  // Generate mock headlines across all stocks using a random spread of templates
  const generated = stocks.map((s, i) => {
    // Pick a random template from our expanded list
    const templateFn = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    
    // Generate random hours (0 to 8) and minutes (0 to 59)
    const randomHours = Math.floor(Math.random() * 9);
    const randomMins = Math.floor(Math.random() * 60);
    
    // Calculate total minutes ago for accurate sorting
    const totalMinutesAgo = randomHours * 60 + randomMins;

    // Format the time string nicely
    let timeString = "";
    if (randomHours === 0) {
      timeString = `${randomMins === 0 ? 1 : randomMins}m ago`;
    } else {
      timeString = `${randomHours}h ${randomMins > 0 ? `${randomMins}m ` : ""}ago`;
    }

    return {
      ticker: s.ticker,
      headline: templateFn(s),
      time: timeString,
      sortValue: totalMinutesAgo, // Lower number = more recent
    };
  });

  // Sort from most recent to least recent (lowest minutes ago first)
  generated.sort((a, b) => a.sortValue - b.sortValue);

  // Return a slice of top headlines (e.g., top 10 items)
  return generated.slice(0, 10);
}

export default function NewsFeedView({ stocks }) {
  // useMemo ensures the random times/sorting remain stable until component remounts or stocks change
  const headlines = useMemo(() => buildHeadlines(stocks), [stocks]);

  return (
    <div className="page2">
      <h2 className="h2">News Feed</h2>
      <p className="page-sub">
        Mock real-time headlines — sorted by most recent.
      </p>
      <div className="news-list">
        {headlines.map((h, i) => (
          <div key={i} className="news-item">
            <span className="news-tag mono bold">{h.ticker}</span>
            <span className="news-headline">{h.headline}</span>
            <span className="news-time">{h.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}