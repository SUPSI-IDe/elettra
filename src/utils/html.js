export const toText = (value) =>
  value === null || value === undefined ? "" : String(value);

const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escape an untrusted value before interpolating it into HTML markup.
 *
 * This is safe for text nodes and quoted HTML attributes. Code that writes
 * through a DOM text API (`node.textContent`, D3's `.text()`, form values,
 * and similar APIs) must use `toText` instead so entities are not displayed
 * literally.
 */
export const escapeHtml = (value) =>
  toText(value).replace(
    HTML_ESCAPE_PATTERN,
    (character) => HTML_ESCAPES[character]
  );
