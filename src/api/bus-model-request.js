const validationDetailMessage = (detail) => {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (!Array.isArray(detail)) return "";
  return detail
    .map((item) => (typeof item?.msg === "string" ? item.msg.trim() : ""))
    .filter(Boolean)
    .join("; ");
};

export const extractBusModelValidationFields = (payload) => {
  const detail = Array.isArray(payload?.detail) ? payload.detail : [];
  const fields = detail
    .map((item) => {
      const location = Array.isArray(item?.loc) ? item.loc : [];
      const relevant = location.filter(
        (part) =>
          typeof part === "string" && part !== "body" && part !== "query"
      );
      return relevant.at(-1) || "";
    })
    .filter(Boolean);
  return [...new Set(fields)];
};

export class BusModelApiError extends Error {
  constructor(message, { status = 0, validationFields = [] } = {}) {
    super(message);
    this.name = "BusModelApiError";
    this.status = status;
    this.validationFields = validationFields;
  }
}

export const buildBusModelApiError = (response, payload, fallbackMessage) => {
  const detailMessage = validationDetailMessage(payload?.detail);
  return new BusModelApiError(detailMessage || fallbackMessage, {
    status: response.status,
    validationFields:
      response.status === 422 ? extractBusModelValidationFields(payload) : [],
  });
};

export const buildBusModelUpdateBody = ({
  name,
  manufacturer,
  model,
  description,
  specs,
  userId,
} = {}) => {
  const body = {};

  if (name !== undefined) body.name = name;
  if (manufacturer !== undefined) body.manufacturer = manufacturer;
  if (description !== undefined) body.description = description;
  if (specs !== undefined) body.specs = specs;
  if (model !== undefined && model !== "") body.model = model;
  if (userId !== undefined && userId !== "") body.user_id = userId;

  return body;
};

export const buildBusModelEditRequestBody = ({
  name,
  description,
  specs,
} = {}) =>
  buildBusModelUpdateBody({ name, description, specs });
