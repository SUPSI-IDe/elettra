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
