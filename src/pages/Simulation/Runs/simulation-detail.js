import { t } from "../../../i18n";
import "./simulation-detail.css";
import {
  createPredictionRuns,
  fetchPredictionRun,
} from "../../../api/simulation";
import { isAuthenticated } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import { saveRunIds } from "./simulation-runs";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

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

const formatResultValue = (value) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return value.toLocaleString("de-CH", { maximumFractionDigits: 4 });
  }
  return textContent(String(value));
};

const renderResults = (container, runs) => {
  if (!container || !Array.isArray(runs) || !runs.length) return;

  const rows = runs
    .map((run) => {
      const summary = run?.summary ?? {};
      const status = text(run?.status ?? "pending");
      const shiftId = text(run?.shift_id ?? "");

      let summaryHtml = "";
      if (summary && typeof summary === "object" && Object.keys(summary).length) {
        summaryHtml = Object.entries(summary)
          .map(
            ([key, value]) => `
            <div class="result-row">
              <span class="result-label">${textContent(key.replace(/_/g, " "))}</span>
              <span class="result-value">${formatResultValue(value)}</span>
            </div>`
          )
          .join("");
      }

      return `
        <div class="result-card">
          <div class="result-header">
            <span class="result-shift">Shift: ${textContent(shiftId.slice(0, 8))}…</span>
            <span class="status-badge ${status}">${textContent(status)}</span>
          </div>
          ${summaryHtml || '<div class="result-row"><span class="result-label">Waiting for results…</span></div>'}
        </div>`;
    })
    .join("");

  container.innerHTML = rows;
};

export const initializeSimulationDetail = async (
  root = document,
  options = {}
) => {
  const section = root.querySelector("section.simulation-detail");
  if (!section) return null;

  const cleanupHandlers = [];
  const form = section.querySelector('[data-role="detail-form"]');
  const resultsSection = section.querySelector('[data-role="results"]');
  const resultsContent = section.querySelector('[data-role="results-content"]');
  const simNameEl = section.querySelector('[data-role="sim-name"]');

  const simulationName = options.simulationName ?? "";
  const shiftIds = Array.isArray(options.shiftIds) ? options.shiftIds : [];
  const busModelId = options.busModelId ?? "";

  if (simNameEl) {
    simNameEl.textContent = simulationName || "New Simulation";
  }

  const handleBack = () => {
    triggerPartialLoad("simulation-runs");
  };

  section
    .querySelectorAll('[data-action="back"], [data-action="cancel"]')
    .forEach((btn) => {
      btn.addEventListener("click", handleBack);
      cleanupHandlers.push(() => btn.removeEventListener("click", handleBack));
    });

  if (!shiftIds.length || !isAuthenticated()) {
    setFeedback(
      section,
      !shiftIds.length
        ? "No shifts selected. Go back and select shifts first."
        : (t("simulation.login_required") || "Please login.")
    );
    return () => cleanupHandlers.forEach((h) => h());
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(section, "");

    const formData = new FormData(form);
    const externalTemp = Number(formData.get("external_temp_celsius") ?? 15);
    const occupancy = Number(formData.get("occupancy_percent") ?? 50);
    const heatingType = (formData.get("auxiliary_heating_type") ?? "default").trim();
    const batteryPacksRaw = (formData.get("num_battery_packs") ?? "").trim();
    const numBatteryPacks = batteryPacksRaw ? Number(batteryPacksRaw) : undefined;

    if (!busModelId) {
      setFeedback(
        section,
        "Could not determine bus model from the selected shifts. Please go back and try again."
      );
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setFeedback(section, "Submitting simulation…", "info");

    try {
      const result = await createPredictionRuns({
        shift_ids: shiftIds,
        bus_model_id: busModelId,
        external_temp_celsius: externalTemp,
        occupancy_percent: occupancy,
        auxiliary_heating_type: heatingType,
        num_battery_packs: numBatteryPacks,
      });

      const runIds = result?.prediction_run_ids ?? [];
      if (!runIds.length) {
        setFeedback(section, "Simulation submitted but no run IDs returned.", "info");
        return;
      }

      saveRunIds(runIds);

      setFeedback(
        section,
        `Simulation submitted (${runIds.length} prediction run(s)). Loading results…`,
        "success"
      );

      if (resultsSection) resultsSection.hidden = false;

      await pollResults(runIds, resultsContent, section);
    } catch (error) {
      console.error("Failed to create prediction runs", error);
      setFeedback(section, error?.message ?? "Failed to run simulation.");
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

async function pollResults(runIds, container, section, maxAttempts = 20) {
  let attempts = 0;

  const poll = async () => {
    attempts++;
    try {
      const runs = await Promise.all(runIds.map((id) => fetchPredictionRun(id)));
      renderResults(container, runs);

      const allDone = runs.every(
        (r) => r?.status === "completed" || r?.status === "failed"
      );
      if (allDone) {
        const failedCount = runs.filter((r) => r?.status === "failed").length;
        if (failedCount > 0) {
          setFeedback(
            section,
            `Simulation finished. ${failedCount} of ${runs.length} run(s) failed.`,
            failedCount === runs.length ? "error" : "info"
          );
        } else {
          setFeedback(
            section,
            t("simulation.completed") || "Simulation completed successfully.",
            "success"
          );
        }
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 3000);
      } else {
        setFeedback(
          section,
          "Simulation is still running. Refresh later to see results.",
          "info"
        );
      }
    } catch (error) {
      console.error("Error polling results", error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      }
    }
  };

  await poll();
}
