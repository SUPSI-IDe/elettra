export const getSidePanelRoot = () =>
  document.querySelector("aside.side-panel");

const getBackdrop = () => document.querySelector(".side-panel-backdrop");

export const openSidePanel = (content = "") => {
  const panel = getSidePanelRoot();
  const backdrop = getBackdrop();

  if (panel && backdrop) {
    panel.innerHTML = content;
    panel.hidden = false;
    backdrop.hidden = false;
    // Small timeout to allow transition if we were to add one (not strictly handling CSS transitions here yet, but standard practice)
    panel.setAttribute("aria-hidden", "false");
  }
};

export const closeSidePanel = () => {
  const panel = getSidePanelRoot();
  const backdrop = getBackdrop();

  if (panel && backdrop) {
    panel.hidden = true;
    backdrop.hidden = true;
    panel.innerHTML = "";
    panel.setAttribute("aria-hidden", "true");
  }
};
