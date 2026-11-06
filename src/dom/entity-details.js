import "./entity-details.css";
import { textContent } from "../ui-helpers";

export const renderEntityRowActions = ({ details, edit, remove } = {}) => `
  <div class="entity-row-actions">
    <button type="button" class="entity-row-action" data-row-action="details" aria-label="${textContent(details)}" title="${textContent(details)}">
      <span class="entity-row-action__icon entity-row-action__icon--details" aria-hidden="true"></span>
    </button>
    <button type="button" class="entity-row-action" data-row-action="edit" aria-label="${textContent(edit)}" title="${textContent(edit)}">
      <span class="entity-row-action__icon entity-row-action__icon--edit" aria-hidden="true"></span>
    </button>
    <button type="button" class="entity-row-action entity-row-action--danger" data-row-action="delete" aria-label="${textContent(remove)}" title="${textContent(remove)}">
      <span class="entity-row-action__icon entity-row-action__icon--delete" aria-hidden="true"></span>
    </button>
  </div>`;

const createElement = (tagName, className, text = "") => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

export const initializeEntityDetailsDialog = (dialog) => {
  if (!dialog) return null;

  const titleElement = dialog.querySelector('[data-role="entity-details-title"]');
  const contentElement = dialog.querySelector('[data-role="entity-details-content"]');
  const closeButton = dialog.querySelector('[data-action="close-details"]');

  const close = () => {
    if (dialog.open) dialog.close();
  };

  const handleBackdropClick = (event) => {
    if (event.target === dialog) close();
  };

  closeButton?.addEventListener("click", close);
  dialog.addEventListener("click", handleBackdropClick);

  return {
    open({ title = "", groups = [] } = {}) {
      if (titleElement) titleElement.textContent = title;
      if (contentElement) {
        contentElement.replaceChildren();
        groups.forEach((group = {}) => {
          const section = createElement("section", "entity-details__section");
          if (group.title) {
            section.append(
              createElement("h3", "entity-details__section-title", group.title)
            );
          }
          const list = createElement("dl", "entity-details__list");
          (group.rows ?? []).forEach((row = {}) => {
            const item = createElement("div", "entity-details__item");
            item.append(
              createElement("dt", "entity-details__label", row.label ?? ""),
              createElement("dd", "entity-details__value", row.value ?? "—")
            );
            list.append(item);
          });
          section.append(list);
          contentElement.append(section);
        });
      }
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    },
    close,
    destroy() {
      closeButton?.removeEventListener("click", close);
      dialog.removeEventListener("click", handleBackdropClick);
      close();
    },
  };
};
