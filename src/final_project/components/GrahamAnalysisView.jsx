import { fmt } from "../utils/analysis";

// A playful, simplified nod to Benjamin Graham-style value screening —
// calculating a mock intrinsic value and resulting margin of safety.
function buildRows(stocks) {
  return stocks.map((s) => {
    const volatility = Math.abs(s.changePct);
    const lastPoint = s.chartData[s.chartData.length - 1];
    const aboveSMA50 = lastPoint.sma50 !== null && s.latestClose > lastPoint.sma50;
    
    // Mock Intrinsic Value estimation (e.g., roughly 15% to 40% higher than latest close for demo purposes)
    const intrinsicValue = s.latestClose * (1.15 + (Math.abs(s.ticker.charCodeAt(0) % 30) / 100));
    
    // Margin of Safety formula: (Intrinsic Value - Price) / Intrinsic Value
    const marginOfSafety = ((intrinsicValue - s.latestClose) / intrinsicValue) * 100;

    const verdict =
      volatility < 1.5 && aboveSMA50 && marginOfSafety > 20 ? "Value Buy" : 
      volatility > 3 ? "Volatile" : "Mixed signal";

    return { ...s, volatility, aboveSMA50, intrinsicValue, marginOfSafety, verdict };
  });
}

export default function GrahamAnalysisView({ stocks }) {
  const rows = buildRows(stocks);

  return (
    <div className="page2">
      <h2 className="h2">Graham's Analysis</h2>
      <p className="page-sub">
        A simplified, mock screen inspired by value-investing principles: tracking price relative to the
        50-day average, estimated intrinsic value, and the resulting margin of safety. Not financial advice.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Price</th>
              <th>Today's Move</th>
              <th>Above SMA 50</th>
              <th>Intrinsic Value</th>
              <th>Margin of Safety</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker}>
                <td className="mono bold">{r.ticker}</td>
                <td>${fmt(r.latestClose)}</td>
                <td className={r.changePct >= 0 ? "up" : "down"}>
                  {r.changePct >= 0 ? "+" : ""}
                  {r.changePct.toFixed(2)}%
                </td>
                <td>{r.aboveSMA50 ? "Yes" : "No"}</td>
                <td className="mono">${fmt(r.intrinsicValue)}</td>
                <td className="mono up bold">
                  {r.marginOfSafety.toFixed(1)}%
                </td>
                <td>{r.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}