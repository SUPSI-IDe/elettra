import "./buses.css";
import { createBusModel, updateBusModel } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";

const toBusModelPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const manufacturer = formData.get("manufacturer")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";

  return { name, manufacturer, description };
};

export const initializeAddBusModel = (root = document, options = {}) => {
  const section = root.querySelector("section.add-bus-model");
  if (!section) {
    return;
  }

  const header = section.querySelector("header h1");
  const form = section.querySelector('form[data-form="add-bus-model"]');
  if (!form) {
    return;
  }

  const isEditMode = !!options.busModel;
  const currentModel = options.busModel || {};

  if (isEditMode) {
    if (header) {
      header.textContent = "Edit Bus Model";
    }

    // Pre-fill form
    const nameInput = form.querySelector("#name");
    const manufacturerInput = form.querySelector("#manufacturer");
    const descriptionInput = form.querySelector("#description");

    if (nameInput)
      nameInput.value = currentModel.name || currentModel.model || "";
    if (manufacturerInput)
      manufacturerInput.value = currentModel.manufacturer || "";
    if (descriptionInput)
      descriptionInput.value = currentModel.description || "";
  }

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const closeButton = section.querySelector('[data-action="close"]');

  closeButton?.addEventListener("click", () => {
    triggerPartialLoad("buses");
  });

  cancelButton?.addEventListener("click", () => {
    triggerPartialLoad("buses");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { name, manufacturer, description } = toBusModelPayload(formData);

    if (!name || !manufacturer) {
      updateFeedback(
        feedback,
        "Model name and manufacturer are required.",
        "error"
      );
      return;
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    try {
      const userId = await resolveUserId();

      if (isEditMode) {
        await updateBusModel(currentModel.id, {
          name,
          manufacturer,
          description,
          specs: currentModel.specs || {},
          userId,
        });
        writeFlash("Bus model updated.");
      } else {
        await createBusModel({
          name,
          manufacturer,
          description,
          specs: {},
          userId,
        });
        writeFlash("Bus model added.");
      }

      triggerPartialLoad("buses");
    } catch (error) {
      console.error(
        isEditMode ?
          "Failed to update bus model"
        : "Failed to create bus model",
        error
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ?
            "Unable to update bus model."
          : "Unable to save bus model."),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  });
};
