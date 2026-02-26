import { t } from "../../../i18n";
import "./add-simulation.css";
import { fetchBusModels, fetchShifts, fetchBuses } from "../../../api";
import { fetchShiftInfo } from "../../../api/shifts";
import { createPredictionRuns } from "../../../api/simulation";
import { isAuthenticated } from "../../../api/session";
import { getCurrentUserId } from "../../../store";
import { triggerPartialLoad } from "../../../events";
import { textContent, resolveModelFields } from "../../../ui-helpers";
import { saveRunIds } from "./simulation-runs";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const parseTime = (time) => {
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes))
    return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const setFeedback = (section, message, tone = "error") => {
  const el = section.querySelector('[data-role="feedback"]');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.dataset.tone = tone;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
};

const renderShiftRows = (tbody, shifts = []) => {
  if (!tbody) return;
  if (!shifts.length) {
    tbody.innerHTML = `<tr><td colspan="7">No shifts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = shifts
    .map((shift) => {
      const structure = Array.isArray(shift?.structure) ? shift.structure : [];
      const lines = structure
        .map(
          (item) =>
            text(
              item?.trip?.route_short_name ?? item?.route_short_name ?? ""
            )
        )
        .filter(Boolean);
      const linesLabel = lines.length ? [...new Set(lines)].join(", ") : "—";

      let startTime = text(shift?.start_time).trim();
      let endTime = text(shift?.end_time).trim();

      if ((!startTime || !endTime) && structure.length > 0) {
        const times = structure.flatMap((item) => {
          const trip = item?.trip ?? {};
          return [
            trip.departure_time,
            trip.arrival_time,
            trip.start_time,
            trip.end_time,
          ];
        });
        const minutes = times.map(parseTime).filter((m) => m !== null);
        if (minutes.length > 0) {
          if (!startTime) startTime = formatTime(Math.min(...minutes));
          if (!endTime) endTime = formatTime(Math.max(...minutes));
        }
      }

      const busModelName = text(shift._resolved_bus_model ?? "—");
      const dayLabel = text(shift._resolved_day ?? "—");

      return `
        <tr data-id="${text(shift?.id)}">
          <td class="checkbox">
            <input type="radio" name="selected-shift" aria-label="Select shift" />
          </td>
          <td>${textContent(shift?.name ?? "")}</td>
          <td>${textContent(busModelName)}</td>
          <td>${textContent(dayLabel)}</td>
          <td>${textContent(linesLabel)}</td>
          <td>${textContent(startTime || "—")}</td>
          <td>${textContent(endTime || "—")}</td>
        </tr>`;
    })
    .join("");
};

const firstAvailable = (...values) =>
  values.find(
    (v) => v !== null && v !== undefined && String(v).trim().length > 0
  ) ?? "";

const resolveDayOfWeek = (shift) => {
  const raw = firstAvailable(
    shift?.day_of_week,
    shift?.dayOfWeek,
    shift?.service_day,
    shift?.serviceDay,
    shift?.day
  );
  if (!raw) return "";
  const s = String(raw);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const initializeAddSimulation = async (
  root = document,
  options = {}
) => {
  const section = root.querySelector("section.add-simulation");
  if (!section) return null;

  const cleanupHandlers = [];
  const form = section.querySelector("form");
  const shiftTbody = section.querySelector(
    'tbody[data-role="shift-selection-body"]'
  );
  const shiftFilter = section.querySelector("#sim-shift-filter");

  let allShifts = [];

  if (isAuthenticated()) {
    try {
      const [shiftsPayload, busesPayload, modelsPayload] = await Promise.all([
        fetchShifts({ skip: 0, limit: 1000 }),
        fetchBuses({ skip: 0, limit: 1000 }),
        fetchBusModels({ skip: 0, limit: 1000 }),
      ]);

      const shifts = Array.isArray(shiftsPayload)
        ? shiftsPayload
        : (shiftsPayload?.items ?? shiftsPayload?.results ?? []);

      const buses = Array.isArray(busesPayload)
        ? busesPayload
        : (busesPayload?.items ?? busesPayload?.results ?? []);

      const models = Array.isArray(modelsPayload)
        ? modelsPayload
        : (modelsPayload?.items ?? modelsPayload?.results ?? []);

      const currentUserId = getCurrentUserId() ?? "";

      const userBuses =
        currentUserId && Array.isArray(buses)
          ? buses.filter((b) => b?.user_id === currentUserId)
          : (buses ?? []);

      const userModels =
        currentUserId && Array.isArray(models)
          ? models.filter((m) => m?.user_id === currentUserId)
          : (models ?? []);

      const modelsById = Object.fromEntries(
        userModels.filter((m) => m?.id).map((m) => [text(m.id), m])
      );

      const busToModelIdMap = new Map(
        userBuses
          .filter((b) => b?.id)
          .map((bus) => [text(bus.id), text(bus?.bus_model_id ?? "")])
      );

      const busModelMap = new Map(
        userBuses
          .filter((b) => b?.id)
          .map((bus) => {
            const modelId = text(bus?.bus_model_id ?? "");
            const resolved = resolveModelFields(modelsById[modelId]);
            return [text(bus.id), resolved.model || ""];
          })
      );

      allShifts = (Array.isArray(shifts) ? shifts : []).map((shift) => {
        const busId = text(
          shift?.bus?.id ?? shift?.bus_id ?? shift?.busId ?? ""
        );
        const directModelId = text(
          shift?.bus?.bus_model_id ??
            shift?.bus_model_id ??
            shift?.busModelId ??
            ""
        );
        const resolvedModelId = directModelId || busToModelIdMap.get(busId) || "";
        const modelFromBus = busModelMap.get(busId) || "";
        const modelFromDirect = resolveModelFields(modelsById[resolvedModelId]).model;
        const busModelName =
          modelFromBus || modelFromDirect || shift?.bus_model_name || "";

        const dayLabel = resolveDayOfWeek(shift);

        return {
          ...shift,
          _resolved_bus_model: busModelName,
          _resolved_bus_model_id: resolvedModelId,
          _resolved_day: dayLabel,
        };
      });

      renderShiftRows(shiftTbody, allShifts);

      // Pre-select shift and pre-fill fields when duplicating
      if (options.prefill?.shiftId) {
        applyPrefill(options.prefill);
      }

      // Asynchronously enrich shifts with day info from the /info endpoint
      enrichShiftDays(allShifts, shiftTbody);
    } catch (error) {
      console.error("Failed to load form data", error);
      setFeedback(section, error?.message ?? "Failed to load form data.");
    }
  }

  async function enrichShiftDays(shifts, tbody) {
    const needsDay = shifts.filter((s) => !s._resolved_day);
    if (!needsDay.length) return;

    for (const shift of needsDay) {
      try {
        const info = await fetchShiftInfo(shift.id);
        const daysOfWeek =
          info?.days_of_week ?? info?.daysOfWeek ?? [];
        const singleDay =
          info?.day_of_week ?? info?.dayOfWeek ?? "";
        const raw =
          (Array.isArray(daysOfWeek) && daysOfWeek.length > 0
            ? daysOfWeek[0]
            : singleDay) || "";

        if (raw) {
          const label =
            String(raw).charAt(0).toUpperCase() +
            String(raw).slice(1).toLowerCase();
          shift._resolved_day = label;

          const row = tbody?.querySelector(`tr[data-id="${shift.id}"]`);
          if (row) {
            const dayCell = row.querySelectorAll("td")[3];
            if (dayCell) dayCell.textContent = label;
          }
        }
      } catch {
        // Non-critical, leave as "—"
      }
    }
  }

  function applyPrefill(prefill = {}) {
    const { shiftId, occupancyPercent, heatingType, numBatteryPacks } = prefill;

    if (shiftId && shiftTbody) {
      const row = shiftTbody.querySelector(`tr[data-id="${shiftId}"]`);
      if (row) {
        const radio = row.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          row.scrollIntoView({ block: "nearest" });
        }
      }
    }

    if (occupancyPercent != null) {
      const occupancyInput = section.querySelector("#var-occupancy");
      if (occupancyInput) occupancyInput.value = occupancyPercent;
    }

    if (heatingType) {
      const heatingSelect = section.querySelector("#var-heating-type");
      if (heatingSelect) heatingSelect.value = heatingType;
    }

    if (numBatteryPacks != null && numBatteryPacks !== "") {
      const batteryInput = section.querySelector("#var-battery-packs");
      if (batteryInput) batteryInput.value = numBatteryPacks;
    }
  }

  const applyShiftFilter = () => {
    const query = (shiftFilter?.value ?? "").toLowerCase().trim();
    const filtered = query
      ? allShifts.filter(
          (s) =>
            text(s?.name).toLowerCase().includes(query) ||
            text(s?._resolved_bus_model).toLowerCase().includes(query) ||
            text(s?._resolved_day).toLowerCase().includes(query)
        )
      : allShifts;
    renderShiftRows(shiftTbody, filtered);
  };

  if (shiftFilter) {
    shiftFilter.addEventListener("input", applyShiftFilter);
    cleanupHandlers.push(() =>
      shiftFilter.removeEventListener("input", applyShiftFilter)
    );
  }

  const handleCancel = () => {
    triggerPartialLoad("simulation-runs");
  };

  section.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener("click", handleCancel);
    cleanupHandlers.push(() =>
      btn.removeEventListener("click", handleCancel)
    );
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(section, "");

    const selectedShiftId = shiftTbody
      ?.querySelector('input[type="radio"]:checked')
      ?.closest("tr")
      ?.dataset?.id;

    if (!selectedShiftId) {
      setFeedback(
        section,
        t("simulation.shift_required") || "Select one shift."
      );
      return;
    }

    const selectedShiftIds = [selectedShiftId];

    const selectedShifts = allShifts.filter((s) =>
      selectedShiftIds.includes(text(s?.id))
    );
    const selectedModelIds = [
      ...new Set(
        selectedShifts
          .map((shift) =>
            text(
              shift?._resolved_bus_model_id ??
                shift?.bus?.bus_model_id ??
                shift?.bus_model_id ??
                shift?.busModelId ??
                ""
            )
          )
          .filter(Boolean)
      ),
    ];

    if (!selectedModelIds.length) {
      setFeedback(
        section,
        "Could not resolve bus model from selected shifts."
      );
      return;
    }

    if (selectedModelIds.length > 1) {
      setFeedback(
        section,
        "Please select shifts that use the same bus model."
      );
      return;
    }

    const formData = new FormData(form);
    const occupancy = Number(formData.get("occupancy_percent") ?? 50);
    const heatingType =
      text(formData.get("auxiliary_heating_type") ?? "hp").trim() || "hp";
    const batteryPacksRaw = text(formData.get("num_battery_packs") ?? "").trim();
    const numBatteryPacks = batteryPacksRaw ? Number(batteryPacksRaw) : undefined;
    const confirmMessage =
      t("simulation.run_confirm") || "Launch this simulation?";
    if (!confirm(confirmMessage)) {
      return;
    }

    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await createPredictionRuns({
        shift_ids: selectedShiftIds,
        bus_model_id: selectedModelIds[0],
        occupancy_percent: occupancy,
        auxiliary_heating_type: heatingType,
        num_battery_packs: numBatteryPacks,
      });

      const runIds = Array.isArray(response?.prediction_run_ids)
        ? response.prediction_run_ids
        : [];
      if (runIds.length) {
        saveRunIds(runIds);
      }

      triggerPartialLoad("simulation-runs", {
        flashMessage:
          t("simulation.completed") || "Simulation submitted successfully.",
      });
    } catch (error) {
      console.error("Failed to submit simulation", error);
      setFeedback(section, error?.message ?? "Failed to submit simulation.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  if (form) {
    form.addEventListener("submit", handleSubmit);
    cleanupHandlers.push(() =>
      form.removeEventListener("submit", handleSubmit)
    );
  }

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
