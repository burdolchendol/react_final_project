// Loading / error / "no snapshot yet" messages, plus when the data was refreshed.
export default function DataStatus({ loading, error, index }) {
  if (loading) return <p className="data-note">Loading market data…</p>;
  if (error) return <p className="data-note data-note-error">{error.message}</p>;
  if (!index) return null;

  if (!index.generatedAt || index.companies.length === 0) {
    return (
      <div className="data-note">
        No data snapshot yet. Run the <b>Refresh market data</b> workflow in GitHub Actions (or{" "}
        <code>npm run fetch:us</code> locally, <code>npm run fetch:us:quick</code> for a short list) to download
        company financials.
      </div>
    );
  }

  const when = new Date(index.generatedAt).toLocaleString();
  return (
    <p className="data-note">
      {index.companies.length.toLocaleString()} companies · data refreshed {when}
      {index.failures?.length > 0 && ` · ${index.failures.length} could not be loaded (${index.failures.map((f) => f.ticker).join(", ")})`}
    </p>
  );
}
