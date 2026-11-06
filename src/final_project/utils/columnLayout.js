// Column order and widths for the Screener table, as the user arranged them.

export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 480;
export const STAR_WIDTH = 48;
export const FALLBACK_WIDTH = 130;

export const clampWidth = (w) => Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, w)));

// The columns in the user's saved order. Columns the saved order doesn't know
// (a new rule, a new column) go next to the column they follow by default.
export function orderColumns(defaults, saved) {
  const known = new Set(defaults);
  const out = (saved ?? []).filter((k, i, arr) => known.has(k) && arr.indexOf(k) === i);
  defaults.forEach((key, i) => {
    if (out.includes(key)) return;
    const prev = defaults.slice(0, i).reverse().find((k) => out.includes(k));
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, key);
  });
  return out;
}

// Moves key to just before beforeKey, or to the end when beforeKey is null.
export function moveColumn(order, key, beforeKey) {
  if (key === beforeKey) return order;
  const out = order.filter((k) => k !== key);
  const at = beforeKey == null ? -1 : out.indexOf(beforeKey);
  out.splice(at < 0 ? out.length : at, 0, key);
  return out;
}
