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

    if (section.id === "use-cases") {
      section.items.forEach((item, index) => {
        const child = createTextElement("a", "guide-nav-child", `${index + 1}. ${item.modeLabel}`);
        child.href = `#${item.id}`;
        nav.append(child);
      });
    }
  });
};

const renderUseCases = (section) => {
  const table = document.createElement("table");
  table.className = "guide-case-table";
  table.setAttribute("aria-labelledby", "use-cases-title");
  const headingRow = table.createTHead().insertRow();
  for (const label of section.columns) {
    const heading = createTextElement("th", "", label);
    heading.scope = "col";
    headingRow.append(heading);
  }

  const body = table.createTBody();
  section.items.forEach((item, index) => {
    const row = body.insertRow();
    row.id = item.id;
    row.className = "guide-use-case";
    const question = createTextElement("th", "", `${index + 1}. ${item.title}`);
    question.scope = "row";
    row.append(question);
    row.insertCell().textContent = item.text;
    const mode = row.insertCell();
    const mobileLabel = createTextElement("span", "guide-case-mobile-label", section.columns[2]);
    mobileLabel.setAttribute("aria-hidden", "true");
    mode.append(mobileLabel, createTextElement("strong", "", item.modeLabel));
  });

  const { workflow } = section;
  const steps = document.createElement("section");
  steps.className = "guide-case-workflow";
  steps.id = "use-cases-workflow";
  steps.append(createTextElement("h3", "", workflow.title));
  for (const text of [workflow.service, workflow.evaluation, workflow.annual]) {
    steps.append(createTextElement("p", "", text));
  }
  const links = document.createElement("p");
  links.className = "guide-item-links";
  for (const { href, label } of workflow.links) {
    const link = createTextElement("a", "", label);
    link.href = href;
    links.append(link);
  }
  steps.append(links);
  const fragment = document.createDocumentFragment();
  fragment.append(table, steps);
  return fragment;
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
    // Reserve the screenshot's aspect ratio before its lazy response arrives,
    // so loading earlier figures cannot move the URL's anchor destination.
    image.width = figureData.width;
    image.height = figureData.height;
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

  const title = createTextElement("h2", "", section.title);
  title.id = `${section.id}-title`;
  wrapper.append(title);
  wrapper.append(createTextElement("p", "guide-section-intro", section.intro));

  if (section.id === "use-cases") {
    wrapper.append(renderUseCases(section));
    return wrapper;
  }

  const list = document.createElement(section.ordered ? "ol" : "ul");
  list.className = "guide-item-list";
  list.dataset.ordered = String(Boolean(section.ordered));

  section.items.forEach((item) => {
    const entry = document.createElement("li");
    entry.className = "guide-item";
    if (item.id) entry.id = item.id;
    entry.append(createTextElement("h3", "", item.title));
    entry.append(createTextElement("p", "", item.text));
    if (item.links?.length) {
      const links = document.createElement("p");
      links.className = "guide-item-links";
      for (const { href, label } of item.links) {
        const link = createTextElement("a", "", label);
        link.href = href;
        links.append(link);
      }
      entry.append(links);
    }
    if (item.figures?.length) entry.append(renderFigures(item.figures, ui));
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
  const sections = Array.from(document.querySelectorAll(".guide-section, .guide-use-case"));
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
  document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "instant" });
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
languageSelect.disabled = false;
