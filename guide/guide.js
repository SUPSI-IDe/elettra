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

const renderNavigation = (sections, ui) => {
  const nav = document.querySelector("#guide-nav");
  nav.replaceChildren();

  for (const section of sections) {
    const group = sectionGroupLabel(section.id, ui);
    if (group) nav.append(createTextElement("p", "guide-nav-group", group));
    nav.append(createSectionLink(section.id, section.title));
  }
};

const sectionGroupLabel = (id, ui) => {
  if (id === "fleet") return ui.operatingGuide;
  if (id === "start") return ui.references;
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
  const caption = document.createElement("figcaption");
  const title = createTextElement("h3", "", diagram.title);
  title.id = "use-cases-workflow-title";
  caption.append(title);
  figure.append(caption, createTextElement("h4", "guide-flow-label", diagram.preparation));

  const preparation = document.createElement("ol");
  preparation.className = "guide-flow-preparation";
  [["fleet", diagram.fleet], ["shifts", diagram.shifts], ["feasibility", diagram.feasibility]].forEach(([id, label], index) => {
    const step = document.createElement("li");
    step.append(createSectionLink(id, label, "guide-flow-node"));
    if (index < 2) step.append(flowArrow());
    preparation.append(step);
  });
  figure.append(preparation, flowArrow(), createTextElement("h4", "guide-flow-label", diagram.modes));

  const modes = document.createElement("div");
  modes.className = "guide-flow-branches";
  items.forEach((item, index) => {
    const mode = createSectionLink(item.id, "", "guide-flow-node guide-use-case-tone");
    mode.dataset.case = String(index + 1);
    mode.append(
      createTextElement("strong", "", `UC${index + 1} · ${item.modeLabel}`),
      createTextElement("span", "", item.title),
      createTextElement("span", "guide-flow-summary", item.summary),
    );
    modes.append(mode);
  });
  figure.append(modes, flowArrow(),
    createSectionLink("run-evaluation", diagram.run, "guide-flow-node guide-flow-run"),
    flowArrow(), createTextElement("p", "guide-flow-decision", diagram.decision));

  const outcomes = document.createElement("div");
  outcomes.className = "guide-flow-outcomes";
  const revision = document.createElement("div");
  revision.className = "guide-flow-outcome";
  revision.append(createTextElement("strong", "", diagram.no), flowArrow(),
    createSectionLink("feasibility", diagram.revise, "guide-flow-node guide-flow-revise"));
  const unresolved = document.createElement("div");
  unresolved.className = "guide-flow-outcome";
  unresolved.append(createTextElement("strong", "", diagram.unknown), flowArrow(),
    createSectionLink("resolve-feasibility", diagram.resolve, "guide-flow-node"),
    createTextElement("p", "guide-flow-impacts", diagram.unknownHint));
  const feasible = document.createElement("div");
  feasible.className = "guide-flow-outcome";
  feasible.append(createTextElement("strong", "", diagram.yes), flowArrow(),
    createSectionLink("yearly", diagram.yearly, "guide-flow-node"),
    createTextElement("p", "guide-flow-impacts", diagram.impacts), flowArrow(),
    createSectionLink("comparison", diagram.compare, "guide-flow-node"));
  outcomes.append(revision, unresolved, feasible);
  figure.append(outcomes);
  return figure;
};

const renderModeInstructions = (modes, quickStart) => {
  const options = document.createElement("ul");
  options.className = "guide-mode-options";
  modes.forEach((mode, index) => {
    const option = document.createElement("li");
    option.className = "guide-use-case guide-use-case-tone";
    option.dataset.case = String(index + 1);
    option.id = mode.id;
    const header = document.createElement("div");
    header.className = "guide-mode-header";
    header.append(createTextElement("h4", "", mode.modeLabel),
      createSectionLink("use-cases-workflow", quickStart.backToWorkflow));
    option.append(header, createTextElement("h5", "guide-mode-steps", quickStart.stepsLabel));
    const instructions = document.createElement("ol");
    for (const step of mode.instructions) instructions.append(createTextElement("li", "", step));
    const guidance = document.createElement("dl");
    guidance.className = "guide-mode-guidance";
    guidance.append(createTextElement("dt", "", quickStart.scopeLabel), createTextElement("dd", "", mode.scope),
      createTextElement("dt", "", quickStart.decisionLabel), createTextElement("dd", "", mode.decision));
    option.append(instructions, guidance);
    options.append(option);
  });
  return options;
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

const renderComparisonTable = ({ caption, columns, rows }) => {
  const table = document.createElement("table");
  table.className = "guide-comparison-table";
  table.createCaption().textContent = caption;
  const headings = table.createTHead().insertRow();
  for (const label of columns) {
    const th = createTextElement("th", "", label);
    th.scope = "col";
    headings.append(th);
  }
  const body = table.createTBody();
  for (const [label, ...values] of rows) {
    const row = body.insertRow();
    const th = createTextElement("th", "", label);
    th.scope = "row";
    row.append(th);
    for (const value of values) row.insertCell().textContent = value;
  }
  return table;
};

const renderSection = (section, ui, quickStart) => {
  const wrapper = document.createElement("section");
  wrapper.className = "guide-section";
  wrapper.id = section.id;

  const title = createTextElement("h2", "", section.title);
  title.id = `${section.id}-title`;
  if (section.id === "use-cases") {
    // Keep incoming links to the former workflow chapter at the Quick start heading.
    const workflow = createTextElement("span", "guide-workflow-alias", section.title);
    workflow.id = "workflow";
    title.replaceChildren(workflow);
  }
  wrapper.append(title);
  if (section.intro) {
    const intro = createTextElement("p", "guide-section-intro", section.intro);
    if (section.firstAccess) intro.append(" ", createSectionLink("registration", section.firstAccess));
    wrapper.append(intro);
  }

  if (section.id === "use-cases") {
    wrapper.append(renderWorkflowDiagram(section));
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
    if (item.text) entry.append(createTextElement("p", "", item.text));
    if (item.table) entry.append(renderComparisonTable(item.table));
    for (const paragraph of item.paragraphs ?? []) entry.append(createTextElement("p", "", paragraph));
    if (item.modes) entry.append(renderModeInstructions(item.modes, quickStart));
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
  renderNavigation(content.sections, content.ui);

  const sectionsRoot = document.querySelector("#guide-sections");
  const chapters = document.createDocumentFragment();
  const quickStart = content.sections.find(section => section.id === "use-cases");
  for (const section of content.sections) {
    const group = sectionGroupLabel(section.id, content.ui);
    if (group) chapters.append(createTextElement("p", "guide-chapter-group", group));
    chapters.append(renderSection(section, content.ui, quickStart));
  }
  sectionsRoot.replaceChildren(chapters);

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
