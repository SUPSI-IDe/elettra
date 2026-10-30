import { t } from "../../../i18n";

// Render only stages reported by the API; solver progress is not a percentage.
export const createEvaluationProgress = (section) => {
  const dialog = section.querySelector('[data-role="simulation-progress"]');
  const find = (role) => dialog.querySelector(`[data-role="${role}"]`);
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  let startedAt = 0;
  let timer = null;
  let mode = "battery_only";
  let disposed = false;

  const row = (basis, state, detail) => {
    const item = dialog.querySelector(`[data-progress-step="${basis}"]`);
    item.dataset.state = state;
    setText(item.querySelector('[data-role="step-state"]'), t(`simulation.progress_${state}`));
    setText(item.querySelector('[data-role="step-detail"]'), detail);
    item.querySelector('[data-role="step-symbol"]').textContent =
      state === "completed" ? "✓" : state === "failed" ? "!" : "";
  };
  const elapsed = () => {
    const seconds = Math.floor((performance.now() - startedAt) / 1000);
    setText(find("progress-elapsed"), `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`);
  };
  const keepOpen = (event) => event.preventDefault();
  dialog.addEventListener("cancel", keepOpen);

  const close = () => {
    clearInterval(timer);
    timer = null;
    dialog.close();
  };

  return {
    start({ name, count, optimizationMode, modeLabel }) {
      if (disposed) return;
      mode = optimizationMode;
      setText(find("progress-name"), name);
      setText(find("progress-context"), `${t("simulation.progress_blocks", { count })} · ${modeLabel}`);
      setText(find("progress-message"), t("simulation.progress_preparing"));
      row("predictions", "running", t("simulation.progress_preparing"));
      for (const basis of ["mean", "aggregate_q95"]) {
        const item = dialog.querySelector(`[data-progress-step="${basis}"]`);
        item.hidden = false;
        row(basis, "pending", t("simulation.progress_after_estimates"));
      }
      clearInterval(timer);
      startedAt = performance.now();
      elapsed();
      timer = setInterval(elapsed, 1000);
      dialog.showModal();
    },
    preparation({ stage, completed, total }) {
      if (disposed || !dialog.open) return;
      if (stage === "predictions") {
        const ready = completed === total;
        const detail = t("simulation.progress_estimates_ready", { completed, total });
        row("predictions", ready ? "completed" : "running", detail);
        setText(find("progress-message"), t(ready ? "simulation.progress_submitting" : "simulation.progress_consumption"));
      } else if (stage === "submitting") {
        setText(find("progress-message"), t("simulation.progress_submitting"));
      }
    },
    submitted(basisRunIds) {
      if (disposed || !dialog.open) return;
      setText(find("progress-message"), t("simulation.progress_optimizing"));
      for (const basis of ["mean", "aggregate_q95"]) {
        dialog.querySelector(`[data-progress-step="${basis}"]`).hidden = !basisRunIds[basis];
        row(basis, "pending", t("simulation.progress_waiting"));
      }
    },
    update(basis, run) {
      if (disposed || !dialog.open) return;
      const status = String(run?.status ?? "").toLowerCase();
      if (["completed", "done"].includes(status)) {
        row(basis, "completed", t("simulation.progress_results_ready"));
      } else if (["failed", "error"].includes(status)) {
        row(basis, "failed", t("simulation.progress_failed_detail"));
      } else if (status === "running") {
        const verification = run?.results?.forecast_verification ?? {};
        const phaseKey = {
          sizing: `simulation.progress_sizing_${mode}`,
          full_forecast: "simulation.progress_full_forecast",
          fixed_design_verification: "simulation.progress_verification",
          infeasibility_diagnostics: "simulation.progress_diagnostics",
        }[verification.phase] ?? "simulation.progress_calculating";
        const iteration = Number(verification.iteration);
        const pass = iteration > 0 ? ` · ${t("simulation.progress_iteration", { count: iteration })}` : "";
        row(basis, "running", `${t(phaseKey)}${pass}`);
      } else {
        row(basis, "pending", t("simulation.progress_waiting"));
      }
    },
    close,
    dispose() {
      disposed = true;
      close();
      dialog.removeEventListener("cancel", keepOpen);
    },
  };
};
