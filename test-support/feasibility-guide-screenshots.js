export const guideLocales = ["en", "de", "fr", "it"];

export const feasibilityGuideLabels = {
  en: {
    bus: "Demo electric bus · 18 m",
    duty: "Demo morning duty",
    depot: "Demo depot",
    pairedEvaluation: "Demo weekday service",
    multiShiftEvaluation: "Multi-shift feasibility",
    morning: "Morning service",
    evening: "Evening service",
    chargingDepot: "Depot",
  },
  de: {
    bus: "Beispiel-Elektrobus · 18 m",
    duty: "Beispielumlauf am Morgen",
    depot: "Beispieldepot",
    pairedEvaluation: "Beispielbetrieb an Werktagen",
    multiShiftEvaluation: "Machbarkeit mehrerer Fahrzeugumläufe",
    morning: "Morgenumlauf",
    evening: "Abendumlauf",
    chargingDepot: "Depot",
  },
  fr: {
    bus: "Bus électrique 18 m (démo)",
    duty: "Service matinal (démo)",
    depot: "Dépôt démo",
    pairedEvaluation: "Service de démonstration en semaine",
    multiShiftEvaluation: "Faisabilité de plusieurs services véhicules",
    morning: "Service du matin",
    evening: "Service du soir",
    chargingDepot: "Dépôt",
  },
  it: {
    bus: "Autobus elettrico dimostrativo · 18 m",
    duty: "Turno del mattino",
    depot: "Deposito demo",
    pairedEvaluation: "Servizio feriale dimostrativo",
    multiShiftEvaluation: "Fattibilità di più turni macchina",
    morning: "Servizio del mattino",
    evening: "Servizio serale",
    chargingDepot: "Deposito",
  },
};

export const guideCaptureEnabled = (testInfo) =>
  process.env.UPDATE_GUIDE_SCREENSHOTS === "1" && testInfo.project.name === "chromium";

export const feasibilityGuideImage = (language, filename) => `guide/images/${language}/${filename}.png`;
