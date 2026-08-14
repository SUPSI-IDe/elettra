import {
  normalizeDeletionBlocker,
  normalizeDeletionBlockers,
} from "../utils/protected-delete.js";

export const DELETE_ERROR_KIND = Object.freeze({
  BLOCKED: "blocked",
  FAILURE: "failure",
});

export class DeleteResponseError extends Error {
  constructor(message, { status, kind, detail, blockers = [] } = {}) {
    super(message);
    this.name = "DeleteResponseError";
    this.status = status ?? null;
    this.kind = kind ?? DELETE_ERROR_KIND.FAILURE;
    this.detail = detail ?? null;
    this.blockers = normalizeDeletionBlockers(blockers);
  }
}

const textValue = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const extractDetailMessage = (detail, fallbackMessage) => {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (Array.isArray(detail)) {
    const validationMessage = detail.find(
      (entry) => typeof entry?.msg === "string" && entry.msg.trim()
    )?.msg;
    if (validationMessage) {
      return validationMessage.trim();
    }

    const blockerMessages = detail
      .map((entry) =>
        typeof entry === "string"
          ? entry.trim()
          : typeof entry?.message === "string"
            ? entry.message.trim()
            : ""
      )
      .filter(Boolean);
    if (blockerMessages.length === 1) {
      return blockerMessages[0];
    }
  }

  if (detail && typeof detail === "object") {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message.trim();
    }
  }

  return fallbackMessage;
};

/**
 * Attempt to extract normalized blockers from a future or present 409 payload.
 * Does not assume a fixed backend contract beyond common object/array shapes.
 *
 * @param {unknown} detail
 * @returns {import("../utils/protected-delete.js").DeletionBlocker[]}
 */
export const parseDeletionBlockersFromDetail = (detail) => {
  if (!detail) {
    return [];
  }

  if (Array.isArray(detail)) {
    const typedEntries = detail.filter((entry) => entry && typeof entry === "object");
    if (
      typedEntries.length &&
      typedEntries.every((entry) => textValue(entry.type))
    ) {
      return normalizeDeletionBlockers(typedEntries);
    }
    return [];
  }

  if (typeof detail === "object") {
    if (Array.isArray(detail.blockers)) {
      return normalizeDeletionBlockers(detail.blockers);
    }
    if (textValue(detail.type)) {
      const blocker = normalizeDeletionBlocker(detail);
      return blocker ? [blocker] : [];
    }
  }

  return [];
};

export const isDeleteResponseError = (error) => error instanceof DeleteResponseError;

export const isBlockedDeleteError = (error) =>
  isDeleteResponseError(error) && error.kind === DELETE_ERROR_KIND.BLOCKED;

export const isDeleteFailureError = (error) =>
  isDeleteResponseError(error) && error.kind === DELETE_ERROR_KIND.FAILURE;

/**
 * @param {DeleteResponseError|Error} error
 * @param {string} [fallbackMessage]
 * @returns {string}
 */
export const formatDeleteErrorMessage = (
  error,
  fallbackMessage = "Unable to delete resource."
) => {
  if (isBlockedDeleteError(error)) {
    return textValue(error.message) || fallbackMessage;
  }

  if (isDeleteResponseError(error)) {
    return textValue(error.message) || fallbackMessage;
  }

  return textValue(error?.message) || fallbackMessage;
};

export const readDeleteResponse = async (
  response,
  fallbackMessage = "Unable to delete resource."
) => {
  if (!response?.ok) {
    const payload = await response?.json?.().catch(() => null);
    const detail = payload?.detail ?? null;
    const message = extractDetailMessage(detail, fallbackMessage);
    const status = response?.status ?? null;

    if (status === 409) {
      throw new DeleteResponseError(message, {
        status,
        kind: DELETE_ERROR_KIND.BLOCKED,
        detail,
        blockers: parseDeletionBlockersFromDetail(detail),
      });
    }

    throw new DeleteResponseError(message, {
      status,
      kind: DELETE_ERROR_KIND.FAILURE,
      detail,
    });
  }

  return { deleted: true };
};
