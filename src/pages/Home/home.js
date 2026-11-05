import "./home.css";
import { triggerPartialLoad } from "../../events";

export const initializeHome = (container) => {
  const onClick = (event) => {
    const link = event.target.closest("a[data-home-route]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    triggerPartialLoad(link.dataset.homeRoute);
  };
  container.addEventListener("click", onClick);
  return () => container.removeEventListener("click", onClick);
};
