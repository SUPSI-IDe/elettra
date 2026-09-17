import {
  SUPPORTED_GUIDE_LANGUAGES,
  guideContent,
} from "./content.js";

const STORAGE_KEY = "elettra_lang";
const DEFAULT_LANGUAGE = "en";

const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_GUIDE_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

const saveLanguage = (language) => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // The guide remains usable when browser storage is unavailable.
  }
};

const createTextElement = (tagName, className, value) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = value;
  return element;
};

const renderNavigation = (sections) => {
  const nav = document.querySelector("#guide-nav");
  nav.replaceChildren();

  sections.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = section.title;
    nav.append(link);
  });
};

const renderFigures = (figures, ui) => {
  const gallery = document.createElement("div");
  gallery.className = "guide-figure-grid";
  gallery.dataset.count = String(figures.length);

  figures.forEach((figureData) => {
    const figure = document.createElement("figure");
    figure.className = "guide-figure";

    const link = document.createElement("a");
    link.href = figureData.src;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${ui.openImage}: ${figureData.caption}`);

    const image = document.createElement("img");
    image.src = figureData.src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    link.append(image);

    const caption = createTextElement("figcaption", "", figureData.caption);
    figure.append(link, caption);
    gallery.append(figure);
  });

  return gallery;
};

const renderSection = (section, ui) => {
  const wrapper = document.createElement("section");
  wrapper.className = "guide-section";
  wrapper.id = section.id;

  wrapper.append(createTextElement("h2", "", section.title));
  wrapper.append(createTextElement("p", "guide-section-intro", section.intro));

  const list = document.createElement(section.ordered ? "ol" : "ul");
  list.className = "guide-item-list";
  list.dataset.ordered = String(Boolean(section.ordered));

  section.items.forEach((item) => {
    const entry = document.createElement("li");
    entry.className = "guide-item";
    entry.append(createTextElement("h3", "", item.title));
    entry.append(createTextElement("p", "", item.text));
    list.append(entry);
  });

  wrapper.append(list);

  if (section.figures?.length) {
    wrapper.append(renderFigures(section.figures, ui));
  }

  if (section.note) {
    const note = document.createElement("aside");
    note.className = "guide-note";
    note.append(createTextElement("h3", "", section.note.title));
    note.append(createTextElement("p", "", section.note.text));
    wrapper.append(note);
  }

  return wrapper;
};

const applyUiText = (ui) => {
  document.title = ui.documentTitle;

  document.querySelectorAll("[data-guide-ui]").forEach((element) => {
    const key = element.dataset.guideUi;
    if (ui[key]) element.textContent = ui[key];
  });

  const languageSelect = document.querySelector("#guide-language");
  languageSelect.setAttribute("aria-label", ui.languageAriaLabel);
  document.querySelector(".skip-link").textContent = ui.skipLink;
  document.querySelector(".guide-sidebar").setAttribute("aria-label", ui.sidebarAriaLabel);
  document.querySelector(".guide-brand").setAttribute("aria-label", ui.brandAriaLabel);
};

const updateCurrentSection = () => {
  const sections = Array.from(document.querySelectorAll(".guide-section"));
  const links = Array.from(document.querySelectorAll("#guide-nav a"));
  const current = sections
    .filter((section) => section.getBoundingClientRect().top <= 150)
    .at(-1)?.id;

  links.forEach((link) => {
    if (link.hash === `#${current}`) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const renderGuide = (language) => {
  const content = guideContent[language] ?? guideContent[DEFAULT_LANGUAGE];
  document.documentElement.lang = language;
  applyUiText(content.ui);
  renderNavigation(content.sections);

  const sectionsRoot = document.querySelector("#guide-sections");
  sectionsRoot.replaceChildren(...content.sections.map((section) => renderSection(section, content.ui)));

  const languageSelect = document.querySelector("#guide-language");
  languageSelect.value = language;
  updateCurrentSection();
};

const languageSelect = document.querySelector("#guide-language");
languageSelect.addEventListener("change", (event) => {
  const language = event.target.value;
  if (!SUPPORTED_GUIDE_LANGUAGES.includes(language)) return;
  saveLanguage(language);
  renderGuide(language);
});

document.querySelector('[data-action="print"]').addEventListener("click", () => {
  window.print();
});

let scrollFrame = null;
window.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    updateCurrentSection();
    scrollFrame = null;
  });
}, { passive: true });

renderGuide(getSavedLanguage());
