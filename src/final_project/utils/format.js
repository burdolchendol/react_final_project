// Formatting helpers for real financial data (values may be null).

const DASH = "—";

export function formatMoney(n, currency = "USD") {
  if (n == null || !Number.isFinite(n)) return DASH;
  const abs = Math.abs(n);
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${currencySymbol(currency)}${(n / size).toFixed(2)}${suffix}`;
  }
  return `${currencySymbol(currency)}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currencySymbol(currency) {
  return { USD: "$", SGD: "S$" }[currency] ?? `${currency} `;
}

export function formatMetric(value, format, currency) {
  if (value === Infinity) return "∞";
  if (value == null || !Number.isFinite(value)) return DASH;
  switch (format) {
    case "money":
      return formatMoney(value, currency);
    case "pct":
      return `${(value * 100).toFixed(1)}%`;
    case "years":
      return `${value} yr${value === 1 ? "" : "s"}`;
    case "x":
      return value.toFixed(2);
    default:
      return String(value);
  }
}
