export default function NotFoundView({ setActiveNav }) {
  return (
    <div className="page2 not-found-container">
      <h2 className="h2 not-found-code">404</h2>
      <p className="page-sub not-found-text">
        Oops! The page or route you are looking for does not exist.
      </p>
      <button 
        className="sort-btn sort-btn-active" 
        onClick={() => setActiveNav("Home")}
      >
        Return to Home
      </button>
    </div>
  );
}