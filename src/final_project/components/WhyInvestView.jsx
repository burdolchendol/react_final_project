const POINTS = [
  { title: "Compounding", body: "Returns earn returns. A small, steady gain reinvested over years grows far faster than the same money sitting in cash." },
  { title: "Ownership", body: "A share is a claim on a real business — its earnings, assets, and future decisions, not just a ticker that moves." },
  { title: "Inflation", body: "Cash loses purchasing power every year. Investing is one way to try to grow money faster than prices rise." },
  { title: "Time in the market", body: "Missing just the market's best few days historically hurts long-term returns more than picking the 'perfect' entry point." },
];

export default function WhyInvestView() {
  return (
    <div className="page2">
      <h2 className="h2">Why Invest</h2>
      <p className="page-sub">A few foundational ideas worth understanding before you put money to work.</p>
      <div className="points-grid">
        {POINTS.map((p) => (
          <div key={p.title} className="point-card">
            <div className="point-title">{p.title}</div>
            <div className="point-body">{p.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
