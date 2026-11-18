import "./entity-details.css";
import "./rename-dialog.css";
import { textContent } from "../ui-helpers";

export const renderRenameButton = ({ action, label } = {}) => `
  <button type="button" class="entity-row-action analysis-name-cell__rename" data-action="${textContent(action)}" aria-label="${textContent(label)}" title="${textContent(label)}">
    <span class="entity-row-action__icon entity-row-action__icon--rename" aria-hidden="true"></span>
  </button>`;

export const initializeRenameDialog = (
  host,
  {
    title = "Rename",
    nameLabel = "Name",
    cancelLabel = "Cancel",
    saveLabel = "Save",
    fallbackError = "Unable to update the name.",
  } = {},
) => {
  if (!host) return null;

  const dialog = document.createElement("dialog");
  dialog.className = "rename-dialog";
  dialog.setAttribute("aria-labelledby", "analysis-rename-dialog-title");
  dialog.innerHTML = `
    <form class="rename-dialog__form" data-role="rename-form">
      <header class="rename-dialog__header">
        <h2 class="rename-dialog__title" id="analysis-rename-dialog-title"></h2>
      </header>
      <div class="rename-dialog__body">
        <label class="rename-dialog__label" for="analysis-rename-name"></label>
        <input class="rename-dialog__input" id="analysis-rename-name" name="name" type="text" required maxlength="200" autocomplete="off" />
        <p class="rename-dialog__feedback" data-role="rename-feedback" role="alert" hidden></p>
      </div>
      <footer class="rename-dialog__footer">
        <button type="button" class="list-secondary-action" data-action="cancel-rename"></button>
        <button type="submit" class="list-primary-action" data-action="save-rename"></button>
      </footer>
    </form>`;
  host.append(dialog);

  const form = dialog.querySelector('[data-role="rename-form"]');
  const titleElement = dialog.querySelector(".rename-dialog__title");
  const labelElement = dialog.querySelector(".rename-dialog__label");
  const input = dialog.querySelector(".rename-dialog__input");
  const feedback = dialog.querySelector('[data-role="rename-feedback"]');
  const cancelButton = dialog.querySelector('[data-action="cancel-rename"]');
  const saveButton = dialog.querySelector('[data-action="save-rename"]');
  let submit = null;
  let initialValue = "";
  let returnFocus = null;

  titleElement.textContent = title;
  labelElement.textContent = nameLabel;
  cancelButton.textContent = cancelLabel;
  saveButton.textContent = saveLabel;

  const close = () => {
    if (dialog.open) dialog.close();
  };
  const handleCancel = () => close();
  const handleBackdropClick = (event) => {
    if (event.target === dialog) close();
  };
  const handleClose = () => {
    submit = null;
    feedback.hidden = true;
    feedback.textContent = "";
    saveButton.disabled = false;
    input.disabled = false;
    returnFocus?.focus?.();
    returnFocus = null;
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.setCustomValidity(nameLabel);
      input.reportValidity();
      input.setCustomValidity("");
      return;
    }
    if (name === initialValue) {
      close();
      return;
    }

    saveButton.disabled = true;
    input.disabled = true;
    feedback.hidden = true;
    feedback.textContent = "";
    try {
      await submit?.(name);
      close();
    } catch (error) {
      feedback.textContent = error?.message || fallbackError;
      feedback.hidden = false;
      saveButton.disabled = false;
      input.disabled = false;
      input.focus();
    }
  };

  cancelButton.addEventListener("click", handleCancel);
  dialog.addEventListener("click", handleBackdropClick);
  dialog.addEventListener("close", handleClose);
  form.addEventListener("submit", handleSubmit);

  return {
    open({ value = "", onSubmit, trigger = null } = {}) {
      initialValue = String(value).trim();
      input.value = initialValue;
      submit = onSubmit;
      returnFocus = trigger;
      feedback.hidden = true;
      feedback.textContent = "";
      dialog.showModal();
      input.focus();
      input.select();
    },
    close,
    destroy() {
      cancelButton.removeEventListener("click", handleCancel);
      dialog.removeEventListener("click", handleBackdropClick);
      dialog.removeEventListener("close", handleClose);
      form.removeEventListener("submit", handleSubmit);
      close();
      dialog.remove();
    },
  };
};
