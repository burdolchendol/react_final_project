import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { fmt } from "../utils/analysis";

export default function StockChart({ stock }) {
  return (
    <div className="detail">
      <div className="detail-header">
        <div>
          <div className="detail-ticker mono">{stock.ticker}</div>
          <div className="detail-name">{stock.name} · {stock.sector}</div>
        </div>
        <div className="detail-price mono">
          ${fmt(stock.latestClose)}
          <span className={stock.changePct >= 0 ? "up detail-change" : "down detail-change"}>
            {stock.changePct >= 0 ? "+" : ""}
            {stock.changePct.toFixed(2)}% today
          </span>
        </div>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer>
          <LineChart data={stock.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1E2A42" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#7C8AA0", fontSize: 11 }}
              tickFormatter={(d) => d.slice(5)}
              minTickGap={30}
            />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#7C8AA0", fontSize: 11 }} width={55} />
            <Tooltip
              contentStyle={{ background: "#121B2E", border: "1px solid #1E2A42", borderRadius: 6 }}
              labelStyle={{ color: "#E8ECF1" }}
              itemStyle={{ fontSize: 12 }}
            />
            <Line type="monotone" dataKey="close" stroke="#E8ECF1" strokeWidth={2} dot={false} name="Close" />
            <Line type="monotone" dataKey="sma20" stroke="#C9A227" strokeWidth={1.5} dot={false} name="SMA 20" />
            <Line type="monotone" dataKey="sma50" stroke="#3FA9E5" strokeWidth={1.5} dot={false} name="SMA 50" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="legend">
        <span><i className="dot" style={{ background: "#E8ECF1" }} /> Close</span>
        <span><i className="dot" style={{ background: "#C9A227" }} /> SMA 20</span>
        <span><i className="dot" style={{ background: "#3FA9E5" }} /> SMA 50</span>
      </div>
    </div>
  );
}
