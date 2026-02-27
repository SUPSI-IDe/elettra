import { translations } from "./translations";

const STORAGE_KEY = "elettra_lang";
const DEFAULT_LANG = "en";

export const getCurrentLang = () => {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
};

export const setLanguage = (lang) => {
  if (translations[lang]) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
    updateLanguageSelector(lang);
  }
};

export const applyTranslations = (lang) => {
  const dict = translations[lang];
  if (!dict) return;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (dict[key]) el.setAttribute("aria-label", dict[key]);
  });
};

const updateLanguageSelector = (lang) => {
  const selector = document.querySelector(".language-select");
  if (selector) {
    selector.value = lang;
  }
};

export const t = (key, params = {}) => {
  const lang = getCurrentLang();
  let text = translations[lang]?.[key] || key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }

  return text;
};

export const initializeI18n = () => {
  const currentLang = getCurrentLang();

  // Set up selector
  const selector = document.querySelector(".language-select");
  if (selector) {
    selector.value = currentLang;
    selector.addEventListener("change", (e) => {
      setLanguage(e.target.value);
    });
  }

  // Initial translation
  applyTranslations(currentLang);
};
