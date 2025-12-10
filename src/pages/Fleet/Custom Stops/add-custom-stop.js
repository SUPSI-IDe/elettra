import "./custom-stops.css";
import { createDepot } from "../../../api";
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

export const initializeAddCustomStop = (root = document) => {
  const section = root.querySelector("section.add-custom-stop");
  if (!section) {
    return;
  }

  const form = section.querySelector('form[data-form="add-custom-stop"]');
  if (!form) {
    return;
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

    updateFeedback(feedback, "Saving…", "info");
    toggleFormDisabled(form, true);

    try {
      const userId = await resolveUserId();
      await createDepot({
        name,
        address,
        latitude,
        longitude,
        features,
        userId,
      });
      updateFeedback(feedback, "Custom stop added.", "success");
      triggerPartialLoad("custom-stops", {
        flashMessage: "Custom stop added.",
      });
    } catch (error) {
      console.error("Failed to create custom stop", error);
      updateFeedback(
        feedback,
        error?.message ?? "Unable to create custom stop.",
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  });
};
