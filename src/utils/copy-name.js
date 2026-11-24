const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Propose the next copy name in the original family, across all list pages. */
export const appendCopyNameSuffix = (name, suffix, existingNames = []) => {
  const original = String(name ?? '').trim();
  const label = String(suffix ?? '').trim().replace(/^_+/, '').replace(/^\((.*)\)$/, '$1').trim();
  if (!label) return original;
  const labels = [...new Set(['copy', 'copia', 'copie', 'Kopie', label])].map(escapeRegExp).join('|');
  // Only complete trailing copy tokens are stripped. Preserve names such as
  // "Copy shop", "Route_12" and "Report_copy_notes".
  const tail = new RegExp(`(?:_(?:${labels})(?:_(\\d+))?|\\s+\\((?:${labels})(?:_(\\d+))?\\)|^(?:${labels})_(\\d+))$`, 'i');
  const parse = value => {
    let base = String(value ?? '').trim();
    let tokens = 0;
    let legacyOrdinal = 0n;
    let ordinal = null;
    let match;
    while ((match = tail.exec(base))) {
      const number = match[1] ?? match[2] ?? match[3];
      ordinal = number === undefined ? 0n : BigInt(number);
      legacyOrdinal += number === undefined ? 1n : ordinal;
      tokens++;
      base = base.slice(0, match.index).trimEnd();
    }
    // Stacked suffixes from older versions retain their inferred ordinal.
    return { base, ordinal: tokens > 1 ? legacyOrdinal : ordinal };
  };
  const source = parse(original);
  const normalizeBase = base => base.normalize('NFC').toLowerCase();
  const family = normalizeBase(source.base);
  const occupied = new Set();
  if (source.ordinal !== null) occupied.add(source.ordinal);
  for (const value of existingNames) {
    const item = parse(value);
    if (item.ordinal !== null && normalizeBase(item.base) === family) {
      occupied.add(item.ordinal);
    }
  }
  let ordinal = 0n;
  while (occupied.has(ordinal)) ordinal++;
  return `${source.base}_${label}${ordinal === 0n ? '' : `_${ordinal}`}`;
};
