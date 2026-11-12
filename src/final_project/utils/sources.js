// Links back to where each number came from, so users can check it themselves.

// Filing index page on EDGAR for an accession number like "0000320193-24-000123".
export function secFilingUrl(cik, accn) {
  if (!cik || !accn) return null;
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replace(/-/g, "")}/${accn}-index.htm`;
}
