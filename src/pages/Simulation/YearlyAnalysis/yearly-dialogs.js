import { t } from "../../../i18n";

export const createYearlyDialogs = (section) => {
  const confirmation = section.querySelector('[data-role="yearly-confirm"]');
  const progress = section.querySelector('[data-role="simulation-progress"]');
  const field = (dialog, role) => dialog.querySelector(`[data-role="${role}"]`);
  let resolveConfirmation = null;
  let disposed = false;
  let timer = null;
  let startedAt = 0;

  const settle = () => {
    resolveConfirmation?.(!disposed && confirmation.returnValue === "start");
    resolveConfirmation = null;
  };
  const cancel = () => confirmation.close("cancel");
  const start = () => confirmation.close("start");
  const keepProgressOpen = (event) => event.preventDefault();
  confirmation.addEventListener("close", settle);
  field(confirmation, "evaluation-confirm-cancel").addEventListener("click", cancel);
  field(confirmation, "evaluation-confirm-start").addEventListener("click", start);
  progress.addEventListener("cancel", keepProgressOpen);

  const closeProgress = () => {
    clearInterval(timer);
    timer = null;
    if (progress.open) progress.close();
  };

  return {
    confirm({name, shiftCount, scenarioCount, depot}) {
      if (disposed || resolveConfirmation) return Promise.resolve(false);
      field(confirmation, "confirm-name").textContent = name;
      field(confirmation, "confirm-shifts").textContent = shiftCount;
      field(confirmation, "confirm-scenarios").textContent = scenarioCount;
      field(confirmation, "confirm-weather").textContent = depot;
      field(progress, "progress-name").textContent = name;
      field(progress, "progress-context").textContent = t("yearly_analysis.progress_context", {count: shiftCount, depot});
      confirmation.returnValue = "";
      return new Promise((resolve) => {
        resolveConfirmation = resolve;
        confirmation.showModal();
      });
    },
    showProgress(message, completed, total) {
      if (disposed) return;
      field(progress, "progress-message").textContent = message;
      const bar = field(progress, "progress-bar");
      bar.max = total;
      bar.value = completed;
      field(progress, "progress-count").textContent = t("yearly_analysis.progress_count", {completed, total});
      if (!progress.open) {
        startedAt = Date.now();
        field(progress, "progress-elapsed").textContent = "0:00";
        timer = setInterval(() => {
          const seconds = Math.floor((Date.now() - startedAt) / 1000);
          field(progress, "progress-elapsed").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        }, 1000);
        progress.showModal();
      }
    },
    closeProgress,
    dispose() {
      disposed = true;
      if (confirmation.open) confirmation.close("cancel");
      settle();
      closeProgress();
      confirmation.removeEventListener("close", settle);
      field(confirmation, "evaluation-confirm-cancel").removeEventListener("click", cancel);
      field(confirmation, "evaluation-confirm-start").removeEventListener("click", start);
      progress.removeEventListener("cancel", keepProgressOpen);
    },
  };
};
