import "./custom-stops.css";
import { createDepot, updateDepot } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";

const parseCoordinate = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return undefined;
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const toDepotPayload = (formData) => {
  const name = formData.get("name")?.toString().trim() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const type = formData.get("type")?.toString().trim() ?? "";
  const city = formData.get("city")?.toString().trim() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const latitude = parseCoordinate(formData.get("latitude"));
  const longitude = parseCoordinate(formData.get("longitude"));

  const features = {};
  if (type) {
    features.type = type;
  }
  if (city) {
    features.city = city;
  }
  if (notes) {
    features.notes = notes;
  }

  return {
    name,
    address,
    latitude,
    longitude,
    features,
  };
};

export const initializeAddCustomStop = (root = document, options = {}) => {
  const section = root.querySelector("section.add-custom-stop");
  if (!section) {
    return;
  }

  const form = section.querySelector('form[data-form="add-custom-stop"]');
  if (!form) {
    return;
  }

  const isEditMode = !!options.depot;
  const currentDepot = options.depot || {};

  if (isEditMode) {
    const header = section.querySelector("header h1");
    if (header) {
      header.textContent = "Edit Custom Stop";
    }

    // Pre-fill form
    const nameInput = form.querySelector("#custom-stop-name");
    const typeSelect = form.querySelector("#custom-stop-type");
    const addressInput = form.querySelector("#custom-stop-address");
    const cityInput = form.querySelector("#custom-stop-city");
    const latInput = form.querySelector("#custom-stop-latitude");
    const lonInput = form.querySelector("#custom-stop-longitude");
    const notesInput = form.querySelector("#custom-stop-notes");

    if (nameInput) nameInput.value = currentDepot.name || "";
    if (addressInput) addressInput.value = currentDepot.address || "";
    if (latInput) latInput.value = currentDepot.latitude ?? "";
    if (lonInput) lonInput.value = currentDepot.longitude ?? "";

    if (typeSelect && currentDepot.features?.type) {
      typeSelect.value = currentDepot.features.type;
    }
    if (cityInput && currentDepot.features?.city) {
      cityInput.value = currentDepot.features.city;
    }
    if (notesInput && currentDepot.features?.notes) {
      notesInput.value = currentDepot.features.notes;
    }
  }

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');

  cancelButton?.addEventListener("click", () => {
    triggerPartialLoad("custom-stops");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { name, address, latitude, longitude, features } =
      toDepotPayload(formData);

    if (!name || !address) {
      updateFeedback(feedback, "Name and address are required.", "error");
      return;
    }

    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");
    toggleFormDisabled(form, true);

    try {
      const userId = await resolveUserId();

      if (isEditMode) {
        await updateDepot(currentDepot.id, {
          name,
          address,
          latitude,
          longitude,
          features,
          userId,
        });
        updateFeedback(feedback, "Custom stop updated.", "success");
      } else {
        await createDepot({
          name,
          address,
          latitude,
          longitude,
          features,
          userId,
        });
        updateFeedback(feedback, "Custom stop added.", "success");
      }

      triggerPartialLoad("custom-stops", {
        flashMessage:
          isEditMode ? "Custom stop updated." : "Custom stop added.",
      });
    } catch (error) {
      console.error(
        isEditMode ?
          "Failed to update custom stop"
        : "Failed to create custom stop",
        error
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ?
            "Unable to update custom stop."
          : "Unable to create custom stop."),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  });
};
