// Currencies the Screener can display money in. Shared by the data script
// (which saves their latest market rates) and the app.
export const DISPLAY_CURRENCIES = [
  { code: "USD", name: "US dollar", symbol: "$" },
  { code: "SGD", name: "Singapore dollar", symbol: "S$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British pound", symbol: "£" },
  { code: "JPY", name: "Japanese yen", symbol: "¥" },
  // Shown as RMB; CNY is the ISO code the exchange-rate file uses.
  { code: "CNY", label: "RMB", name: "Chinese renminbi", symbol: "RMB " },
  { code: "HKD", name: "Hong Kong dollar", symbol: "HK$" },
  { code: "TWD", name: "Taiwan dollar", symbol: "NT$" },
  { code: "KRW", name: "South Korean won", symbol: "₩" },
  { code: "INR", name: "Indian rupee", symbol: "₹" },
  { code: "AUD", name: "Australian dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss franc", symbol: "CHF " },
  { code: "SEK", name: "Swedish krona", symbol: "SEK " },
  { code: "NOK", name: "Norwegian krone", symbol: "NOK " },
  { code: "DKK", name: "Danish krone", symbol: "DKK " },
  { code: "NZD", name: "New Zealand dollar", symbol: "NZ$" },
  { code: "MXN", name: "Mexican peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian real", symbol: "R$" },
  { code: "ZAR", name: "South African rand", symbol: "R " },
  { code: "MYR", name: "Malaysian ringgit", symbol: "RM " },
];

// The currency money is shown in and its rate per US dollar. Your own rate wins
// over the market rate; with neither, money stays in US dollars.
export function displayRate(code, customRates = {}, marketRates = {}) {
  const rate = code === "USD" ? 1 : customRates[code] ?? marketRates[code];
  return rate ? { currency: code, rate } : { currency: "USD", rate: 1 };
}

export const currencySymbol = (code) =>
  DISPLAY_CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;

// The name shown to users (e.g. RMB for CNY).
export const currencyLabel = (code) => DISPLAY_CURRENCIES.find((c) => c.code === code)?.label ?? code;
