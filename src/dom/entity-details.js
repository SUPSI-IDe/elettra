import "./entity-details.css";
import { textContent } from "../ui-helpers";

export const renderEntityRowActions = (
  {
    details,
    duplicate,
    edit,
    rename,
    remove,
    order = ["details", "duplicate", "edit", "delete"],
  } = {}
) => {
  const actions = {
    details: { label: details, icon: "details" },
    duplicate: { label: duplicate, icon: "duplicate" },
    edit: { label: edit, icon: "edit" },
    rename: { label: rename, icon: "rename" },
    delete: { label: remove, icon: "delete", danger: true },
  };
  const buttons = order
    .map((action) => {
      const config = actions[action];
      if (!config) return "";
      const dangerClass = config.danger ? " entity-row-action--danger" : "";
      return `<button type="button" class="entity-row-action${dangerClass}" data-row-action="${action}" aria-label="${textContent(config.label)}" title="${textContent(config.label)}">
      <span class="entity-row-action__icon entity-row-action__icon--${config.icon}" aria-hidden="true"></span>
    </button>`;
    })
    .join("");

  return `
  <div class="entity-row-actions">
    ${buttons}
  </div>`;
};

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
