export const FEASIBILITY_GENERAL_SCOPE_KEY = "general";

const text = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const feasibilityShiftScopeKey = (shiftId) => {
  const id = text(shiftId);
  return id ? `shift:${id}` : "";
};

export const buildFeasibilityResultScopes = (
  shifts = [],
  { generalLabel = "General" } = {}
) => {
  const source = Array.isArray(shifts) ? shifts : [];
  const normalized = [];
  const seenIds = new Set();

  for (const candidate of source) {
    const shiftId = text(candidate?.id ?? candidate?.shiftId ?? candidate?.shift_id);
    if (!shiftId || seenIds.has(shiftId)) continue;
    seenIds.add(shiftId);
    normalized.push({
      shiftId,
      shiftName: text(
        candidate?.shiftName ?? candidate?.shift_name ?? candidate?.name
      ) || shiftId,
    });
  }

  const nameCounts = new Map();
  for (const shift of normalized) {
    nameCounts.set(shift.shiftName, (nameCounts.get(shift.shiftName) ?? 0) + 1);
  }
  const nameOrdinals = new Map();

  return [
    {
      key: FEASIBILITY_GENERAL_SCOPE_KEY,
      kind: "general",
      label: text(generalLabel) || "General",
      shiftId: null,
      shiftName: null,
    },
    ...normalized.map((shift) => {
      const duplicateCount = nameCounts.get(shift.shiftName) ?? 0;
      const ordinal = (nameOrdinals.get(shift.shiftName) ?? 0) + 1;
      nameOrdinals.set(shift.shiftName, ordinal);
      return {
        key: feasibilityShiftScopeKey(shift.shiftId),
        kind: "shift",
        label:
          duplicateCount > 1
            ? `${shift.shiftName} (${ordinal})`
            : shift.shiftName,
        shiftId: shift.shiftId,
        shiftName: shift.shiftName,
      };
    }),
  ];
};

export const resolveFeasibilityResultScope = (
  scopes = [],
  requestedKey = FEASIBILITY_GENERAL_SCOPE_KEY
) => {
  const source = Array.isArray(scopes) ? scopes : [];
  const requested = text(requestedKey);
  return (
    source.find((scope) => scope?.key === requested) ??
    source.find((scope) => scope?.kind === "general") ??
    null
  );
};

export const resolveFeasibilityScopeKeyboardTarget = (
  scopes = [],
  currentKey = FEASIBILITY_GENERAL_SCOPE_KEY,
  keyboardKey = ""
) => {
  const source = Array.isArray(scopes) ? scopes.filter((scope) => scope?.key) : [];
  if (!source.length) return null;

  const currentIndex = Math.max(
    0,
    source.findIndex((scope) => scope.key === currentKey)
  );

  if (keyboardKey === "Home") return source[0];
  if (keyboardKey === "End") return source[source.length - 1];
  if (keyboardKey === "ArrowRight" || keyboardKey === "ArrowDown") {
    return source[(currentIndex + 1) % source.length];
  }
  if (keyboardKey === "ArrowLeft" || keyboardKey === "ArrowUp") {
    return source[(currentIndex - 1 + source.length) % source.length];
  }
  return null;
};
