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

    if (section.diagram) {
      section.items.forEach((item, index) => {
        const child = createTextElement("a", "guide-nav-child", `UC${index + 1} · ${item.title}`);
        child.href = `#${item.id}`;
        nav.append(child);
      });
    }
  });
};

const createSectionLink = (id, label, className = "") => {
  const link = createTextElement("a", className, label);
  link.href = `#${id}`;
  return link;
};

const flowArrow = () => {
  const arrow = createTextElement("span", "guide-flow-arrow", "↓");
  arrow.setAttribute("aria-hidden", "true");
  return arrow;
};

const renderWorkflowDiagram = (section) => {
  const { diagram, items } = section;
  const figure = document.createElement("figure");
  figure.className = "guide-flow";
  figure.id = "use-cases-workflow";
  figure.setAttribute("aria-labelledby", "use-cases-workflow-title");
  figure.setAttribute("aria-describedby", "use-cases-workflow-description");
  const caption = document.createElement("figcaption");
  const title = createTextElement("h3", "", diagram.title);
  title.id = "use-cases-workflow-title";
  const description = createTextElement("p", "", diagram.description);
  description.id = "use-cases-workflow-description";
  caption.append(title, description);
  figure.append(caption, createTextElement("p", "guide-flow-label", diagram.choose));

  const choices = document.createElement("div");
  choices.className = "guide-flow-branches";
  items.forEach((item, index) => {
    const choice = createSectionLink(item.id, "", "guide-flow-node guide-use-case-tone");
    choice.dataset.case = String(index + 1);
    choice.append(createTextElement("strong", "", `UC${index + 1}`), createTextElement("span", "", item.title));
    choices.append(choice);
  });
  figure.append(choices, flowArrow());

  const preparation = document.createElement("ol");
  preparation.className = "guide-flow-preparation";
  [["fleet", diagram.fleet], ["shifts", diagram.shifts], ["feasibility", diagram.feasibility]].forEach(([id, label], index) => {
    const step = document.createElement("li");
    step.append(createSectionLink(id, label, "guide-flow-node"));
    if (index < 2) step.append(flowArrow());
    preparation.append(step);
  });
  figure.append(preparation, createTextElement("p", "guide-flow-label", diagram.modes));

  const modes = document.createElement("div");
  modes.className = "guide-flow-branches";
  items.forEach((item, index) => {
    const mode = createSectionLink(item.id, "", "guide-flow-node guide-use-case-tone");
    mode.dataset.case = String(index + 1);
    mode.append(createTextElement("span", "", `UC${index + 1} · ${item.modeLabel}`), createTextElement("code", "", item.mode));
    modes.append(mode);
  });
  figure.append(modes, flowArrow(), createTextElement("p", "guide-flow-decision", diagram.decision));

  const outcomes = document.createElement("div");
  outcomes.className = "guide-flow-outcomes";
  const revision = document.createElement("div");
  revision.className = "guide-flow-outcome";
  revision.append(createTextElement("strong", "", diagram.no), flowArrow(),
    createSectionLink("use-cases-workflow", diagram.revise, "guide-flow-node guide-flow-revise"));
  const feasible = document.createElement("div");
  feasible.className = "guide-flow-outcome";
  feasible.append(createTextElement("strong", "", diagram.yes), flowArrow(),
    createSectionLink("yearly", diagram.yearly, "guide-flow-node"),
    createTextElement("p", "guide-flow-impacts", diagram.impacts), flowArrow(),
    createSectionLink("comparison", diagram.compare, "guide-flow-node"));
  outcomes.append(revision, feasible);
  figure.append(outcomes);
  return figure;
};

const renderUseCases = (section, sections) => {
  const fragment = document.createDocumentFragment();
  fragment.append(renderWorkflowDiagram(section));
  const { labels } = section;
  const sectionTitle = (id) => sections.find((entry) => entry.id === id).title;

  section.items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "guide-use-case guide-use-case-tone";
    article.id = item.id;
    article.dataset.case = String(index + 1);
    article.setAttribute("aria-labelledby", `${item.id}-title`);
    const title = createTextElement("h3", "", `UC${index + 1} · ${item.title}`);
    title.id = `${item.id}-title`;
    article.append(title);

    const addParagraph = (heading, text, className = "") => {
      article.append(createTextElement("h4", "", heading), createTextElement("p", className, text));
    };
    addParagraph(labels.situation, item.text);
    addParagraph(labels.question, item.question, "guide-use-case-question");
    addParagraph(labels.available, item.available);
    article.append(createTextElement("h4", "", labels.workflow));
    const steps = document.createElement("ol");
    steps.className = "guide-use-case-steps";
    item.steps.forEach((step) => {
      const entry = createTextElement("li", "", `${step.text} `);
      entry.append(createSectionLink(step.section, sectionTitle(step.section)));
      steps.append(entry);
    });
    article.append(steps, createTextElement("h4", "", labels.mode));
    const mode = createTextElement("p", "guide-use-case-mode", `${item.modeLabel} · `);
    mode.append(createTextElement("code", "", item.mode));
    article.append(mode, createTextElement("p", "", item.scope));
    addParagraph(labels.next, item.nextSteps);
    const nextLink = createTextElement("p", "", `${labels.instructions}: `);
    nextLink.append(createSectionLink("comparison", sectionTitle("comparison")));
    article.append(nextLink);
    fragment.append(article);
  });

  const note = document.createElement("aside");
  note.className = "guide-note";
  note.append(createTextElement("h3", "", labels.boundary), createTextElement("p", "", section.boundary));
  fragment.append(note);
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

const renderSection = (section, ui, sections) => {
  const wrapper = document.createElement("section");
  wrapper.className = "guide-section";
  wrapper.id = section.id;

  wrapper.append(createTextElement("h2", "", section.title));
  wrapper.append(createTextElement("p", "guide-section-intro", section.intro));

  if (section.diagram) {
    wrapper.append(renderUseCases(section, sections));
    return wrapper;
  }

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
  sectionsRoot.replaceChildren(...content.sections.map((section) => renderSection(section, content.ui, content.sections)));

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
