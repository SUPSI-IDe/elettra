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
    let base = String(value ?? '').trim(), number = 0n, match;
    while ((match = tail.exec(base))) {
      number += BigInt(match[1] || match[2] || match[3] || '1');
      base = base.slice(0, match.index).trimEnd();
    }
    return { base, number };
  };
  const source = parse(original);
  const family = source.base.normalize('NFC').toLowerCase();
  let last = source.number;
  for (const value of existingNames) {
    const item = parse(value);
    if (item.base.normalize('NFC').toLowerCase() === family && item.number > last) last = item.number;
  }
  return `${source.base ? `${source.base}_` : ''}${label}_${last + 1n}`;
};
