const NAV_ITEMS = ["Home", "Why Invest", "Graham's Analysis", "Graham's Profile","Profile", "News Feed", "Contact"];

export default function NavBar({ activeNav, setActiveNav }) {
  return (
    <nav className="nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item}
          onClick={() => setActiveNav(item)}
          className={`nav-item ${activeNav === item ? "nav-item-active" : ""}`}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
