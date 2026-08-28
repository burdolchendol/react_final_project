export default function ProfileView({ watchlist, stocks }) {
  const pinned = stocks.filter((s) => watchlist.has(s.ticker));

  return (
    <div className="page2">
      <h2 className="h2">Profile</h2>
      <p className="page-sub">A placeholder profile page — swap in real user data once you add accounts.</p>
      <div className="point-card">
        <div className="point-title">Starred Watchlist ({pinned.length})</div>
        {pinned.length === 0 ? (
          <div className="point-body">You haven't starred any tickers yet. Go to Home and click the ☆ on a stock.</div>
        ) : (
          <ul className="pinned-list">
            {pinned.map((s) => (
              <li key={s.ticker}>
                <b className="mono">{s.ticker}</b> — {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
