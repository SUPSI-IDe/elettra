// Stable Swiss notation, independent of the browser language.
// Normalize Intl's typographic apostrophe to the application's plain apostrophe.
export function formatNumber(value, maximumFractionDigits = 1, minimumFractionDigits = 0) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('de-CH', {
    maximumFractionDigits, minimumFractionDigits,
  }).format(Number(value)).replace(/’/g, "'");
}

export function formatChf(value, fractionDigits = 0) {
  const amount = formatNumber(value, fractionDigits, fractionDigits);
  return amount === '—' ? amount : `CHF ${amount}`;
}

// A billionth of a franc is numerical noise, not a useful editable price.
// Keep the stored number separate so displaying zero does not change a copy.
export function formatCostInput(value) {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Math.abs(numeric) < 1e-9 ? '0' : String(numeric);
}
