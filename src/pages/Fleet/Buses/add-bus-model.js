import "./buses.css";
import { createBusModel, updateBusModel } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";
import { closeSidePanel } from "../../../dom/side-panel";

const toBusModelPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const manufacturer = formData.get("manufacturer")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";
  const cost = formData.get("cost")?.toString().trim();
  const size = formData.get("size")?.toString().trim();
  const passengers = formData.get("passengers")?.toString().trim();
  const lifetime = formData.get("lifetime")?.toString().trim();
  const battery_cost = formData.get("battery_cost")?.toString().trim();
  const battery_lifetime = formData.get("battery_lifetime")?.toString().trim();
  const maintenance_cost = formData.get("maintenance_cost")?.toString().trim();

  return {
    name,
    manufacturer,
    description,
    cost,
    size,
    passengers,
    lifetime,
    battery_cost,
    battery_lifetime,
    maintenance_cost,
  };
};

export const initializeAddBusModel = (root = document, options = {}) => {
  const section = root.querySelector("section.add-bus-model");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const header = section.querySelector("header h1");
  const form = section.querySelector('form[data-form="add-bus-model"]');
  if (!form) {
    return null;
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
    const costInput = form.querySelector("#cost");
    const sizeInput = form.querySelector("#size");
    const passengersInput = form.querySelector("#passengers");
    const lifetimeInput = form.querySelector("#lifetime");
    const batteryCostInput = form.querySelector("#battery_cost");
    const batteryLifetimeInput = form.querySelector("#battery_lifetime");
    const maintenanceCostInput = form.querySelector("#maintenance_cost");

    if (nameInput)
      nameInput.value = currentModel.name || currentModel.model || "";
    if (manufacturerInput)
      manufacturerInput.value = currentModel.manufacturer || "";
    if (descriptionInput)
      descriptionInput.value = currentModel.description || "";
    if (costInput) costInput.value = currentModel.specs?.cost ?? "";
    if (sizeInput) sizeInput.value = currentModel.specs?.size ?? "";
    if (passengersInput)
      passengersInput.value = currentModel.specs?.passengers ?? "";
    if (lifetimeInput) lifetimeInput.value = currentModel.specs?.lifetime ?? "";
    if (batteryCostInput)
      batteryCostInput.value = currentModel.specs?.battery_cost ?? "";
    if (batteryLifetimeInput)
      batteryLifetimeInput.value = currentModel.specs?.battery_lifetime ?? "";
    if (maintenanceCostInput)
      maintenanceCostInput.value = currentModel.specs?.maintenance_cost ?? "";
  }

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const closeButton = section.querySelector('[data-action="close"]');

  const handleCloseClick = () => {
    closeSidePanel();
  };
  if (closeButton) {
    closeButton.addEventListener("click", handleCloseClick);
    cleanupHandlers.push(() => {
      closeButton.removeEventListener("click", handleCloseClick);
    });
  }

  const handleCancelClick = () => {
    closeSidePanel();
  };
  if (cancelButton) {
    cancelButton.addEventListener("click", handleCancelClick);
    cleanupHandlers.push(() => {
      cancelButton.removeEventListener("click", handleCancelClick);
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const {
      name,
      manufacturer,
      description,
      cost,
      size,
      passengers,
      lifetime,
      battery_cost,
      battery_lifetime,
      maintenance_cost,
    } = toBusModelPayload(formData);

    if (!name || !manufacturer) {
      updateFeedback(
        feedback,
        "Model name and manufacturer are required.",
        "error",
      );
      return;
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    const specs = {
      ...(currentModel.specs || {}),
      cost,
      size,
      passengers,
      lifetime,
      battery_cost,
      battery_lifetime,
      maintenance_cost,
    };

    try {
      const userId = await resolveUserId();

      if (isEditMode) {
        await updateBusModel(currentModel.id, {
          name,
          manufacturer,
          description,
          specs,
          userId,
        });
        writeFlash("Bus model updated.");
      } else {
        await createBusModel({
          name,
          manufacturer,
          description,
          specs,
          userId,
        });
        writeFlash("Bus model added.");
      }

      closeSidePanel();
      triggerPartialLoad("buses"); // Refresh the table
    } catch (error) {
      console.error(
        isEditMode ?
          "Failed to update bus model"
        : "Failed to create bus model",
        error,
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ?
            "Unable to update bus model."
          : "Unable to save bus model."),
        "error",
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  };

  form.addEventListener("submit", handleSubmit);
  cleanupHandlers.push(() => {
    form.removeEventListener("submit", handleSubmit);
  });

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
