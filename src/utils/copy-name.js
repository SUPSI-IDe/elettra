export const appendCopyNameSuffix = (name, suffix) => {
  const baseName = String(name ?? "").trim();
  const localizedSuffix = String(suffix ?? "").trim();
  if (!baseName) return localizedSuffix.replace(/^_+/, "");
  if (!localizedSuffix) return baseName;
  return localizedSuffix.startsWith("_")
    ? `${baseName}${localizedSuffix}`
    : `${baseName} ${localizedSuffix}`;
};
