import "./buses.css";
import { createBus, updateBus, fetchBusModels } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash, getModelsById } from "../../../store";
import {
  toggleFormDisabled,
  updateFeedback,
  resolveModelFields,
  textContent,
} from "../../../ui-helpers";

const toBusPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const busModelId = formData.get("busModelId")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";

  return { name, busModelId, description };
};

const renderModelOptions = (select, models = [], selectedId = "") => {
  const options = [
    '<option value="">Select a model</option>',
    ...models
      .filter((model) => model?.id)
      .map((model) => {
        const { model: label, manufacturer } = resolveModelFields(model);
        const name = label || "Untitled model";
        const suffix = manufacturer ? ` — ${manufacturer}` : "";
        const isSelected =
          String(model.id) === String(selectedId) ? "selected" : "";
        return `<option value="${String(model.id)}" ${isSelected}>${textContent(
          `${name}${suffix}`
        )}</option>`;
      }),
  ].join("");
  select.innerHTML = options;
};

export const initializeAddBus = async (root = document, options = {}) => {
  const section = root.querySelector("section.add-bus");
  if (!section) {
    return;
  }

  const header = section.querySelector("header h1");
  const intro = section.querySelector("header .intro");
  const form = section.querySelector('form[data-form="add-bus"]');
  if (!form) {
    return;
  }

  const isEditMode = !!options.bus;
  const currentBus = options.bus || {};

  // Fetch models if not already available or just strictly fetch fresh ones
  // We can rely on cache or fetch fresh. Let's fetch fresh or use passed models if we want to be robust.
  // For simplicity and consistency with other pages, let's allow fetching.
  let models = Object.values(getModelsById());
  if (models.length === 0) {
    try {
      const payload = await fetchBusModels({ skip: 0, limit: 100 });
      models =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );
    } catch (e) {
      console.warn("Failed to load models for dropdown", e);
    }
  }

  const modelSelect = form.querySelector("#bus-model");
  if (modelSelect) {
    renderModelOptions(modelSelect, models, currentBus.bus_model_id);
  }

  if (isEditMode) {
    if (header) header.textContent = "Edit Bus";
    if (intro) intro.textContent = "Update vehicle details.";

    const nameInput = form.querySelector("#name");
    const descriptionInput = form.querySelector("#description");

    if (nameInput) nameInput.value = currentBus.name || "";
    if (descriptionInput) descriptionInput.value = currentBus.description || "";
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
    const { name, busModelId, description } = toBusPayload(formData);

    if (!name) {
      updateFeedback(feedback, "Bus name is required.", "error");
      return;
    }
    if (!busModelId) {
      updateFeedback(feedback, "Bus model is required.", "error");
      return;
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    try {
      const userId = await resolveUserId();

      if (isEditMode) {
        await updateBus(currentBus.id, {
          name,
          busModelId,
          description,
          specs: currentBus.specs || {},
          userId,
        });
        writeFlash("Bus updated.");
      } else {
        await createBus({
          name,
          busModelId,
          description,
          specs: {},
          userId,
        });
        writeFlash("Bus added.");
      }

      triggerPartialLoad("buses");
    } catch (error) {
      console.error(
        isEditMode ? "Failed to update bus" : "Failed to create bus",
        error
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ? "Unable to update bus." : "Unable to save bus."),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  });
};
