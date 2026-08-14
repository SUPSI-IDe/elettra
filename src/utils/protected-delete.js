import { translations } from "../i18n/translations.js";

/**
 * Machine-readable resource types that can block deletion.
 * Later F2 tasks pass these values in blocker objects.
 */
export const DELETION_BLOCKER_TYPES = Object.freeze({
  YEARLY_ANALYSIS: "yearly_analysis",
  OPTIMIZATION_RUN: "optimization_run",
  SHIFT: "shift",
  CUSTOM_STOP: "custom_stop",
  BUS_MODEL: "bus_model",
});

/**
 * Normalized representation of a resource that prevents deletion.
 *
 * @typedef {Object} DeletionBlocker
 * @property {string} type - Machine-readable blocker type (see DELETION_BLOCKER_TYPES).
 * @property {string} [id] - Resource identifier when known.
 * @property {string} [name] - Optional human-readable label.
 */

const BLOCKER_TYPE_I18N_KEYS = Object.freeze({
  [DELETION_BLOCKER_TYPES.YEARLY_ANALYSIS]:
    "protected_delete.blocker_type.yearly_analysis",
  [DELETION_BLOCKER_TYPES.OPTIMIZATION_RUN]:
    "protected_delete.blocker_type.optimization_run",
  [DELETION_BLOCKER_TYPES.SHIFT]: "protected_delete.blocker_type.shift",
  [DELETION_BLOCKER_TYPES.CUSTOM_STOP]:
    "protected_delete.blocker_type.custom_stop",
  [DELETION_BLOCKER_TYPES.BUS_MODEL]:
    "protected_delete.blocker_type.bus_model",
});

const textValue = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const defaultTranslate = (key, params = {}) => {
  const lang =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("elettra_lang") || "en"
      : "en";
  let text = translations[lang]?.[key] ?? translations.en?.[key] ?? key;

  Object.entries(params).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, String(value));
  });

  return text;
};

/**
 * @param {unknown} blocker
 * @returns {DeletionBlocker|null}
 */
export const normalizeDeletionBlocker = (blocker) => {
  if (!blocker || typeof blocker !== "object") {
    return null;
  }

  const type = textValue(blocker.type);
  if (!type) {
    return null;
  }

  const normalized = { type };
  const id = textValue(blocker.id);
  const name = textValue(blocker.name);

  if (id) {
    normalized.id = id;
  }
  if (name) {
    normalized.name = name;
  }

  return normalized;
};

/**
 * @param {unknown} blockers
 * @returns {DeletionBlocker[]}
 */
export const normalizeDeletionBlockers = (blockers) => {
  if (!Array.isArray(blockers)) {
    return [];
  }

  return blockers
    .map((blocker) => normalizeDeletionBlocker(blocker))
    .filter(Boolean);
};

/**
 * @param {DeletionBlocker} blocker
 * @param {(key: string, params?: Record<string, string|number>) => string} [translate]
 * @returns {string}
 */
export const formatDeletionBlockerLabel = (blocker, translate = defaultTranslate) => {
  const normalized = normalizeDeletionBlocker(blocker);
  if (!normalized) {
    return translate("protected_delete.blocker_type.unknown");
  }

  const typeLabel = translate(
    BLOCKER_TYPE_I18N_KEYS[normalized.type] ??
      "protected_delete.blocker_type.unknown"
  );

  if (normalized.name) {
    return translate("protected_delete.blocked_item_named", {
      typeLabel,
      name: normalized.name,
    });
  }

  if (normalized.id) {
    return translate("protected_delete.blocked_item_id", {
      typeLabel,
      id: normalized.id,
    });
  }

  return translate("protected_delete.blocked_item_type_only", { typeLabel });
};

/**
 * @param {DeletionBlocker[]} blockers
 * @param {(key: string, params?: Record<string, string|number>) => string} [translate]
 * @returns {string}
 */
export const formatBlockedDeletionMessage = (
  blockers,
  translate = defaultTranslate,
  { introKey = "protected_delete.blocked_intro", footerKey = "protected_delete.blocked_footer" } = {}
) => {
  const normalized = normalizeDeletionBlockers(blockers);
  if (!normalized.length) {
    return "";
  }

  const intro = translate(introKey);
  const items = normalized
    .map((blocker) => `- ${formatDeletionBlockerLabel(blocker, translate)}`)
    .join("\n");
  const footer = translate(footerKey);

  return `${intro}\n${items}\n\n${footer}`;
};

/**
 * Thin UX guard for page-specific delete handlers.
 *
 * When blockers exist, shows the explanation via `showFlash` and signals the
 * caller to stop. When no blockers exist, deletion may proceed as usual.
 *
 * @param {Object} options
 * @param {unknown} [options.blockers]
 * @param {(message: string) => void} [options.showFlash]
 * @returns {{ blocked: boolean, blockers: DeletionBlocker[] }}
 */
export const guardProtectedDeletion = ({
  blockers = [],
  showFlash,
  translate = defaultTranslate,
  introKey = "protected_delete.blocked_intro",
  footerKey = "protected_delete.blocked_footer",
} = {}) => {
  const normalized = normalizeDeletionBlockers(blockers);

  if (!normalized.length) {
    return { blocked: false, blockers: [] };
  }

  const message = formatBlockedDeletionMessage(normalized, translate, {
    introKey,
    footerKey,
  });
  if (typeof showFlash === "function" && message) {
    showFlash(message);
  }

  return { blocked: true, blockers: normalized };
};
