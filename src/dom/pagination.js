import { textContent } from "../ui-helpers";
import { t } from "../i18n";
import {
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  coercePageSize,
  computeRange,
} from "../api/pagination";

/**
 * Build the static markup for a pagination control.
 *
 * The markup is intentionally generic so list pages can drop it inside
 * any container.  Pages then call `bindPaginationControl` to wire up the
 * UI to local pagination state.
 *
 * @param {{
 *   pageSizeLabel?: string,
 *   pageSizeOptions?: readonly number[],
 * }} [options]
 */
export const renderPaginationMarkup = ({
  pageSizeLabel = t("pagination.page_size_label") || "Rows per page",
  pageSizeOptions = PAGE_SIZE_OPTIONS,
} = {}) => {
  const previousLabel = textContent(t("pagination.previous") || "Previous");
  const nextLabel = textContent(t("pagination.next") || "Next");
  const sizeLabel = textContent(pageSizeLabel);
  const options = pageSizeOptions
    .map((size) => `<option value="${size}">${size}</option>`)
    .join("");

  return `
    <div class="pagination-controls" data-role="pagination" hidden>
      <label class="pagination-page-size">
        <span>${sizeLabel}</span>
        <select data-role="pagination-page-size" aria-label="${sizeLabel}">${options}</select>
      </label>
      <span class="pagination-range" data-role="pagination-range" aria-live="polite"></span>
      <span class="pagination-buttons">
        <button type="button" data-role="pagination-prev" disabled>${previousLabel}</button>
        <button type="button" data-role="pagination-next" disabled>${nextLabel}</button>
      </span>
    </div>
  `;
};

/**
 * Wire a pagination markup block to imperative state updates.  The
 * returned controller exposes `update(state)` which list pages call when
 * the API returns a fresh paginated response, plus `setBusy(boolean)`
 * which can be used to disable the controls during loading.
 *
 * @param {Element} container
 * @param {{
 *   onPageChange: (skip: number) => void,
 *   onPageSizeChange: (limit: 20 | 50 | 100) => void,
 * }} callbacks
 */
export const bindPaginationControl = (container, callbacks = {}) => {
  if (!container) {
    return null;
  }

  const root = container.querySelector('[data-role="pagination"]');
  const sizeSelect = container.querySelector('[data-role="pagination-page-size"]');
  const rangeLabel = container.querySelector('[data-role="pagination-range"]');
  const prevBtn = container.querySelector('[data-role="pagination-prev"]');
  const nextBtn = container.querySelector('[data-role="pagination-next"]');

  if (!root || !sizeSelect || !rangeLabel || !prevBtn || !nextBtn) {
    return null;
  }

  let currentState = {
    skip: 0,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    count: 0,
    has_next: false,
    has_previous: false,
    busy: false,
  };

  const refresh = () => {
    const { start, end } = computeRange(currentState);
    if (currentState.total > 0) {
      rangeLabel.textContent =
        t("pagination.showing_range", {
          start,
          end,
          total: currentState.total,
        }) || `Showing ${start}–${end} of ${currentState.total}`;
    } else {
      rangeLabel.textContent = t("pagination.empty") || "No results";
    }
    sizeSelect.value = String(currentState.limit);
    prevBtn.disabled =
      currentState.busy || !currentState.has_previous || currentState.skip <= 0;
    nextBtn.disabled = currentState.busy || !currentState.has_next;
    sizeSelect.disabled = currentState.busy;
    root.hidden = false;
  };

  const handlePrev = () => {
    if (prevBtn.disabled) return;
    const nextSkip = Math.max(0, currentState.skip - currentState.limit);
    callbacks.onPageChange?.(nextSkip);
  };

  const handleNext = () => {
    if (nextBtn.disabled) return;
    callbacks.onPageChange?.(currentState.skip + currentState.limit);
  };

  const handleSizeChange = () => {
    const nextLimit = coercePageSize(sizeSelect.value, currentState.limit);
    if (nextLimit === currentState.limit) return;
    callbacks.onPageSizeChange?.(nextLimit);
  };

  prevBtn.addEventListener("click", handlePrev);
  nextBtn.addEventListener("click", handleNext);
  sizeSelect.addEventListener("change", handleSizeChange);

  return {
    /**
     * Update the pagination state from a paginated response envelope.
     */
    update(next = {}) {
      currentState = {
        ...currentState,
        skip: Number.isFinite(next.skip) ? Number(next.skip) : currentState.skip,
        limit: coercePageSize(next.limit, currentState.limit),
        total: Number.isFinite(next.total) ? Number(next.total) : currentState.total,
        count: Number.isFinite(next.count) ? Number(next.count) : currentState.count,
        has_next: !!next.has_next,
        has_previous: !!next.has_previous,
      };
      refresh();
    },
    setBusy(isBusy) {
      currentState = { ...currentState, busy: !!isBusy };
      refresh();
    },
    setVisible(visible) {
      root.hidden = !visible;
    },
    destroy() {
      prevBtn.removeEventListener("click", handlePrev);
      nextBtn.removeEventListener("click", handleNext);
      sizeSelect.removeEventListener("change", handleSizeChange);
    },
  };
};

/**
 * Helper that injects the pagination markup into a container if it does
 * not already contain one.  Returns the bound controller.
 */
export const installPaginationControl = (container, callbacks, options) => {
  if (!container) return null;
  if (!container.querySelector('[data-role="pagination"]')) {
    container.insertAdjacentHTML("beforeend", renderPaginationMarkup(options));
  }
  return bindPaginationControl(container, callbacks);
};
