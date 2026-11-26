import { useCaseSections } from "./use-cases.js";

export const GUIDE_BASELINE_VERSION = "1.4.4";
export const GUIDE_BACKEND_BASELINE_VERSION = "1.9.0";
export const GUIDE_UPDATED_AT = "26 November 2026";

export const SUPPORTED_GUIDE_LANGUAGES = ["en", "de", "fr", "it"];

const referenceVersions = `Frontend v${GUIDE_BASELINE_VERSION} · Backend v${GUIDE_BACKEND_BASELINE_VERSION}`;

const publicApiLinks = [
  { href: "https://elettra.supsi.ch/docs", label: "Swagger UI (/docs)" },
  { href: "https://elettra.supsi.ch/openapi.json", label: "OpenAPI (/openapi.json)" },
];

const GUIDE_FIGURES = {
  shiftPlanner: {
    name: "shift-planner",
    sizes: { en: [2240, 2546], de: [2240, 2546], fr: [2240, 2546], it: [2240, 2594] },
    captions: {
      en: "After you add a trip, the planner suggests departures from the current terminus. Select the transfer option to include trips starting elsewhere.",
      de: "Nach einer Fahrt schlägt der Planer Abfahrten ab der aktuellen Endhaltestelle vor. Aktivieren Sie die Option für Leerfahrten, um Abfahrten ab anderen Haltestellen einzubeziehen.",
      fr: "Après l’ajout d’une course, le planificateur propose les départs du terminus actuel. Activez l’option de transfert à vide pour inclure les départs d’autres arrêts.",
      it: "Dopo una corsa, il planner propone le partenze dal capolinea attuale. Attivare l’opzione per i trasferimenti a vuoto per includere partenze da altre fermate.",
    },
  },
  busBattery: {
    name: "bus-model-battery",
    sizes: { en: [1260, 1334], de: [1260, 1353], fr: [1260, 1376], it: [1260, 1353] },
    captions: {
      en: "The bus model shows battery chemistry, minimum and maximum nominal capacity, and the price per kWh. Usable capacity is set in the feasibility study.",
      de: "Im Busmodell stehen die Batteriechemie, die minimale und maximale Nennkapazität und der Preis pro kWh. Die nutzbare Kapazität wird in der Machbarkeitsbewertung festgelegt.",
      fr: "La fiche du bus indique la chimie de la batterie, les capacités nominales minimale et maximale et le prix par kWh. La capacité utilisable se règle dans l’étude de faisabilité.",
      it: "La scheda del bus mostra la chimica, la capacità nominale minima e massima e il prezzo per kWh. La capacità utilizzabile si imposta nella fattibilità.",
    },
  },
  shiftComposer: {
    name: "shift-composer",
    sizes: { en: [2520, 1888], de: [2520, 1888], fr: [2520, 1888], it: [2520, 1888] },
    captions: {
      en: "The original vehicle-block editor, available when editing older records.",
      de: "Der ursprüngliche Fahrzeugumlauf-Editor zum Bearbeiten älterer Einträge.",
      fr: "L’éditeur d’origine des services voiture est disponible pour les enregistrements antérieurs.",
      it: "L’editor precedente dei turni macchina si apre in modifica per i turni storici."
    },
  },
  infeasibility: {
    name: "feasibility-infeasible",
    sizes: { en: [1100, 670], de: [1100, 670], fr: [1100, 670], it: [1100, 670] },
    captions: {
      en: "An infeasible fleet result: selected packs, physical maximum, estimated requirement and missing packs. Open a vehicle block for its diagnostic battery graphic; explanations are in the information tooltips.",
      de: "Nicht machbares Flottenergebnis: gewählte Packs, physisches Maximum, geschätzter Bedarf und fehlende Packs. Öffnen Sie einen Umlauf für die diagnostische Batteriegrafik; Erklärungen stehen in den Informationstooltips.",
      fr: "Résultat de flotte non faisable : packs choisis, maximum physique, besoin estimé et packs manquants. Ouvrez un service pour sa batterie diagnostique ; les explications figurent dans les infobulles.",
      it: "Risultato di flotta non fattibile: pacchi scelti, massimo fisico, fabbisogno stimato e pacchi mancanti. Aprire un turno per la batteria diagnostica; le spiegazioni sono nei tooltip informativi."
    },
  },

  shell: {
    name: "application-shell",
    sizes: { en: [1200, 1019], de: [1200, 1043], fr: [1200, 1064], it: [1200, 1040] },
    captions: {
      en: "The six Home cards open the fleet and simulation tools.",
      de: "Die sechs Kacheln auf der Startseite führen zu den Flotten- und Simulationswerkzeugen.",
      fr: "Les six cartes de l’accueil donnent accès aux outils de flotte et de simulation.",
      it: "Le sei schede della Home aprono gli strumenti di flotta e simulazione.",
    },
  },
  customStop: {
    name: "custom-stop",
    sizes: { en: [1360, 999], de: [1360, 999], fr: [1360, 999], it: [1360, 999] },
    captions: {
      en: "Edit the address and choose Search on map to locate the stop. Check the position before saving.",
      de: "Bearbeiten Sie die Adresse und wählen Sie die Kartensuche. Prüfen Sie die Position vor dem Speichern.",
      fr: "Modifiez l’adresse et lancez la recherche sur la carte. Vérifiez la position avant d’enregistrer.",
      it: "Modificare l’indirizzo e selezionare «Cerca sulla mappa». Verificare la posizione prima di salvare la fermata.",
    },
  },
  shift: {
    name: "shift-visualisation",
    sizes: { en: [2800, 2210], de: [2800, 2210], fr: [2800, 2210], it: [2800, 2210] },
    captions: {
      en: "Example vehicle block, 05:50–14:00. The bus runs six trips on line 1 (blue) and four on line 2 (mauve), changing lines at Stazione. The two dashed segments connect the depot.",
      de: "Beispielumlauf von 05:50 bis 14:00 Uhr. Der Bus fährt sechsmal auf Linie 1 (blau) und viermal auf Linie 2 (violett). An der Haltestelle Stazione wechselt er die Linie. Die beiden gestrichelten Abschnitte zeigen die Aus- und Einfahrt zum Depot.",
      fr: "Exemple de service voiture de 05:50 à 14:00. Le bus effectue six courses sur la ligne 1 (bleu) et quatre sur la ligne 2 (mauve). Il change de ligne à Stazione. Les deux trajets en pointillés relient le dépôt.",
      it: "Turno di esempio dalle 05:50 alle 14:00. Il bus effettua sei corse sulla linea 1 (blu) e quattro sulla linea 2 (malva), con cambio di linea a Stazione. I due tratti tratteggiati indicano l’uscita e il rientro in deposito.",
    },
  },
  feasibilityForm: {
    name: "feasibility-form",
    sizes: { en: [1500, 1467], de: [1500, 1467], fr: [1500, 1467], it: [1500, 1467] },
    captions: {
      en: "Choose the GTFS timetable and service day to see eligible vehicle blocks. The battery settings show state of health (SOH), usable capacity and its reference basis.",
      de: "Wählen Sie GTFS-Fahrplan und Verkehrstag, um die verfügbaren Fahrzeugumläufe zu sehen. Die Batterieeinstellungen zeigen den Gesundheitszustand (SOH), die nutzbare Kapazität und ihre Bezugsgrösse.",
      fr: "Choisissez l’horaire GTFS et le jour de service pour afficher les services voiture disponibles. Les paramètres de batterie indiquent l’état de santé (SOH), la capacité utilisable et sa base de référence.",
      it: "Scegliere l’orario GTFS e il giorno di servizio per vedere i turni disponibili. Le impostazioni della batteria mostrano lo stato di salute (SOH), la capacità utilizzabile e la sua base di riferimento.",
    },
  },
  feasibilityEfficiency: {
    name: "feasibility-efficiency",
    sizes: { en: [1120, 1017], de: [1120, 1107], fr: [1120, 1091], it: [1120, 1071] },
    captions: {
      en: "General shows the selected service day and the results for the active demand profile. Here Q95 is selected. The complete JSON download is next to Close.",
      de: "Allgemein zeigt den gewählten Verkehrstag und die Ergebnisse für das aktive Verbrauchsprofil. Hier ist Q95 ausgewählt. Neben Schliessen lässt sich das vollständige JSON herunterladen.",
      fr: "La vue Général indique le jour de service et les résultats du profil de consommation actif. Ici, Q95 est sélectionné. Le téléchargement JSON complet se trouve à côté de Fermer.",
      it: "La vista Generale indica il giorno di servizio e i risultati del profilo di consumo attivo. Qui è selezionato Q95. Il download del JSON completo è accanto a Chiudi.",
    },
  },
  feasibilitySizing: {
    name: "feasibility-sizing",
    sizes: { en: [1072, 870], de: [1072, 870], fr: [1072, 870], it: [1072, 870] },
    captions: {
      en: "The battery and energy margin for the Q95 design. The histogram marks aggregate Q95 demand at 539.2 kWh. The SOC chart shows how the depot charge changes the battery level during the duty.",
      de: "Batterie und Energiereserve der Q95-Auslegung. Das Histogramm markiert den aggregierten Q95-Verbrauch bei 539,2 kWh. Die SOC-Kurve zeigt, wie sich das Laden im Depot auf den Ladezustand während des Umlaufs auswirkt.",
      fr: "Batterie et marge énergétique du dimensionnement Q95. L’histogramme situe la consommation au Q95 agrégé à 539,2 kWh. La courbe de SOC montre l’effet de la recharge au dépôt pendant le service.",
      it: "Batteria e margine energetico del dimensionamento Q95. L’istogramma indica il Q95 aggregato del consumo, pari a 539,2 kWh. La curva del SOC mostra l’effetto della ricarica in deposito durante il turno.",
    },
  },
  comparison: {
    name: "annual-comparison",
    sizes: { en: [1310, 658], de: [1310, 639], fr: [1310, 658], it: [1310, 658] },
    captions: {
      en: "Choose A as the reference. Both examples cover the same two vehicle blocks. Read the compatibility checks before comparing the battery and charging alternatives.",
      de: "Wählen Sie A als Referenz. Beide Beispiele umfassen dieselben zwei Fahrzeugumläufe. Prüfen Sie die Vergleichbarkeit, bevor Sie Batterie- und Ladevarianten vergleichen.",
      fr: "Choisissez A comme référence. Les deux exemples couvrent les mêmes services voiture. Vérifiez la compatibilité avant de comparer les variantes de batterie et de recharge.",
      it: "Scegli A come riferimento. I due esempi comprendono gli stessi due turni macchina. Verifica la compatibilità prima di confrontare le alternative di batteria e ricarica.",
    },
  },
  yearlyTemperature: {
    name: "yearly-temperature",
    sizes: { en: [1460, 977], de: [1460, 1001], fr: [1460, 977], it: [1460, 977] },
    captions: {
      en: "Eight typical days for one vehicle block. The band shows the 5th to 95th percentiles of consumption. Switch between kWh/day and kWh/year to see how often each typical day occurs.",
      de: "Acht typische Tage für einen Fahrzeugumlauf. Das Band reicht vom 5. bis zum 95. Perzentil des Verbrauchs. Wechseln Sie zwischen kWh/Tag und kWh/Jahr, um den Einfluss der Häufigkeit zu sehen.",
      fr: "Huit journées types pour un service voiture. La bande s’étend du 5e au 95e percentile de la consommation. Passez des kWh/jour aux kWh/an pour voir l’effet du nombre d’occurrences.",
      it: "Otto giorni tipici per un turno macchina. La fascia va dal 5° al 95° percentile del consumo. Passa da kWh/giorno a kWh/anno per vedere quanto pesa la frequenza di ciascun giorno tipico.",
    },
  },
  yearlyEfficiency: {
    name: "yearly-efficiency",
    sizes: { en: [1382, 592], de: [1382, 592], fr: [1382, 592], it: [1382, 592] },
    captions: {
      en: "Equivalent annual cost includes operating costs and annualized investment (purple). Purchases and replacements are discounted, with a credit for the final residual value. The cumulative chart shows when those cash flows occur.",
      de: "Die jährlichen Äquivalenzkosten umfassen Betriebskosten und annualisierte Investitionen (violett). Anschaffungen und Ersatzinvestitionen werden abgezinst, der Restwert am Ende wird gutgeschrieben. Das kumulierte Diagramm zeigt den Zeitpunkt der Zahlungen.",
      fr: "Le coût annuel équivalent comprend les frais d’exploitation et l’investissement annualisé (violet). Les achats et les remplacements sont actualisés, avec déduction de la valeur résiduelle finale. Le graphique cumulé montre à quel moment ces flux interviennent.",
      it: "Il costo annuo equivalente comprende i costi operativi e l’investimento annualizzato (viola). Gli acquisti e le sostituzioni sono attualizzati, con un credito per il valore residuo finale. Il grafico cumulato mostra quando avvengono questi flussi.",
    },
  },
  yearlyEmissions: {
    name: "yearly-emissions",
    sizes: { en: [1440, 1026], de: [1440, 1026], fr: [1440, 1026], it: [1440, 1026] },
    captions: {
      en: "Fleet Emissions view with lifecycle-phase bars and the expandable activity and diesel-consumption controls below the charts.",
      de: "Emissionsansicht der Flotte mit Balken nach Lebenszyklusphase und den aufklappbaren Reglern für Fahrleistung und Dieselverbrauch unter den Diagrammen.",
      fr: "Vue Émissions de la flotte avec barres par phase du cycle de vie et réglages dépliables du kilométrage et de la consommation diesel sous les graphiques.",
      it: "Vista Emissioni della flotta con barre per fase del ciclo di vita e controlli espandibili di chilometraggi e consumo diesel sotto i grafici.",
    },
  },
};

const getGuideFigures = (language, ...keys) => keys.map(key => {
  const { name, captions, sizes } = GUIDE_FIGURES[key];
  const [width, height] = sizes[language];
  return {
    src: new URL(`./images/${language}/${name}.png`, import.meta.url).href,
    width,
    height,
    caption: captions[language],
  };
});

export const guideContent = {
  en: {
    ui: {
      operatingGuide: "Operating guide",
      references: "Reference",
      documentTitle: "ELETTRA user guide",
      backToApp: "Back to ELETTRA",
      languageAriaLabel: "Select language",
      print: "Print guide",
      contents: "Guide contents",
      eyebrow: "User documentation",
      title: "ELETTRA user guide",
      introduction:
        "A concise, task-oriented guide to preparing a bus service, checking technical feasibility and interpreting yearly energy, cost and environmental results.",
      baselineLabel: "Reference versions",
      baselineValue: referenceVersions,
      updatedLabel: "Guide updated",
      updatedValue: GUIDE_UPDATED_AT,
      footer:
        "ELETTRA supports pre-feasibility studies. Confirm final vehicle, charging, grid and infrastructure decisions through detailed engineering.",
      skipLink: "Skip to the guide",
      sidebarAriaLabel: "Guide contents",
      brandAriaLabel: "ELETTRA user guide",
      openImage: "Open full-size screenshot",
    },
    sections: [
      useCaseSections.en,
      {
        id: "fleet",
        title: "1. Bus models and custom stops",
        intro:
          "Reusable fleet and location records provide the technical inputs for vehicle blocks and evaluations.",
        items: [
          {
            title: "Bus models",
            text: "Open Fleet → Buses and choose Add to open Add Bus Model. Enter the actual length (9–13 m or 17–19 m) and verify the vehicle category assigned from it. New models start with LFP. Choose LFP or NMC. Verify passenger capacity, vehicle mass, pack limits, charging power, costs and lifetimes against operator or manufacturer data.",
          },
          { title: "Vehicle and battery estimates", text: "The vehicle price excludes batteries and uses tender prices by vehicle length, with extrapolation from 18 to 19 m. Pack price and mass depend on capacity and chemistry. Prices are in CHF excluding VAT. Manual overrides persist when related inputs change. Select Restore estimate to resume automatic estimates for a field. If estimates fail to load, enter the values manually." },
          {
            title: "Battery limits",
            text: "Enter positive whole numbers for the pack limits, with the minimum no higher than the maximum. Set both limits to the same count for a bus with one possible configuration. The form shows the nominal capacity range and the current pack price per kWh. Maximum charging power limits the power accepted by the bus. Set usable capacity in the feasibility evaluation.",
          },
          {
            title: "Custom stops",
            text: "Use custom stops for depots, charging locations and hubs outside the scheduled stop list. Open Fleet → Custom Stops and select Add. Enter a name, type (Depot, Charging or Hub), address and city. Use Search on map or move the map to place the crosshair. Check the position and the returned address. If geocoding fails, position the map manually and fill in the address and city yourself. Details opens a read-only view. Use Edit to complete missing fields in older custom stops.",
          },
          { title: "Duplicate models and custom stops", text: "Use Duplicate on the relevant row to open an editable copy. Names progress within the original name family: Line A_copy, Line A_copy_1, Line A_copy_2, and so on, including when copying a copy. ELETTRA uses the first available suffix across all list pages. The same rule applies to vehicle blocks, feasibility evaluations and yearly analyses. The proposed name remains editable." },
        ],
        figures: getGuideFigures("en", "busBattery", "customStop"),
        note: {
          title: "Before editing or deleting",
          text: "Reusable records may be referenced by vehicle blocks or analyses. Review dependent work before changing a record that has already been used.",
        },
      },
      {
        id: "shifts",
        title: "2. Building a vehicle block",
        intro: "A vehicle block is the complete duty of one bus. Use the sequential planner to build it from depot departure through service trips, empty transfers and stays to the return.",
        ordered: true,
        items: [
          { title: "Open Fleet → Vehicle blocks and create a vehicle block", text: "Choose Add to open the sequential planner." },
          { title: "Choose the GTFS timetable", text: "In Set up, select the service day and timetable edition. The newest available edition is selected initially. Both fields are locked while the programme contains activities and are saved with the block." },
          { title: "Define the vehicle block boundaries", text: "Select the starting depot and departure time. Enter 25:10 for 01:10 the next day. The programme displays this as 01:10 (+1). Linked Charging and Hub locations can be used for intermediate stays." },
          { title: "Filter and add scheduled trips", figures: getGuideFigures("en", "shiftPlanner"), text: "Choose a line under Next activity. After a trip, the planner suggests departures from the current terminus, including platforms grouped in the same GTFS station. Select Include trips that require driving empty to see other departures. Recheck the filter after changing line or terminus. Use Profile to compare stops, times, the map and elevation when available." },
          { title: "Confirm transfers and add trips", text: "Add a trip marked Direct connection in one click. For an empty transfer, check or adjust the suggested times and select Add activity. Published GTFS times are fixed. If the estimate is unavailable or longer than the available time, resolve the timing before using the block. A conflict such as arriving after the published departure blocks confirmation." },
          { title: "Add an intermediate stay", text: "Select Add depot stay, choose a custom stop, and set the arrival and departure times. Add another service trip or stay as needed." },
          { title: "Plan the return, review and save", text: "After at least one service trip, choose Plan return to depot to finish at the starting depot. Check the return times and select Add activity to confirm them. Resolve conflicts in Your working day, enter the name and bus model in Review & save, then choose Save vehicle block." },
          { title: "Edit the complete saved programme", text: "Edit reopens the sequential programme. Adjust a transfer, stay or return, or use Insert before to add an activity before an existing one. To extend a closed programme, insert the trip before the return. Undo last change restores the preceding programme. Save with Update vehicle block." },
          { title: "Edit older vehicle blocks", figures: getGuideFigures("en", "shiftComposer"), text: "Older blocks open in the original editor. Use Build the day to adjust trips. Select a service day before opening Manage intermediate stays. Changing a stay can add or exclude trips. Check both lists in the preview before choosing Apply to block or Cancel, then finish with Review & save." },
          {
            title: "Find or duplicate saved vehicle blocks",
            text: "Search queries the complete server-side list before pagination. Duplicate saves a copy immediately, with the bus model and, for sequential blocks, the complete programme, service day and GTFS edition. Use Edit on the saved copy to rename or change it. Names use the first available suffix (_copy, _copy_1, _copy_2) in the original name family. Use Delete on a row or select rows for batch deletion. If a dependent evaluation blocks deletion, check the message to see which blocks were kept.",
          },
          {
            title: "Visualise a saved vehicle block",
            text: "Select Visualize vehicle block to review general information and the recorded movements. The default Space-time view shows time horizontally and stops vertically. All lines share one diagram, with a consistent colour for each line. Dashed segments identify non-revenue movements. Switch to Map and use First, Previous, Next and Last to inspect movements including depot trips. The diagram marks gaps caused by missing transfer data and identifies the affected locations and times.",
          },
        ],
        figures: getGuideFigures("en", "shift"),
        note: {
          title: "Why the complete vehicle block matters",
          text: "Depot and transfer movements consume energy even when they do not carry passengers. Omitting them can make the technical assessment too optimistic.",
        },
      },
      {
        id: "feasibility",
        title: "3. Feasibility evaluation",
        intro:
          "The feasibility evaluation couples predicted energy demand with battery and charging decisions.",
        ordered: true,
        items: [
          {
            title: "Choose the GTFS timetable and vehicle blocks",
            text: "Open Simulations → Feasibility evaluation and create a new evaluation. Select one GTFS edition first; the table then shows only compatible vehicle blocks. Blocks that mix historical editions are excluded from new evaluations and changing the edition clears the current selection. Choose a service day to list blocks that run on that day in the selected edition. Changing the day removes any selected blocks that are incompatible with the new day.",
          },
          {
            title: "Choose an optimisation mode",
            modes: useCaseSections.en.items,
          },
          {
            title: "Set the scenario",
            text: "Review external temperature, occupancy, heating configuration, usable battery capacity and any advanced service parameters. Configure candidate charging locations when required by the selected mode. The bus-model choice follows the selected blocks and remains stable while other inputs are edited.",
          },
          { title: "Review the initial number of plugs", text: "New evaluations start with 1 plug per non-depot terminal candidate in Battery only, Charging and Joint modes. Depots instead use the number of selected vehicle blocks returning to each depot: N blocks represent N buses and initially N plugs at that depot. These are editable starting assumptions. Battery only uses the installed plug count; Charging and Joint use it as the maximum allowed. With default powers, one terminal plug has a 450 kW site limit; N depot plugs have a 150 × N kW site limit. Review plug counts and power before starting. Duplicated evaluations preserve their saved configuration." },
          { title: "Battery capacity and SOH", text: "Set SOH (default 70%), Usable capacity (50%) and Capacity reference (Residual or Initial). Only Initial shows editable Maximum residual usage (85%). SOC limits are calculated automatically; the short preview shows energy and the applied window, with explanations in tooltips. For 500 kWh, Residual gives 175 kWh at SOC 40–90%; Initial preserves 250 kWh at SOC 18.57–90%. Initial is incompatible if usable fraction / SOH exceeds maximum residual usage. The automatic preference is 90% with a default expansion range of 10–95%. A short warning appears below 20% applied minimum SOC without blocking. SOH changes capacity, not pack mass or cost. Duplicates preserve saved SOC bounds unless battery assumptions are edited." },
          { title: "Optional charging parameters", text: "This section is collapsed by default, like infrastructure costs. Open it to edit Connecting/disconnecting the bus (1 minute by default) and Delay allowance at terminals (0 minutes). Duplicates with nondefault timing open it automatically. Combined connection/disconnection time is deducted once per session, depots included: 5 minutes stopped − 1 technical minute = 4 available. The conservative terminal allowance excludes depots: 6 − 1 technical − 2 allowance = 3 available. It does not shift trips or propagate delays; changing it requires a new optimization." },
          {
            title: "Manage and duplicate saved evaluations",
            text: "Each row ends with View details, Rename, Duplicate and Delete icons; hover over or focus an icon to read its action. Duplicate opens the evaluation form directly, without selecting the row or using a top-level Duplicate button. ELETTRA restores its blocks, bus model, battery references, SOC limits, charging constraints and costs, forecast settings and solver options, and proposes an editable name ending in _copy, _copy_1, _copy_2, etc., without repeating the suffix. Duplication is cancelled rather than submitting a partial copy when original resources or compatible forecasts are unavailable. Use the row Delete icon for one evaluation or select multiple rows and use the top Delete action for a batch.",
          },
          { id: "run-evaluation", title: "Calculate Mean and Aggregate Q95 together", text: "In Bus model and optimization mode, Mean and Q95 explains what will be calculated. Select Start evaluation, check the blocks and mode, then confirm in the dialog. The progress dialog tracks consumption estimates, Mean and Q95 separately. When both runs finish, ELETTRA opens Mean if it completed, or the completed Q95 result if Mean failed. If both fail, the list shows the failure count.", links: [{ href: "#mean-q95", label: "How to read Mean and Q95" }] },
          {
            title: "Read the verdict before other indicators",
            text: "A completed solver run can still be physically infeasible when the required battery exceeds the vehicle limit. Check the verdict and required-versus-available packs first.",
          },
        ],
        figures: getGuideFigures("en", "feasibilityForm"),
        note: {
          title: "Conservative sizing",
          text: "Use a demanding but plausible scenario for the technical gate. Representative annual operation is assessed separately in the yearly analysis.",
        },
      },
      {
        id: "results",
        title: "4. Interpreting feasibility results",
        intro: "Use General for the fleet summary and shared infrastructure, then check the battery and charging plan of each vehicle block.",
        items: [
          { id: "mean-q95", title: "How to use Mean and Aggregate Q95", text: "In General, use Show optimized result beside the tabs to switch between Mean and Q95. Mean sizes for expected consumption under the chosen conditions. Q95 sizes for a representative high-consumption profile. Compare the verdict, battery packs and shared chargers, then open the same vehicle block in both designs to compare charging, the lowest SOC reached and the margin above the configured minimum. Switching loads a complete saved design without starting another calculation and keeps the current tab. If the requested result is pending, failed or unavailable, the current design stays visible and a message explains why." },
          {
            title: "Start with General",
            text: "For a feasible design, General summarizes all analyzed vehicle blocks and the largest selected battery. Each vehicle block retains its own selected battery; all vehicle blocks participate in sizing and share the charging infrastructure. The compact GTFS disclosure in the header shows the edition recorded when the evaluation was created; historical results without a snapshot are explicitly derived from current block data.",
          },
          {
            title: "Check every vehicle block tab",
            text: "For a physically verified vehicle block, the summary shows the active Mean or Q95 consumption and specific consumption, plus the minimum and maximum SOC actually reached. These reached values are outcomes, while Configured SOC window identifies the applied limits in the evaluation. Read them with nominal and usable capacity, selected packs, planned charging and the verified trajectory. SOC percentages refer to residual capacity. The battery assumptions show initial, residual and usable capacity and the applied SOC window; usable kWh = initial kWh × SOH × (applied maximum SOC − applied minimum SOC). At 500 kWh and SOH 70%, residual capacity is 350 kWh: SOC 40–90% gives 175 kWh usable, while constant initial usable energy gives 250 kWh at 18.57–90%. A warning concerns only an applied minimum below 20%, distinct from the lowest SOC reached. Forecast and energy tables use the same SOH and applied window.",
          },
          { title: "Read total demand and check the SOC limits", text: "In a vehicle block’s Battery and energy margin, the histogram counts simulated sequences by their total consumption at the selected battery mass, before subtracting any recharge. In each Monte Carlo sequence, the model draws consumption independently for each trip occurrence, including repeat trips, then sums the draws. The vertical line marks the active basis. Q95 is the threshold reached or undercut by roughly 95% of simulated totals. ELETTRA uses a representative sequence at that total, rather than adding each trip’s Q95. Check the adjacent SOC curve against the two configured limits. The path between trip endpoints is a linear approximation. The 95% describes modeled energy totals. The SOC tooltip can separately show the share of simulated trajectories that complete this block within the SOC limits for the selected plan. In the Q95 example, the 62.5 kWh depot charge helps cover demand of 539.2 kWh and the lowest SOC of 153.3 kWh stays 13.3 kWh above the 140 kWh limit." },
          { title: "Inspect the charging plan and depot recharge", text: "Open Charging plan and check each session’s location, time and day offset. Read Planned stop, Available for charging and Energy charged, then open Charging details for technical time, terminal delay allowance, active and idle time, and average power. A connected bus holds its plug during the full stop. Battery only can also schedule sessions within the installed limits. If the evaluation checked next-day departure, use Daily cycle and depot charging to compare departure SOC with the target. In an infeasible result, open Identified constraints next to the verdict or block status for the available depot findings. A daytime-only diagnostic can identify shortfalls but does not establish an overnight schedule." },
          {
            title: "Open More information when needed",
            text: "Charging plan and More information are expandable white cards. Use them for sessions, prediction details, operating assumptions, configured SOC limits and supporting values. For a verified design, the forecast for the selected battery appears directly before the initial physical-maximum reference. Use the forecast roles and pack counts to identify the one that verified the final design.",
          },
          { id: "resolve-feasibility", title: "Distinguish infeasible, failed and unavailable", text: "An infeasible result establishes a technical constraint under the selected assumptions, such as battery capacity or charger access. A pending run is still calculating. A failed, timed-out or unavailable result provides no verified verdict for that profile. When General shows vehicle block outcomes for a result marked Not determined, open the affected block and follow How to resolve. One invalid block can prevent the others from being evaluated. An orange paired feasibility verdict means that one profile is feasible and the other infeasible. Read the label to see which one passed." },
          { title: "Read infeasible battery estimates", text: "For an established infeasible result, General shows the affected vehicle blocks with selected packs, installable maximum, estimated required packs and missing packs relative to the selected battery. Red requirements exceed the physical maximum; — means unavailable, not zero. Open a block name to inspect its battery graphic. Diagnostic or virtual packs describe a shortfall, not a verified installable battery. A diagnostic may exclude recharge before the next departure: the absence of a battery shortfall does not certify a feasible complete daily cycle. Diagnostic SOC and charging plans are not shown as verified operation; physically feasible blocks retain their operational detail." },
          { title: "Interpret missing Q95 consumption", text: "A technically infeasible Q95 result can still contain consumption values. If the saved diagnostic has no aggregate Q95 consumption, the cell shows N/A with a tooltip and the specific consumption is shown as —. Both indicate a missing value. Trip-level quantiles are not combined to fill the gap." },
          { title: "Find contextual help", text: "Use the information icons beside the outcome, battery estimate, colour legend and estimated/missing-pack headings for constraints and diagnostic scope. Fleet evaluation, Batteries and bus investment, Charging infrastructure for the selected vehicle blocks and Charging infrastructure investment by site also have tooltips. Open them by hover, keyboard focus or tap; Escape closes them. The demand scenario, optimization mode and outcome share the fleet header." },
          {"title": "Inspect raw feasibility data", "text": "View raw feasibility data is always available at the top right of the page, in place of the close icon, in both General and vehicle-block views. It opens the saved inputs and supporting configuration in a dialog; close the dialog to return to the result. The compact SOH, Technical times, HVAC assumptions and GTFS timetable cards in the header open the corresponding saved assumptions."},
          {"title": "Export the complete feasibility evaluation", "text": "In General, choose Download all results (JSON) at the bottom of the results, next to Close, as in yearly analysis. The schema 1 file includes all vehicle blocks and the available Mean and Aggregate Q95 designs, regardless of the profile displayed when you click. Each design preserves its configuration, investments, SOC limits, charging plan, forecast IDs and recorded provenance. Infrastructure is counted once per design; Mean and Q95 are alternatives whose investments must not be added. The download reads saved calculations without starting a new optimization."},
          {"title": "Check export availability", "text": "Collection keeps the context captured at the click. Missing forecasts or unavailable, pending or failed profiles are explicitly reported in a partial file; download again to retry loading. A partial file does not prove infeasibility, and diagnostic results are not verified charging plans. Historical defaults and current-price fallbacks remain labelled. Complete HVAC reproduction inputs require the separate HVAC download. Annual costs and emissions belong to the yearly-analysis export."},
        ],
        figures: getGuideFigures("en", "feasibilityEfficiency", "feasibilitySizing", "infeasibility"),
      },
      {
        id: "yearly",
        title: "5. Yearly analysis",
        intro:
          "A yearly analysis keeps the feasible bus and charging design fixed. General assesses the fleet or a representative bus group; each vehicle block shows its own annual efficiency.",
        ordered: true,
        items: [
          {
            title: "Create an analysis from an eligible evaluation",
            text: "Open Simulations → Yearly analyses → New. Enter a Name, choose a completed, feasible evaluation eligible for yearly analysis under Simulation, and set Average passengers on board (%). A saved pack count is required. If eligible Mean and Aggregate Q95 variants are both available, select the intended design. The evaluation supplies the vehicle blocks, batteries, charging design and recorded GTFS edition.",
          },
          {
            title: "Manage and duplicate saved yearly analyses",
            text: "Each row ends with View details, Rename, Duplicate and Delete icons. Duplicate opens a new-analysis form prefilled with the source feasibility evaluation and occupancy, and proposes an editable name ending in _copy, _copy_1, _copy_2, etc., without repeating the suffix; review the inherited inputs before starting it. Use the row Delete icon for one analysis or select multiple rows and use the top Delete action for a batch.",
          },
          {
            title: "Review the inherited inputs",
            text: "Check the vehicle blocks, optimization mode, sizing temperature, packs and capacities. ELETTRA selects the weather reference depot automatically. The read-only Temperature scenarios show representative daytime temperatures (05:00–24:00) and occurrences in days/year. The form warns when the total differs from 365, and zero days prevent starting. Choose Run yearly analysis, check the block count, scenario count and depot, then choose Start analysis. Every scenario runs for all inherited blocks and the results open automatically.",
          },
          {
            title: "Start with General",
            text: "Annual fleet assessment shows annual distance, bus-side DC energy, purchased grid electricity, block consumption in kWh/km, electric TCO and climate impact. Min and Max identify the blocks with the lowest and highest average consumption. Use Representative bus / Fleet to see the complete fleet or values per bus for a group sharing the same model and battery size. Each block retains its feasibility assignment. Grid electricity is calculated from bus-side energy at 94% charging efficiency. Min and Max identify the lowest and highest average kWh/km on separate lines, with the name of each vehicle block.",
          },
          {
            title: "Review Costs and Emissions for the fleet",
            text: "Costs shows a TCO row, equivalent annual cost, cumulative discounted costs and break-even. The purple segment shows annualized investment, including replacements and the final residual-value credit. Bus and battery investment belongs in full to the physical buses in scope. In the current fleet assessment, shared charging infrastructure counts once for the fleet and is allocated by physical bus count, with an equal share per representative bus. Emissions shows lifecycle-phase bars, environmental indicators and the Activity and diesel consumption controls. Mileage and relevant physical assumptions are shared and save automatically. The feasibility design and simulated block results retain their original inputs.",
          },
          {
            title: "Select a vehicle block",
            text: "Open a named vehicle-block tab to see its simulated annual energy, distance and consumption. The first chart shows specific consumption in kWh/km by temperature. On the contribution chart, choose kWh/day for the representative day or kWh/year for its contribution weighted by occurrences. For example, 100 kWh/day for 40 days/year contributes 4,000 kWh/year. In the Efficiency view, expand More information for scenario and battery details.",
          },
          { title: "Read the Q05–Q95 consumption range", text: "Monte Carlo sampling draws each trip independently, including trips across blocks, and sums the trips in scope before computing Q05, Q50 and Q95. The central 90% range is for one representative day per temperature scenario. kWh/km divides the sampled totals by the distance in scope. kWh/year scales the same range by the cluster’s day count. The annual total is a point estimate. When a scenario range is unavailable, its point estimate remains visible." },
          {
            title: "Check weather and HVAC provenance",
            text: "The compact GTFS and HVAC disclosures identify the saved timetable and auxiliary-energy policy. Yearly HVAC uses hourly PVGIS GHI in the local GTFS timezone and reports trip and terminal energy; the traceability section and JSON actions expose the assumptions and complete reproduction inputs. Read the recorded provenance to identify the GTFS edition used at feasibility. For older records, check whether the edition was reconstructed from the current vehicle blocks.",
          },
          {
            title: "Inspect the configuration and export from General",
            text: "View configuration data opens the frozen design. Choose Download all results (JSON) in General, next to Close. The schema 4 export includes the complete fleet, all representative groups and available blocks regardless of the selected group. It preserves provenance, scenario results, uncertainty and forecast IDs where recorded, plus effective assumptions and edited activity separately from the simulated baseline. Historical analyses without the frozen fleet investment snapshot retain schema 3. Where those reports show separate costs per block, they can allocate shared infrastructure by annual DC energy.",
          },
          {
            title: "Check the save status before closing",
            text: "The complete JSON describes the current assessment and reports whether its assumptions have been saved. Pending or failed saves remain explicit in the file. Close waits for saving; a failed save or invalid input keeps the page open so you can correct the value or retry saving before reopening the analysis.",
          },
          {
            title: "Download current environmental results",
            text: "The separate download in Emissions follows the selected fleet or representative-bus scope. It is enabled only when the current assessment is ready. During an update or after a failure, the complete JSON labels any previous response separately from current results. Use Retry after a failed refresh. Vehicle blocks refer to their representative group's environmental assessment; the export does not invent independent per-block impacts.",
          },
          {
            title: "Recognise aggregate-only historical results",
            text: "An older analysis that contains no per-vehicle block breakdown can show General only. ELETTRA leaves unavailable vehicle block details absent instead of inventing them from aggregate totals.",
          },
          {"title": "Set charging infrastructure maintenance", "text": "In Costs → Edit economic assumptions → Additional economic parameters, choose a percentage of charging investment per year or a fixed amount in CHF/year. The percentage is editable: 2%/year is the default, with the INFRAS 2026 reference range of 2–5%. It is not CHF 2/year. Check the saved method and units, especially for historical analyses; a fixed amount of zero means no infrastructure maintenance cost is included. The percentage applies to the full charging investment and maintenance is counted once per fleet, excluding buses and batteries; the tooltip explains this modelling assumption."},
          {"title": "Read the calculation boundaries", "text": "In Edit economic assumptions, check electricity price in CHF/kWh of grid electricity, diesel price in CHF/l, diesel consumption in l/km, bus maintenance in CHF/km and annual km per bus. Additional economic parameters shows years for the horizon and lifetimes, discount rate in percent, and diesel purchase price in CHF/bus. Calculation method and boundaries explains the common electric/diesel mileage, horizon and discount rate and the treatment of residual value."},
        ],
        figures: getGuideFigures("en", "yearlyTemperature", "yearlyEfficiency", "yearlyEmissions"),
        note: {
          title: "Do not resize the vehicle here",
          text: "Yearly analysis represents operation of the design selected at the feasibility gate. Return to feasibility evaluation if the vehicle, battery or charging design must change.",
        },
      },
      {
        id: "comparison",
        title: "6. Comparing and exporting analyses",
        intro:
          "Comparison is most useful when alternatives differ by one clearly identified decision or assumption.",
        items: [
          {
            title: "Select two yearly analyses",
            text: "Open Simulations → Analysis comparison and choose Analysis A and Analysis B from your saved analyses. Compatible means the same non-empty set of vehicle blocks and the same optimization mode. A shared block, equal block count or matching mode can give Partially comparable. The badge is advisory, and the comparison shows the available results.",
          },
          {
            title: "Compare consistent indicators",
            text: "Overview, Efficiency, Cost and Emissions compare General results. The absolute difference is B − A. Relative differences use A as the denominator and require a non-zero A. Compare distance, GTFS edition, weather and assessment assumptions. Efficiency uses saved simulation totals. Cost uses the comparison’s annual cost calculation, and Emissions uses a fleet assessment. For a comparison of edited mileage or tariffs, use matching scopes and fields from the two complete yearly JSON exports.",
          },
          {
            title: "Export evidence",
            text: "In Details / Export, choose Export CSV for A/B values, differences and completeness, or Export JSON for the General models, compatibility checks and metric rows. For fleet groups, technical vehicle-block results, effective assumptions and detailed project costs, open a source yearly analysis and choose Download all results (JSON) in General.",
          },
        ],
        figures: getGuideFigures("en", "comparison"),
        note: {
          title: "Name scenarios clearly",
          text: "Include the principal difference in each saved name, for example the vehicle, heating configuration, occupancy assumption or charging strategy.",
        },
      },
      {
        id: "start",
        title: "Account, language and navigation",
        intro:
          "The guide is public, but fleet data and analyses require an ELETTRA account.",
        items: [
          {
            id: "registration",
            title: "Sign in or create an account",
            text: "During registration, choose the operator from the suggestions. After creating your account, sign in to open Home. During registration, the CARTO preview uses the latest available GTFS edition and shows every drawable line with its number to help confirm the company. The map is indicative and its routes are simplified, so it should not be used as a detailed network reference.",
          },
          {
            title: "Choose the interface language",
            text: "Use the language selector in the application header. English, German, French and Italian are available, and the preference is retained in the browser.",
          },
          {
            title: "Use the main navigation",
            text: "Home explains the planning workflow and links to all six working sections. Fleet contains Buses, Custom Stops and Vehicle blocks. Simulations contains Feasibility evaluation, Yearly analyses and Analysis comparison; the user guide remains at the bottom of the sidebar. Each Home card opens a tool. Its separate Read the guide link opens that tool’s chapter in a new tab.",
          },
        ],
        figures: getGuideFigures("en", "shell"),
      },
      {
        id: "practice",
        title: "Assumptions, limits and good practice",
        intro:
          "The quality of a pre-feasibility result depends on the quality and consistency of its assumptions.",
        items: [
          {
            title: "Replace defaults when evidence is available",
            text: "Use operator, manufacturer, tariff and infrastructure information where possible. Record the source and date outside ELETTRA when the value is important for a decision.",
          },
          {
            title: "Separate technical and annual questions",
            text: "Use feasibility evaluation for the demanding technical condition and yearly analysis for representative annual energy, costs and emissions.",
          },
          {
            title: "Compare like with like",
            text: "Keep service scope, annual distance and boundary assumptions consistent when comparing alternatives. Use the compatibility warnings provided by the application.",
          },
          {
            title: "Escalate before implementation",
            text: "Use ELETTRA to identify promising configurations and sensitive assumptions. Confirm procurement, electrical-grid, charger, depot, civil-work and operational decisions through the corresponding specialist studies.",
          },
        ],
        note: {
          title: "Assessment boundary",
          text: "ELETTRA is a planning and pre-feasibility tool. A feasible result is conditional on the selected service, vehicle, weather, occupancy, battery and charging assumptions; it is not an operational certificate.",
        },
      },
      {
        id: "api",
        title: "Public API",
        items: [
          {
            id: "api-docs",
            title: "Explore the public API documentation",
            text: "Open /docs on the ELETTRA server to browse endpoints, parameters and responses in Swagger UI. The OpenAPI schema is available at /openapi.json. You can read both without signing in. Protected operations require an authorised account. The links below open the public ELETTRA service.",
            links: publicApiLinks,
          },
        ],
      },
    ],
  },

  de: {
    ui: {
      operatingGuide: "Bedienungsanleitung",
      references: "Zum Nachschlagen",
      documentTitle: "ELETTRA-Benutzerhandbuch",
      backToApp: "Zurück zu ELETTRA",
      languageAriaLabel: "Sprache auswählen",
      print: "Handbuch drucken",
      contents: "Inhalt des Handbuchs",
      eyebrow: "Benutzerdokumentation",
      title: "ELETTRA-Benutzerhandbuch",
      introduction:
        "Ein kompaktes, aufgabenorientiertes Handbuch zur Vorbereitung eines Busbetriebs, zur Prüfung der technischen Machbarkeit und zur Interpretation der jährlichen Energie-, Kosten- und Umweltergebnisse.",
      baselineLabel: "Referenzversionen",
      baselineValue: referenceVersions,
      updatedLabel: "Handbuch aktualisiert",
      updatedValue: "26. November 2026",
      footer:
        "ELETTRA unterstützt Vorstudien. Endgültige Fahrzeug-, Lade-, Netz- und Infrastrukturentscheidungen müssen durch eine detaillierte Fachplanung bestätigt werden.",
      skipLink: "Zum Handbuch springen",
      sidebarAriaLabel: "Inhalt des Handbuchs",
      brandAriaLabel: "ELETTRA-Benutzerhandbuch",
      openImage: "Screenshot in voller Grösse öffnen",
    },
    sections: [
      useCaseSections.de,
      {
        id: "fleet",
        title: "1. Busmodelle und benutzerdefinierte Haltestellen",
        intro: "Wiederverwendbare Fahrzeug- und Ortsdaten liefern die technischen Eingaben für Fahrzeugumläufe und Bewertungen.",
        items: [
          { title: "Busmodelle", text: "Öffnen Sie Flotte → Busse und wählen Sie Hinzufügen, um Busmodell hinzufügen zu öffnen. Geben Sie die tatsächliche Länge ein (9–13 m oder 17–19 m) und prüfen Sie die daraus abgeleitete Fahrzeugkategorie. Bei neuen Modellen ist LFP voreingestellt. Wählen Sie LFP oder NMC. Prüfen Sie Fahrgastkapazität, Fahrzeugmasse, Batteriegrenzen, Ladeleistung, Kosten und Lebensdauern anhand der Betreiber- oder Herstellerdaten." },
          { title: "Schätzwerte für Fahrzeug und Batterie", text: "Der Fahrzeugpreis ohne Batterien beruht auf Ausschreibungspreisen je nach Länge und wird von 18 bis 19 m extrapoliert. Preis und Masse pro Pack hängen von Kapazität und Chemie ab. Die Preise sind in CHF exkl. MWST angegeben. Manuell eingegebene Werte bleiben bei Änderungen der zugehörigen Eingaben erhalten. Schätzwert wiederherstellen aktiviert die automatische Schätzung für das Feld erneut. Falls die Schätzwerte nicht geladen werden, geben Sie die Werte selbst ein." },
          { title: "Batteriegrenzen", text: "Geben Sie positive ganze Packzahlen ein. Das Minimum darf das Maximum nicht überschreiten. Für einen Bus mit nur einer möglichen Konfiguration setzen Sie beide Grenzen gleich. Das Formular zeigt den Nennkapazitätsbereich und den aktuellen Packpreis pro kWh. Die maximale Ladeleistung begrenzt die vom Bus aufnehmbare Leistung. Die nutzbare Kapazität wird in der Machbarkeitsbewertung festgelegt." },
          { title: "Benutzerdefinierte Haltestellen", text: "Erfassen Sie hier Depots, Ladestationen und Knotenpunkte, die nicht in der Liste der Fahrplanhaltestellen stehen. Öffnen Sie Flotte → Individuelle Haltestellen und wählen Sie Hinzufügen. Geben Sie Name, Typ (Depot, Ladestation oder Knotenpunkt), Adresse und Stadt ein. Wählen Sie Auf Karte suchen oder verschieben Sie die Karte, um das Fadenkreuz zu positionieren. Prüfen Sie Position und ermittelte Adresse. Falls die Adresssuche fehlschlägt, positionieren Sie die Karte und tragen Sie Adresse und Stadt von Hand ein. Details öffnet eine schreibgeschützte Ansicht. Ergänzen Sie fehlende Angaben älterer Haltestellen unter Bearbeiten." },
          { title: "Modelle und individuelle Haltestellen duplizieren", text: "Duplizieren in der jeweiligen Zeile öffnet eine editierbare Kopie. Namen werden innerhalb der ursprünglichen Namensfamilie fortlaufend vergeben: Linie A_Kopie, Linie A_Kopie_1, Linie A_Kopie_2 usw., auch beim Kopieren einer Kopie. ELETTRA verwendet die erste freie Endung über alle Listenseiten hinweg. Dieselbe Regel gilt für Fahrzeugumläufe, Machbarkeitsbewertungen und Jahresanalysen. Der vorgeschlagene Name bleibt editierbar." },
        ],
        figures: getGuideFigures("de", "busBattery", "customStop"),
        note: { title: "Vor Bearbeiten oder Löschen", text: "Wiederverwendbare Datensätze können von Fahrzeugumläufen oder Analysen referenziert werden. Prüfen Sie abhängige Arbeiten, bevor Sie einen bereits verwendeten Datensatz ändern." },
      },
      {
        id: "shifts",
        title: "2. Fahrzeugumlauf aufbauen",
        intro: "Ein Fahrzeugumlauf umfasst den vollständigen Tagesdienst eines Busses. Der sequenzielle Planer führt von der Depotabfahrt über Linienfahrten, Leerfahrten und Aufenthalte bis zur Rückkehr.",
        ordered: true,
        items: [
          { title: "Flotte → Fahrzeugumläufe öffnen und Fahrzeugumlauf erstellen", text: "Wählen Sie Hinzufügen, um den sequenziellen Planer zu öffnen." },
          { title: "GTFS-Fahrplan wählen", text: "Wählen Sie unter Einrichten den Verkehrstag und die GTFS-Ausgabe. Die neueste verfügbare Ausgabe ist vorausgewählt. Beide Felder sind gesperrt, solange das Programm Aktivitäten enthält, und werden mit dem Umlauf gespeichert." },
          { title: "Grenzen des Fahrzeugumlaufs festlegen", text: "Wählen Sie Startdepot und Abfahrtszeit. Geben Sie 25:10 für 01:10 am Folgetag ein. Das Programm zeigt dafür 01:10 (+1). Verknüpfte Ladestationen und Knotenpunkte können als Zwischenaufenthalt dienen." },
          { title: "Fahrplanfahrten filtern und hinzufügen", figures: getGuideFigures("de", "shiftPlanner"), text: "Wählen Sie unter Nächste Aktivität eine Linie. Nach einer Fahrt schlägt der Planer Abfahrten von der aktuellen Endhaltestelle vor, einschliesslich Haltepositionen derselben GTFS-Station. Wählen Sie Fahrten mit vorheriger Leerfahrt einbeziehen für weitere Abfahrten. Prüfen Sie den Filter nach einem Linien- oder Endhaltestellenwechsel erneut. Profil zeigt Haltestellen, Zeiten, Karte und gegebenenfalls das Höhenprofil." },
          { title: "Überführungen bestätigen und Fahrten hinzufügen", text: "Fügen Sie einen direkten Anschluss mit einem Klick hinzu. Prüfen oder ändern Sie bei einer Leerfahrt die vorgeschlagenen Zeiten und wählen Sie Aktivität hinzufügen. Die GTFS-Zeiten bleiben fest. Klären Sie die Zeiten vor der Nutzung, falls die Schätzung fehlt oder die verfügbare Zeit überschreitet. Eine Ankunft nach der planmässigen Abfahrt blockiert die Bestätigung." },
          { title: "Zwischenaufenthalt hinzufügen", text: "Wählen Sie Depotaufenthalt hinzufügen, eine individuelle Haltestelle sowie Ankunft und Abfahrt. Fügen Sie anschliessend bei Bedarf weitere Fahrten oder Aufenthalte hinzu." },
          { title: "Rückkehr planen, prüfen und speichern", text: "Wählen Sie nach mindestens einer Linienfahrt Rückkehr zum Depot planen, um den Umlauf am Startdepot abzuschliessen. Prüfen Sie die Rückkehrzeiten und bestätigen Sie sie mit Aktivität hinzufügen. Beheben Sie Konflikte in Ihr Tagesprogramm, geben Sie unter Prüfen & speichern Name und Busmodell ein und wählen Sie Fahrzeugumlauf speichern." },
          { title: "Das vollständige gespeicherte Programm bearbeiten", text: "Bearbeiten öffnet das sequenzielle Tagesprogramm. Passen Sie eine Überführung, einen Aufenthalt oder die Rückkehr an oder nutzen Sie Davor einfügen. Um einen abgeschlossenen Umlauf zu verlängern, fügen Sie die Fahrt vor der Rückkehr ein. Letzte Änderung rückgängig machen stellt das vorherige Programm wieder her. Speichern Sie mit Fahrzeugumlauf aktualisieren." },
          { title: "Ältere Fahrzeugumläufe bearbeiten", figures: getGuideFigures("de", "shiftComposer"), text: "Ältere Umläufe öffnen sich im ursprünglichen Editor. Passen Sie Fahrten unter Tag zusammenstellen an. Wählen Sie einen Verkehrstag, bevor Sie Zwischenaufenthalte bearbeiten öffnen. Eine Änderung kann Fahrten hinzufügen oder ausschliessen. Prüfen Sie beide Listen in der Vorschau, wählen Sie In Umlauf übernehmen oder Abbrechen und speichern Sie unter Prüfen & speichern." },
          { title: "Gespeicherte Fahrzeugumläufe finden oder duplizieren", text: "Die Suche erfasst die vollständige serverseitige Liste vor der Seiteneinteilung. Duplizieren speichert sofort eine Kopie mit dem Busmodell und bei sequenziellen Umläufen auch mit vollständigem Programm, Verkehrstag und GTFS-Ausgabe. Wählen Sie Bearbeiten in der Zeile der Kopie, um sie umzubenennen oder zu ändern. Der Name erhält die erste freie Endung der ursprünglichen Familie (_Kopie, _Kopie_1, _Kopie_2). Löschen ist einzeln oder für mehrere ausgewählte Umläufe möglich. Falls eine abhängige Bewertung das Löschen blockiert, zeigt die Meldung, welche Umläufe erhalten bleiben." },
          { title: "Gespeicherten Fahrzeugumlauf visualisieren", text: "Wählen Sie Fahrzeugumlauf visualisieren für die allgemeinen Informationen und die aufgezeichneten Bewegungen. Die Standardansicht Weg-Zeit zeigt die Zeit waagrecht und die Haltestellen senkrecht. Alle Linien teilen sich ein Diagramm und haben je eine feste Farbe. Gestrichelte Abschnitte kennzeichnen Leerfahrten. In Karte prüfen Sie mit Erste, Zurück, Weiter und Letzte jede Fahrt einschliesslich der Depotfahrten. Fehlende Überführungsdaten erscheinen als Lücke mit den betroffenen Orten und Zeiten." },
        ],
        figures: getGuideFigures("de", "shift"),
        note: { title: "Warum der vollständige Fahrzeugumlauf wichtig ist", text: "Depot- und Überführungsfahrten benötigen Energie, auch wenn keine Fahrgäste befördert werden. Ihr Weglassen kann die Bewertung zu optimistisch machen." },
      },
      {
        id: "feasibility",
        title: "3. Machbarkeitsbewertung",
        intro: "Die Machbarkeitsbewertung verbindet den prognostizierten Energiebedarf mit Batterie- und Ladeentscheidungen.",
        ordered: true,
        items: [
          { title: "GTFS-Fahrplan und Fahrzeugumläufe auswählen", text: "Öffnen Sie Simulationen → Machbarkeitsbewertung und erstellen Sie eine neue Bewertung. Wählen Sie zuerst eine GTFS-Ausgabe; die Tabelle zeigt danach nur kompatible Fahrzeugumläufe. Historische Umläufe mit gemischten Ausgaben sind für neue Bewertungen ausgeschlossen, und ein Ausgabenwechsel leert die aktuelle Auswahl. Wählen Sie einen Verkehrstag, um die an diesem Tag in der gewählten Ausgabe verkehrenden Umläufe anzuzeigen. Beim Tageswechsel entfallen unpassende Umläufe aus der Auswahl." },
          { title: "Optimierungsmodus wählen", modes: useCaseSections.de.items },
          { title: "Szenario festlegen", text: "Prüfen Sie Aussentemperatur, Belegung, Heizung, nutzbare Batteriekapazität und erweiterte Betriebsparameter. Konfigurieren Sie bei Bedarf mögliche Ladeorte. Die Busmodellauswahl folgt den gewählten Umläufen und bleibt beim Bearbeiten anderer Eingaben stabil." },
          { title: "Anfängliche Anzahl der Ladepunkte prüfen", text: "Neue Bewertungen beginnen in Nur Batterie, Laden und Gemeinsam mit 1 Ladepunkt je Endhaltestelle ausserhalb eines Depots. Für Depots gilt stattdessen die Anzahl der ausgewählten Fahrzeugumläufe, die zum jeweiligen Depot zurückkehren: N Umläufe entsprechen N Bussen und zunächst N Ladepunkten in diesem Depot. Diese Ausgangswerte sind editierbar. Nur Batterie verwendet die installierte Anzahl; Laden und Gemeinsam die zulässige Höchstzahl. Bei Standardleistung beträgt die Standortgrenze 450 kW für einen Endhaltestellen-Ladepunkt und 150 × N kW für N Depot-Ladepunkte. Prüfen Sie Anzahl und Leistung vor dem Start. Duplizierte Bewertungen behalten ihre gespeicherte Konfiguration." },
          { title: "Batteriekapazität und SOH", text: "Stellen Sie SOH (Standard 70%), Nutzbare Kapazität (50%) und Kapazitätsbezug (Rest- oder Anfangskapazität) ein. Nur bei Anfangskapazität ist die maximale Nutzung der Restkapazität (85%) sichtbar und editierbar. SOC-Grenzen werden automatisch berechnet; die kurze Vorschau zeigt Energie und angewendetes Fenster, Tooltips erklären die Eingaben. Bei 500 kWh ergibt Restkapazität 175 kWh bei SOC 40–90%; Anfangskapazität erhält 250 kWh bei SOC 18,57–90%. Nutzbarer Anteil / SOH darf die maximale Nutzung der Restkapazität nicht überschreiten. Bevorzugt werden 90%, mit einem Standard-Erweiterungsbereich von 10–95%. Unter 20% angewendetem minimalem SOC erscheint ein kurzer Hinweis ohne Sperre. SOH verändert Kapazität, weder Packmasse noch Kosten. Kopien behalten gespeicherte SOC-Grenzen, solange die Batterieannahmen nicht bearbeitet werden." },
          { title: "Optionale Ladeparameter", text: "Dieser Abschnitt ist wie die Infrastrukturkosten standardmässig eingeklappt. Öffnen Sie ihn für Bus anschliessen und trennen (Standard 1 Minute) und Verspätungspuffer an Endhaltestellen (0 Minuten). Kopien mit abweichenden Zeitwerten öffnen ihn automatisch. Die Gesamtzeit für Anschliessen/Trennen wird einmal pro Ladevorgang abgezogen, auch im Depot: 5 Minuten Halt − 1 technische Minute = 4 Minuten verfügbar. Der konservative Puffer gilt nicht im Depot: 6 − 1 technisch − 2 Puffer = 3 Minuten verfügbar. Er verschiebt keine Fahrten und schreibt keine Verspätungen fort; Änderungen erfordern eine neue Optimierung." },
          { title: "Gespeicherte Bewertungen verwalten und duplizieren", text: "Am rechten Ende jeder Zeile stehen die Symbole Details anzeigen, Umbenennen, Duplizieren und Löschen; beim Darüberfahren oder Fokussieren wird die Aktion erklärt. Duplizieren öffnet das Bewertungsformular direkt, ohne Zeilenauswahl und ohne obere Schaltfläche Duplizieren. ELETTRA übernimmt Fahrzeugumläufe, Busmodell, Batteriereferenzen, SOC-Grenzen, Ladebedingungen und -kosten, Prognose- und Solveroptionen und schlägt einen editierbaren Namen mit den Endungen _Kopie, _Kopie_1, _Kopie_2 usw. ohne wiederholte Endung vor. Fehlen Originalressourcen oder kompatible Prognosen, wird die Kopie abgebrochen statt unvollständig gesendet. Löschen Sie eine Bewertung über das Zeilensymbol oder mehrere ausgewählte Bewertungen über die obere Aktion Löschen." },
          { id: "run-evaluation", title: "Mittelwert und aggregiertes Q95 gemeinsam berechnen", text: "Die Angabe Mittelwert und Q95 unter Busmodell und Optimierungsmodus zeigt, was berechnet wird. Wählen Sie Bewertung starten, prüfen Sie Umläufe und Modus und bestätigen Sie im Dialog. Die Fortschrittsanzeige verfolgt Verbrauchsschätzungen, Mittelwert und Q95 getrennt. Nach Abschluss beider Berechnungen öffnet ELETTRA das Mittelwertergebnis, bei dessen Fehlschlag das abgeschlossene Q95-Ergebnis. Schlagen beide fehl, zeigt die Liste die Anzahl fehlgeschlagener Berechnungen.", links: [{ href: "#mean-q95", label: "Mittelwert und Q95 verstehen" }] },
          { title: "Urteil vor anderen Indikatoren lesen", text: "Ein erfolgreich beendeter Solverlauf kann physisch nicht machbar sein, wenn die erforderliche Batterie das Fahrzeuglimit überschreitet. Prüfen Sie zuerst Urteil und erforderliche gegenüber verfügbaren Packs." },
        ],
        figures: getGuideFigures("de", "feasibilityForm"),
        note: { title: "Konservative Dimensionierung", text: "Verwenden Sie für den technischen Entscheidungspunkt ein anspruchsvolles, aber plausibles Szenario. Der repräsentative Jahresbetrieb wird separat bewertet." },
      },
      {
        id: "results",
        title: "4. Machbarkeitsergebnisse interpretieren",
        intro: "Allgemein zeigt die Flottenübersicht; prüfen Sie danach Batterie und Ladeplan jedes Fahrzeugumlaufs.",
        items: [
          { id: "mean-q95", title: "Mittelwert und aggregiertes Q95 verwenden", text: "Wechseln Sie in Allgemein über Optimiertes Ergebnis anzeigen neben den Registerkarten zwischen Mittelwert und Q95. Der Mittelwert dimensioniert für den erwarteten Verbrauch unter den gewählten Bedingungen. Q95 dimensioniert für ein repräsentatives Profil mit hohem Verbrauch. Vergleichen Sie Machbarkeitsurteil, Batteriepakete und gemeinsam genutzte Ladepunkte. Öffnen Sie danach in beiden Auslegungen denselben Fahrzeugumlauf und vergleichen Sie Ladeplan, tiefsten erreichten SOC und Abstand zur festgelegten SOC-Untergrenze. Der Wechsel lädt die vollständige gespeicherte Auslegung ohne neue Berechnung und lässt die Registerkarte geöffnet. Bei einem laufenden, fehlgeschlagenen oder nicht verfügbaren Ergebnis bleibt die bisherige Auslegung sichtbar und ein Hinweis erklärt den Grund." },
          { title: "Mit Allgemein beginnen", text: "Bei einem machbaren Design: Allgemein fasst alle analysierten Fahrzeugumläufe und die grösste gewählte Batterie zusammen. Jeder Umlauf behält seine eigene Batterie; alle nehmen an der Dimensionierung teil und teilen die Ladeinfrastruktur. Die kompakte GTFS-Angabe im Kopf zeigt die bei Erstellung aufgezeichnete Ausgabe; bei historischen Ergebnissen ohne Snapshot wird die Herkunft ausdrücklich aus den aktuellen Umlaufdaten abgeleitet." },
          { title: "Jeden Fahrzeugumlauf prüfen", text: "Für einen physisch verifizierten Fahrzeugumlauf: Die Zusammenfassung zeigt den aktiven Mittelwert- oder Q95-Verbrauch, den spezifischen Verbrauch sowie den tatsächlich erreichten minimalen und maximalen SOC. Diese Werte sind Ergebnisse; Konfiguriertes SOC-Fenster bezeichnet die angewendeten Grenzen. Lesen Sie sie zusammen mit Batterie, geplanten Ladevorgängen und verifiziertem SOC-Verlauf. SOC-Prozentwerte beziehen sich auf die Restkapazität. Die Batterieannahmen zeigen Anfangs-, Rest- und nutzbare Kapazität sowie das angewendete SOC-Fenster; nutzbare kWh = anfängliche kWh × SOH × (angewendeter maximaler SOC − angewendeter minimaler SOC). Bei 500 kWh und SOH 70% verbleiben 350 kWh: SOC 40–90% ergibt 175 kWh nutzbare Energie; konstante anfänglich nutzbare Energie ergibt 250 kWh bei 18,57–90%. Der Hinweis betrifft nur einen angewendeten minimalen SOC unter 20%, getrennt vom niedrigsten erreichten SOC. Prognose- und Energietabellen verwenden denselben SOH und dasselbe angewendete Fenster." },
          { title: "Gesamtverbrauch ablesen und SOC-Grenzen prüfen", text: "In Batterie und Energiereserve zählt das Histogramm die simulierten Sequenzen nach Gesamtverbrauch bei der gewählten Batteriemasse. Geladene Energie bleibt separat. In jeder Monte-Carlo-Sequenz zieht das Modell den Verbrauch jeder Fahrt unabhängig, auch bei wiederholten Fahrten, und summiert die Werte pro Umlauf. Die senkrechte Linie markiert die aktive Basis. Rund 95 % der simulierten Summen liegen höchstens bei Q95. ELETTRA verwendet eine repräsentative Sequenz mit diesem Gesamtverbrauch. Eine Summe einzelner Fahrtquantile hätte eine andere Bedeutung. Prüfen Sie die SOC-Kurve anhand der beiden konfigurierten Grenzen. Zwischen Abfahrt und Ankunft ist die Kurve linear angenähert. Die 95 % beziehen sich auf modellierte Verbrauchssummen. Der SOC-Tooltip kann separat den Anteil der simulierten Verläufe zeigen, die den Umlauf mit dem gewählten Ladeplan innerhalb der SOC-Grenzen abschliessen. Im Q95-Beispiel helfen 62,5 kWh Depotladung, den Bedarf von 539,2 kWh zu decken. Der niedrigste SOC von 153,3 kWh liegt 13,3 kWh über der Untergrenze von 140 kWh." },
          { title: "Ladeplan und Depotladung prüfen", text: "Öffnen Sie Ladeplan und prüfen Sie Ort, Zeit und Tagesversatz jedes Vorgangs. Lesen Sie Geplanter Halt, Zum Laden verfügbar und Geladene Energie. Ladedetails nennt technische Zeit, Verspätungspuffer, aktive und inaktive Ladezeit sowie mittlere Leistung. Ein angeschlossener Bus belegt den Ladepunkt während des gesamten Halts. Auch Nur Batterie kann Ladevorgänge innerhalb der installierten Infrastruktur planen. Wurde die Abfahrt am Folgetag geprüft, vergleichen Sie unter Tageszyklus und Depotladung den SOC bei Abfahrt mit dem Zielwert. Öffnen Sie bei einem nicht machbaren Ergebnis Ermittelte Einschränkungen neben dem Urteil oder Umlaufstatus für den verfügbaren Befund zum Depot. Eine Diagnose nur für den Tagesbetrieb kann Engpässe zeigen, liefert aber keinen Nachtladeplan." },
          { title: "Bei Bedarf Weitere Informationen öffnen", text: "Ladeplan und Weitere Informationen sind aufklappbare weisse Karten. Sie enthalten Ladevorgänge, Prognosedetails, Betriebsannahmen, konfigurierte SOC-Grenzen und unterstützende Werte. Bei einer verifizierten Auslegung steht die Prognose für die gewählte Batterie direkt vor der anfänglichen Referenz am physischen Maximum. Rolle und Anzahl der Pakete zeigen, mit welcher Prognose die endgültige Auslegung verifiziert wurde." },
          { id: "resolve-feasibility", title: "Nicht machbar, fehlgeschlagen und nicht verfügbar unterscheiden", text: "Bei einem nicht machbaren Ergebnis ist unter den gewählten Annahmen eine technische Grenze festgestellt worden, etwa Batteriekapazität oder Ladezugang. Laufende Berechnungen sind noch offen. Fehlschlag, Zeitüberschreitung oder fehlendes Ergebnis liefern für das jeweilige Profil kein verifiziertes Urteil. Wenn Allgemein bei Nicht bestimmt die Ergebnisse je Fahrzeugumlauf zeigt, öffnen Sie den betroffenen Umlauf und folgen Sie So beheben Sie das Problem. Ein ungültiger Umlauf kann die Prüfung der übrigen blockieren. Ein oranges Machbarkeitsurteil für das Paar bedeutet, dass ein Profil machbar und das andere nicht machbar ist. Die Beschriftung zeigt, welches Profil bestanden hat." },
          { title: "Batterieschätzungen bei Nichtmachbarkeit lesen", text: "Bei nachgewiesener Nichtmachbarkeit zeigt Allgemein die betroffenen Fahrzeugumläufe mit gewählten Packs, installierbarem Maximum, geschätztem Bedarf und fehlenden Packs gegenüber der gewählten Batterie. Rote Bedarfswerte überschreiten das physische Maximum; — bedeutet nicht verfügbar, nicht null. Über den Umlaufnamen öffnen Sie die Batteriegrafik. Diagnostische oder virtuelle Packs beschreiben eine Unterdeckung, keine verifizierte installierbare Batterie. Eine Diagnose kann das Nachladen vor der nächsten Abfahrt ausschliessen: Das Fehlen einer Batterieunterdeckung bestätigt noch keinen machbaren vollständigen Tageszyklus. Diagnostische SOC- und Ladepläne werden nicht als verifizierter Betrieb gezeigt; physisch machbare Umläufe behalten ihre Betriebsdetails." },
          { title: "Fehlenden Q95-Verbrauch einordnen", text: "Auch ein technisch nicht machbares Q95-Ergebnis kann Verbrauchswerte enthalten. Fehlt im gespeicherten Diagnoseergebnis der aggregierte Q95-Verbrauch, zeigt die Verbrauchszelle N/A mit einem Tooltip und der spezifische Verbrauch erscheint als —. Beides steht für einen fehlenden Wert. Einzelne Fahrtquantile werden dafür nicht addiert." },
          { title: "Kontexthilfe finden", text: "Informationssymbole neben Ergebnis, Batterieschätzung, Farblegende und Spalten für geschätzte oder fehlende Packs erläutern Einschränkungen und Diagnoseumfang. Auch Flottenbewertung, Batterien und Businvestition, Ladeinfrastruktur der gewählten Fahrzeugumläufe und Ladeinfrastrukturinvestition je Standort haben Tooltips. Öffnen Sie diese per Maus, Tastaturfokus oder Antippen; Escape schliesst sie. Nachfrageszenario, Optimierungsmodus und Ergebnis stehen gemeinsam im Flottenkopf." },
          {"title": "Rohdaten der Machbarkeit prüfen", "text": "Rohdaten der Machbarkeitsbewertung anzeigen steht oben rechts anstelle des Schliessen-Symbols zur Verfügung, sowohl unter Allgemein als auch bei jedem Fahrzeugumlauf. Die Schaltfläche öffnet gespeicherte Eingaben und Konfigurationsdetails in einem Dialog; schliessen Sie ihn, um zum Ergebnis zurückzukehren. Die kompakten Karten für SOH, technische Zeiten, HVAC-Annahmen und GTFS-Fahrplan im Kopf öffnen die jeweiligen gespeicherten Annahmen."},
          {"title": "Die vollständige Machbarkeitsbewertung exportieren", "text": "Wählen Sie unter Allgemein unten bei den Ergebnissen neben Schliessen Alle Ergebnisse herunterladen (JSON), wie in der Jahresanalyse. Die Datei mit Schema 1 enthält alle Fahrzeugumläufe und die verfügbaren Entwürfe für Mean und Aggregate Q95, unabhängig vom beim Klick angezeigten Profil. Jeder Entwurf bewahrt Konfiguration, Investitionen, SOC-Grenzen, Ladeplan, Prognose-IDs und gespeicherte Herkunft. Infrastruktur wird einmal pro Entwurf gezählt; Mean und Q95 sind Alternativen, deren Investitionen nicht addiert werden dürfen. Der Download liest gespeicherte Berechnungen, ohne eine neue Optimierung zu starten."},
          {"title": "Verfügbarkeit des Exports prüfen", "text": "Das Zusammenstellen behält den beim Klick erfassten Kontext bei. Fehlende Prognosen sowie nicht verfügbare, ausstehende oder fehlgeschlagene Profile werden in einer unvollständigen Datei ausdrücklich ausgewiesen; laden Sie erneut herunter, um das Laden zu wiederholen. Eine unvollständige Datei beweist keine Nichtmachbarkeit; diagnostische Ergebnisse sind keine verifizierten Ladepläne. Historische Standardwerte und ersatzweise aktuelle Preise bleiben gekennzeichnet. Vollständige HVAC-Reproduktionseingaben benötigen den separaten HVAC-Download. Jährliche Kosten und Emissionen gehören zum Export der Jahresanalyse."},
        ],
        figures: getGuideFigures("de", "feasibilityEfficiency", "feasibilitySizing", "infeasibility"),
      },
      {
        id: "yearly",
        title: "5. Jahresanalyse",
        intro: "Die Jahresanalyse hält die machbare Bus- und Ladeauslegung fest. Allgemein bewertet die Flotte oder eine repräsentative Busgruppe; jeder Fahrzeugumlauf zeigt seine eigene Jahreseffizienz.",
        ordered: true,
        items: [
          { title: "Analyse aus einer geeigneten Bewertung erstellen", text: "Öffnen Sie Simulationen → Jahresanalysen → Neu. Geben Sie einen Namen ein, wählen Sie unter Simulation eine abgeschlossene, machbare und geeignete Bewertung mit gespeicherter Paketanzahl und legen Sie Durchschnittliche Fahrgäste an Bord (%) fest. Sind Mean und aggregiertes Q95 verfügbar und geeignet, wählen Sie die gewünschte Variante. Die Bewertung liefert Fahrzeugumläufe, Batterien, Ladeauslegung und die gespeicherte GTFS-Ausgabe." },
          { title: "Gespeicherte Jahresanalysen verwalten und duplizieren", text: "Am rechten Ende jeder Zeile stehen die Symbole Details anzeigen, Umbenennen, Duplizieren und Löschen. Duplizieren öffnet ein neues Analyseformular mit der übernommenen Machbarkeitsbewertung und Belegung und schlägt einen editierbaren Namen mit den Endungen _Kopie, _Kopie_1, _Kopie_2 usw. ohne wiederholte Endung vor; prüfen Sie die übernommenen Eingaben vor dem Start. Löschen Sie eine Analyse über das Zeilensymbol oder mehrere ausgewählte Analysen über die obere Aktion Löschen." },
          { title: "Übernommene Eingaben prüfen", text: "Prüfen Sie Fahrzeugumläufe, Optimierungsmodus, Auslegungstemperatur, Pakete und Kapazitäten. ELETTRA wählt das Wetterreferenzdepot automatisch. Die schreibgeschützten Temperaturszenarien zeigen die repräsentative Tagestemperatur (05:00–24:00) und die Häufigkeit in Tagen pro Jahr. Bei einer Summe ungleich 365 erscheint ein Hinweis. Bei null Tagen ist kein Start möglich. Wählen Sie Jahresanalyse starten, prüfen Sie die Anzahl Umläufe und Szenarien sowie das Depot und wählen Sie Analyse starten. Jedes Szenario gilt für alle übernommenen Umläufe. Die Ergebnisse öffnen sich automatisch." },
          { title: "Mit Allgemein beginnen", text: "Die jährliche Flottenanalyse zeigt Jahresdistanz, DC-Energie am Bus, bezogenen Netzstrom, Umlaufverbrauch in kWh/km, Elektro-TCO und Klimawirkung. Min und Max nennen die Umläufe mit dem niedrigsten und höchsten mittleren Verbrauch. Mit Repräsentativer Bus / Flotte wählen Sie die ganze Flotte oder Werte je Bus einer Gruppe mit gleichem Modell und gleicher Batteriegrösse. Die Umlaufzuweisungen bleiben bestehen. Der Netzstrom ergibt sich aus der DC-Energie bei 94 % Ladewirkungsgrad. Min und Max nennen auf getrennten Zeilen den niedrigsten und höchsten mittleren Verbrauch in kWh/km mit dem Namen des jeweiligen Umlaufs." },
          { title: "Kosten und Emissionen der Flotte prüfen", text: "Kosten zeigt TCO, jährliche äquivalente Gesamtkosten, kumulierte diskontierte Kosten und Kostengleichheit. Der violette Anteil zeigt die annualisierte Investition einschliesslich Ersatz und Restwertgutschrift. Die Investitionen für Busse und Batterien gehören vollständig zu den physischen Fahrzeugen im gewählten Bereich. In der aktuellen Flottenanalyse wird gemeinsame Ladeinfrastruktur einmal pro Flotte gezählt und nach Anzahl physischer Busse zugeordnet, mit einem gleichen Anteil je repräsentativem Bus. Emissionen zeigt Lebenszyklusphasen, Umweltindikatoren sowie Fahrleistung und Dieselverbrauch. Diese und die relevanten physischen Annahmen werden gemeinsam verwendet und automatisch gespeichert. Die technische Auslegung und simulierten Umlaufergebnisse behalten ihre ursprünglichen Eingaben." },
          { title: "Einen Fahrzeugumlauf auswählen", text: "Wählen Sie einen benannten Fahrzeugumlauf für seine simulierte Jahresenergie, Distanz und den Verbrauch. Das erste Diagramm zeigt kWh/km nach Temperatur. Wählen Sie im Beitragsdiagramm kWh/Tag für den repräsentativen Tag oder kWh/Jahr für seinen nach Häufigkeit gewichteten Beitrag. 100 kWh/Tag an 40 Tagen/Jahr entsprechen beispielsweise 4 000 kWh/Jahr. Öffnen Sie in Effizienz Weitere Informationen für Szenario- und Batterieangaben." },
          { title: "Die Verbrauchsspanne Q05–Q95 lesen", text: "Die Monte-Carlo-Simulation zieht den Verbrauch jeder Fahrt unabhängig, auch bei mehreren Umläufen, und summiert die erfassten Fahrten vor der Berechnung von Q05, Q50 und Q95. Die mittleren 90 % gelten für einen repräsentativen Tag je Temperaturszenario. Für kWh/km wird durch die Fahrleistung desselben Bereichs geteilt. Für kWh/Jahr wird die Spanne mit der Anzahl Clustertage multipliziert. Die Jahressumme ist eine Punktschätzung. Szenarien ohne Intervall zeigen weiterhin ihre Punktschätzung." },
          { title: "Wetter- und HVAC-Herkunft prüfen", text: "Die kompakten GTFS- und HVAC-Angaben nennen Fahrplan und gespeicherte Nebenverbrauchspolitik. Die Jahresanalyse verwendet stündliche PVGIS-GHI in der lokalen GTFS-Zeitzone und weist HVAC-Energie während Fahrt und Endaufenthalt aus; Nachvollziehbarkeit und JSON-Aktionen liefern Annahmen und vollständige Reproduktionseingaben. Die aufgezeichnete Herkunft nennt die GTFS-Ausgabe der Machbarkeitsbewertung. Prüfen Sie bei älteren Einträgen, ob die Ausgabe aus den heutigen Umlaufdaten abgeleitet wurde." },
          { title: "Konfiguration prüfen und unter Allgemein exportieren", text: "Konfigurationsdaten anzeigen öffnet die festgeschriebene Auslegung. Wählen Sie unter Allgemein neben Schliessen Alle Ergebnisse herunterladen (JSON). Schema 4 enthält die gesamte Flotte, alle repräsentativen Gruppen und die verfügbaren Umläufe unabhängig von der ausgewählten Gruppe. Die Datei speichert Herkunft, Szenarioergebnisse, Unsicherheit und Prognose-IDs soweit vorhanden sowie wirksame Annahmen und geänderte Aktivität getrennt von der ursprünglichen Simulation. Ältere Analysen ohne festgeschriebene Flotteninvestitionen behalten Schema 3. Wenn diese Berichte Kosten je Umlauf zeigen, können sie gemeinsame Infrastruktur nach jährlicher DC-Energie zuordnen." },
          { title: "Speicherstatus vor dem Schliessen prüfen", text: "Die vollständige JSON-Datei beschreibt die aktuelle Bewertung und zeigt, ob ihre Annahmen gespeichert sind. Ausstehende oder fehlgeschlagene Speichervorgänge bleiben in der Datei erkennbar. Schliessen wartet auf das Speichern; ein Speicherfehler oder eine ungültige Eingabe lässt die Seite offen. Korrigieren Sie den Wert oder wiederholen Sie das Speichern, bevor Sie die Analyse erneut öffnen." },
          { title: "Aktuelle Umweltergebnisse herunterladen", text: "Der separate Download unter Emissionen folgt dem ausgewählten Bereich: Flotte oder repräsentativer Bus. Er ist erst verfügbar, wenn die aktuelle Bewertung bereit ist. Während einer Aktualisierung oder nach einem Fehler kennzeichnet die vollständige JSON-Datei eine frühere Antwort getrennt von aktuellen Ergebnissen. Nutzen Sie Erneut versuchen nach einem Aktualisierungsfehler. Fahrzeugumläufe verweisen auf die Umweltbewertung ihrer repräsentativen Gruppe; der Export erfindet keine unabhängigen Umweltwirkungen je Umlauf." },
          { title: "Nur aggregierte historische Ergebnisse erkennen", text: "Eine ältere Analyse ohne Aufschlüsselung nach Fahrzeugumläufen kann nur Allgemein anzeigen. ELETTRA lässt nicht verfügbare Fahrzeugumlaufdetails weg, statt sie aus Gesamtsummen zu erfinden." },
          {"title": "Wartung der Ladeinfrastruktur einstellen", "text": "Unter Kosten → Wirtschaftliche Annahmen bearbeiten → Weitere wirtschaftliche Parameter wählen Sie einen jährlichen Prozentsatz der Ladeinvestition oder einen Festbetrag in CHF/Jahr. Der Prozentsatz ist editierbar: Standard sind 2%/Jahr, mit dem INFRAS-2026-Richtbereich von 2–5%. Das bedeutet nicht CHF 2/Jahr. Prüfen Sie gespeicherte Methode und Einheiten, besonders bei älteren Analysen; ein Festbetrag von null berücksichtigt keine Infrastrukturwartung. Die Prozentmethode bezieht sich auf die gesamte Ladeinvestition; Wartung wird einmal pro Flotte gezählt, ohne Busse und Batterien. Der Tooltip erklärt diese Modellannahme."},
          {"title": "Berechnungsgrenzen lesen", "text": "Unter Wirtschaftliche Annahmen bearbeiten finden Sie Strompreis in CHF/kWh Netzstrom, Dieselpreis in CHF/l, Dieselverbrauch in l/km, Buswartung in CHF/km und Jahreskilometer je Bus. Weitere wirtschaftliche Parameter zeigt Analysezeitraum und Lebensdauer in Jahren, Diskontsatz in Prozent und Diesel-Kaufpreis in CHF/Bus. Berechnungsmethode und Abgrenzung erläutert gemeinsame Fahrleistung, Zeitraum und Diskontsatz für beide Antriebe sowie den Restwert."},
        ],
        figures: getGuideFigures("de", "yearlyTemperature", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Fahrzeug hier nicht neu dimensionieren", text: "Die Jahresanalyse beschreibt den Betrieb des an der Machbarkeitsschwelle gewählten Designs. Kehren Sie zur Machbarkeitsbewertung zurück, wenn Fahrzeug, Batterie oder Laden geändert werden sollen." },
      },
      {
        id: "comparison",
        title: "6. Analysen vergleichen und exportieren",
        intro: "Ein Vergleich ist besonders aussagekräftig, wenn sich die Alternativen in einer klar benannten Entscheidung oder Annahme unterscheiden.",
        items: [
          { title: "Zwei Jahresanalysen auswählen", text: "Öffnen Sie Simulationen → Analysenvergleich und wählen Sie Analyse A und Analyse B. Kompatibel bedeutet dieselbe nicht leere Menge an Fahrzeugumläufen und denselben Optimierungsmodus. Ein gemeinsamer Umlauf, die gleiche Anzahl oder der gleiche Modus können zu Teilweise vergleichbar führen. Das Label dient der Einordnung. Die verfügbaren Kennzahlen bleiben sichtbar." },
          { title: "Konsistente Indikatoren vergleichen", text: "Übersicht, Effizienz, Kosten und Emissionen vergleichen Allgemein. Die absolute Differenz ist B − A. Prozentwerte beziehen sich auf A und brauchen einen Wert ungleich null. Prüfen Sie Distanz, GTFS-Ausgabe, Wetter und Annahmen. Effizienz verwendet gespeicherte Simulationssummen. Kosten verwenden die Jahreskostenberechnung des Vergleichs, und Emissionen stützen sich auf eine Flottenbewertung. Für geänderte Tarife oder Jahreskilometer vergleichen Sie dieselben Bereiche und Felder in den vollständigen JSON-Dateien beider Jahresanalysen." },
          { title: "Nachweise exportieren", text: "Unter Details / Export liefert CSV exportieren A/B-Werte, Differenzen und Vollständigkeitsangaben. JSON exportieren enthält die Modelle für Allgemein, Kompatibilitätsprüfungen und Kennzahlen. Flottengruppen, technische Umlaufergebnisse, wirksame Annahmen und detaillierte Projektkosten erhalten Sie über Alle Ergebnisse herunterladen (JSON) unter Allgemein der jeweiligen Jahresanalyse." },
        ],
        figures: getGuideFigures("de", "comparison"),
        note: { title: "Szenarien eindeutig benennen", text: "Nehmen Sie den wichtigsten Unterschied in den Namen auf, beispielsweise Fahrzeug, Heizung, Belegung oder Ladestrategie." },
      },
      {
        id: "start",
        title: "Konto, Sprache und Navigation",
        intro:
          "Das Handbuch ist öffentlich zugänglich; Flottendaten und Analysen erfordern jedoch ein ELETTRA-Konto.",
        items: [
          {
            id: "registration",
            title: "Anmelden oder Konto erstellen",
            text: "Wählen Sie bei der Registrierung das Transportunternehmen aus der Vorschlagsliste. Melden Sie sich nach der Registrierung an, um die Startseite zu öffnen. Bei der Registrierung verwendet die CARTO-Vorschau die neueste verfügbare GTFS-Ausgabe und zeigt alle darstellbaren Linien mit ihren Nummern, um die Auswahl zu bestätigen. Die Karte dient nur zur Orientierung und stellt die Linien vereinfacht dar; sie ist keine detaillierte Netzreferenz.",
          },
          {
            title: "Sprache der Benutzeroberfläche wählen",
            text: "Verwenden Sie die Sprachauswahl in der Kopfzeile der Anwendung. Englisch, Deutsch, Französisch und Italienisch stehen zur Verfügung; die Auswahl wird im Browser gespeichert.",
          },
          {
            title: "Hauptnavigation verwenden",
            text: "Die Startseite erklärt den Planungsablauf und verlinkt alle sechs Arbeitsbereiche. Unter Flotte finden Sie Busse, Individuelle Haltestellen und Fahrzeugumläufe, unter Simulationen Machbarkeitsbewertung, Jahresanalysen und Analysenvergleich; das Benutzerhandbuch bleibt unten in der Seitenleiste erreichbar. Jede Kachel öffnet den Arbeitsbereich. Über Handbuch lesen gelangen Sie in einem neuen Tab direkt zum passenden Kapitel.",
          },
        ],
        figures: getGuideFigures("de", "shell"),
      },
      {
        id: "practice",
        title: "Annahmen, Grenzen und gute Praxis",
        intro: "Die Qualität einer Vorstudie hängt von der Qualität und Konsistenz ihrer Annahmen ab.",
        items: [
          { title: "Standardwerte durch Nachweise ersetzen", text: "Verwenden Sie Betreiber-, Hersteller-, Tarif- und Infrastrukturdaten, wenn verfügbar. Halten Sie Quelle und Datum ausserhalb von ELETTRA fest, wenn ein Wert entscheidungsrelevant ist." },
          { title: "Technische und jährliche Fragen trennen", text: "Verwenden Sie die Machbarkeitsbewertung für die anspruchsvolle technische Bedingung und die Jahresanalyse für repräsentative Jahresenergie, Kosten und Emissionen." },
          { title: "Vergleichbarkeit sicherstellen", text: "Halten Sie Betriebsumfang, Jahresdistanz und Systemgrenzen bei Vergleichen konsistent. Beachten Sie die Kompatibilitätswarnungen der Anwendung." },
          { title: "Vor Umsetzung vertiefen", text: "Nutzen Sie ELETTRA, um aussichtsreiche Konfigurationen und empfindliche Annahmen zu erkennen. Bestätigen Sie Beschaffung, Stromnetz, Ladegeräte, Depot, Bau und Betrieb durch entsprechende Fachstudien." },
        ],
        note: {
          title: "Grenzen der Bewertung",
          text: "ELETTRA ist ein Planungs- und Vorstudienwerkzeug. Ein machbares Ergebnis gilt nur für die gewählten Betriebs-, Fahrzeug-, Wetter-, Belegungs-, Batterie- und Ladeannahmen und ist kein Betriebsnachweis.",
        },
      },
      {
        id: "api",
        title: "Öffentliche API",
        items: [
          {
            id: "api-docs",
            title: "Die öffentliche API-Dokumentation öffnen",
            text: "Unter /docs auf dem ELETTRA-Server finden Sie in Swagger UI die Endpunkte, Parameter und Antworten. Das OpenAPI-Schema steht unter /openapi.json bereit. Beides ist ohne Anmeldung lesbar. Für geschützte Aufrufe benötigen Sie ein berechtigtes Konto. Die Links führen zum öffentlichen ELETTRA-Dienst.",
            links: publicApiLinks,
          },
        ],
      },
    ],
  },

  fr: {
    ui: {
      operatingGuide: "Guide pratique",
      references: "Références",
      documentTitle: "Guide d’utilisation ELETTRA",
      backToApp: "Retour à ELETTRA",
      languageAriaLabel: "Sélectionner la langue",
      print: "Imprimer le guide",
      contents: "Sommaire du guide",
      eyebrow: "Documentation utilisateur",
      title: "Guide d’utilisation ELETTRA",
      introduction:
        "Un guide concis et orienté vers les tâches pour préparer un service voiture, vérifier sa faisabilité technique et interpréter les résultats annuels d’énergie, de coûts et d’environnement.",
      baselineLabel: "Versions de référence",
      baselineValue: referenceVersions,
      updatedLabel: "Guide mis à jour",
      updatedValue: "26 novembre 2026",
      footer:
        "ELETTRA soutient les études de préfaisabilité. Les décisions finales relatives aux véhicules, à la recharge, au réseau et aux infrastructures doivent être confirmées par des études d’ingénierie détaillées.",
      skipLink: "Accéder au guide",
      sidebarAriaLabel: "Sommaire du guide",
      brandAriaLabel: "Guide d’utilisation ELETTRA",
      openImage: "Ouvrir la capture en taille réelle",
    },
    sections: [
      useCaseSections.fr,
      {
        id: "fleet",
        title: "1. Modèles de bus et arrêts personnalisés",
        intro: "Les données réutilisables sur les véhicules et les lieux alimentent les services voiture et les évaluations.",
        items: [
          { title: "Modèles de bus", text: "Ouvrez Flotte → Bus et choisissez Ajouter pour ouvrir Ajouter un modèle de bus. Saisissez la longueur réelle (9 à 13 m ou 17 à 19 m) et vérifiez la catégorie attribuée. Les nouveaux modèles utilisent LFP par défaut. Choisissez LFP ou NMC. Vérifiez la capacité en passagers, la masse du véhicule, les limites de la batterie, la puissance de recharge, les coûts et les durées de vie à partir des données de l’opérateur ou du constructeur." },
          { title: "Estimations pour le véhicule et la batterie", text: "Le prix du véhicule hors batteries repose sur les prix d’appels d’offres selon la longueur, avec extrapolation de 18 à 19 m. Le prix et la masse par pack dépendent de sa capacité et de sa chimie. Les prix sont en CHF hors TVA. Les valeurs saisies manuellement sont conservées lorsque les données associées changent. Rétablir l’estimation réactive le calcul automatique pour le champ. Si les estimations ne se chargent pas, saisissez les valeurs." },
          { title: "Limites de batterie", text: "Saisissez des nombres entiers positifs pour les packs, avec un minimum inférieur ou égal au maximum. Utilisez la même valeur pour les deux limites si le bus n’accepte qu’une configuration. Le formulaire affiche la plage de capacité nominale et le prix actuel du pack par kWh. La puissance maximale limite la puissance acceptée par le bus. Définissez la capacité utilisable dans l’évaluation de faisabilité." },
          { title: "Arrêts personnalisés", text: "Ajoutez ici les dépôts, stations de charge et pôles d’échanges qui ne figurent pas dans la liste des arrêts de l’horaire. Ouvrez Flotte → Arrêts personnalisés et choisissez Ajouter. Saisissez le nom, le type (Dépôt, Station de charge ou Pôle d’échanges), l’adresse et la ville. Choisissez Rechercher sur la carte ou déplacez la carte sous le réticule. Vérifiez la position et l’adresse obtenue. Si la recherche échoue, placez le réticule manuellement puis saisissez l’adresse et la ville. Détails ouvre une vue en lecture seule. Utilisez Modifier pour compléter les données manquantes des anciens arrêts." },
          { title: "Dupliquer les modèles et arrêts personnalisés", text: "Utilisez Dupliquer sur la ligne concernée pour ouvrir une copie modifiable. Les noms progressent dans la famille du nom initial : Ligne A_copie, Ligne A_copie_1, Ligne A_copie_2, etc., même en copiant une copie. ELETTRA utilise le premier suffixe disponible, toutes pages de la liste comprises. La même règle s’applique aux services voiture, évaluations de faisabilité et analyses annuelles. Le nom proposé reste modifiable." },
        ],
        figures: getGuideFigures("fr", "busBattery", "customStop"),
        note: { title: "Avant de modifier ou supprimer", text: "Les données réutilisables peuvent être référencées par des services voiture ou des analyses. Vérifiez les travaux dépendants avant de modifier une donnée déjà utilisée." },
      },
      {
        id: "shifts",
        title: "2. Construire un service voiture",
        intro: "Un service voiture couvre la journée complète d’un bus. Le planificateur séquentiel permet de construire le service du départ du dépôt au retour, en ajoutant courses, trajets à vide et pauses.",
        ordered: true,
        items: [
          { title: "Ouvrir Flotte → Services voiture et créer un service voiture", text: "Choisissez Ajouter pour ouvrir le planificateur séquentiel." },
          { title: "Choisir l’horaire GTFS", text: "Dans Configurer, choisissez le jour de service et l’édition GTFS. La dernière édition disponible est présélectionnée. Ces champs sont verrouillés tant que le programme contient des activités et sont enregistrés avec le service." },
          { title: "Définir les limites du service voiture", text: "Choisissez le dépôt de départ et l’heure de sortie. Saisissez 25:10 pour 01:10 le lendemain. Le programme affiche 01:10 (+1). Les stations de charge et pôles d’échanges liés à un arrêt peuvent servir de pauses intermédiaires." },
          { title: "Filtrer et ajouter les courses planifiées", figures: getGuideFigures("fr", "shiftPlanner"), text: "Choisissez une ligne sous Activité suivante. Après une course, le planificateur propose les départs du terminus actuel, y compris des quais de la même station GTFS. Choisissez Inclure les courses nécessitant un trajet à vide pour voir d’autres départs. Vérifiez le filtre après un changement de ligne ou de terminus. Profil permet de comparer les arrêts, les horaires, la carte et le profil altimétrique, selon les données disponibles." },
          { title: "Confirmer les transferts et ajouter les courses", text: "Ajoutez en un clic une course marquée Enchaînement direct. Pour un trajet à vide, vérifiez ou adaptez les horaires proposés, puis choisissez Ajouter l’activité. Les horaires GTFS restent fixes. Vérifiez les horaires avant d’utiliser le service si l’estimation manque ou dépasse le temps disponible. Une arrivée après le départ publié bloque la confirmation." },
          { title: "Ajouter une pause intermédiaire", text: "Choisissez Ajouter une pause au dépôt, puis un arrêt personnalisé et ses heures d’arrivée et de départ. Ajoutez d’autres courses ou pauses selon les besoins." },
          { title: "Planifier le retour, vérifier et enregistrer", text: "Après au moins une course commerciale, choisissez Planifier le retour au dépôt pour terminer au dépôt de départ. Vérifiez les heures de retour et confirmez-les avec Ajouter l’activité. Corrigez les conflits dans Votre journée de service, saisissez le nom et le modèle dans Vérifier et enregistrer puis sélectionnez Enregistrer le service voiture." },
          { title: "Modifier le programme enregistré complet", text: "Modifier rouvre le programme séquentiel. Ajustez un transfert, une pause ou le retour, ou choisissez Insérer avant. Pour prolonger un programme déjà clos, insérez la course avant le retour. Annuler la dernière modification rétablit le programme précédent. Sélectionnez Mettre à jour le service voiture pour enregistrer." },
          { title: "Modifier des services voiture antérieurs", figures: getGuideFigures("fr", "shiftComposer"), text: "Les anciens services s’ouvrent dans l’éditeur d’origine. Ajustez les courses dans Composer la journée. Sélectionnez un jour de service avant d’ouvrir Gérer les pauses intermédiaires. Modifier une pause peut ajouter ou exclure des courses. Vérifiez les deux listes dans l’aperçu avant de choisir Appliquer au service ou Annuler. Terminez avec Vérifier et enregistrer." },
          { title: "Rechercher ou dupliquer les services enregistrés", text: "La recherche couvre la liste complète côté serveur avant la pagination. Dupliquer enregistre immédiatement une copie avec le modèle de bus et, pour les services séquentiels, le programme complet, le jour et l’édition GTFS. Choisissez Modifier sur la copie enregistrée pour la renommer ou l’ajuster. Le nom utilise le premier suffixe libre de la famille d’origine (_copie, _copie_1, _copie_2). Supprimez une ligne ou sélectionnez-en plusieurs. Si une évaluation dépendante bloque la suppression, consultez le message pour voir quels services sont conservés." },
          { title: "Visualiser un service voiture enregistré", text: "Choisissez Visualiser le service voiture pour contrôler les informations générales et les mouvements enregistrés. Espace-temps est la vue par défaut. Elle affiche le temps à l’horizontale et les arrêts à la verticale. Toutes les lignes partagent un diagramme et chacune garde sa couleur. Les pointillés signalent les trajets hors service commercial. Dans Carte, utilisez Premier, Précédent, Suivant et Dernier pour examiner chaque mouvement, y compris les trajets de dépôt. Le diagramme signale les ruptures dues aux données de transfert manquantes avec les lieux et horaires concernés." },
        ],
        figures: getGuideFigures("fr", "shift"),
        note: { title: "Pourquoi la mission complète est importante", text: "Les déplacements depuis le dépôt et les transferts consomment de l’énergie même sans passagers. Les omettre peut rendre l’évaluation trop optimiste." },
      },
      {
        id: "feasibility",
        title: "3. Évaluation de faisabilité",
        intro: "L’évaluation associe la demande énergétique prévue aux décisions de batterie et de recharge.",
        ordered: true,
        items: [
          { title: "Choisir l’horaire GTFS et les services voiture", text: "Ouvrez Simulations → Évaluation de faisabilité et créez une évaluation. Choisissez d’abord une édition GTFS; le tableau ne montre ensuite que les services compatibles. Les anciens services mélangeant plusieurs éditions sont exclus des nouvelles évaluations et changer d’édition efface la sélection courante. Choisissez le jour de circulation pour afficher les services qui circulent ce jour-là dans l’édition sélectionnée. Un changement de jour retire de la sélection les services incompatibles." },
          { title: "Choisir un mode d’optimisation", modes: useCaseSections.fr.items },
          { title: "Définir le scénario", text: "Vérifiez la température extérieure, l’occupation, le chauffage, la capacité utilisable de la batterie et les paramètres avancés. Configurez les lieux de recharge candidats lorsque nécessaire. Le choix du modèle de bus suit les services sélectionnés et reste stable pendant la modification des autres entrées." },
          { title: "Vérifier le nombre initial de prises", text: "Les nouvelles évaluations proposent 1 prise par terminus hors dépôt en Batterie uniquement, Recharge et Conjoint. Pour les dépôts, le nombre initial correspond aux services voiture sélectionnés qui reviennent à chaque dépôt : N services représentent N bus et initialement N prises dans ce dépôt. Ces hypothèses restent modifiables. Batterie uniquement utilise le nombre installé ; Recharge et Conjoint le nombre maximal autorisé. Aux puissances proposées, une prise au terminus donne une limite de site de 450 kW et N prises au dépôt une limite de 150 × N kW. Vérifiez nombres et puissances avant de lancer. Les évaluations dupliquées conservent leur configuration enregistrée." },
          { title: "Capacité de la batterie et SOH", text: "Réglez le SOH (70% par défaut), la Capacité utilisable (50%) et la Référence de capacité (Résiduelle ou Initiale). Seule Initiale affiche l’Utilisation résiduelle maximale modifiable (85%). Les limites SOC sont calculées automatiquement ; l’aperçu bref montre l’énergie et la plage appliquée, les infobulles expliquent les réglages. Pour 500 kWh, Résiduelle donne 175 kWh à SOC 40–90% ; Initiale préserve 250 kWh à SOC 18,57–90%. La fraction utilisable / SOH ne doit pas dépasser l’utilisation résiduelle maximale. La préférence est 90%, avec une plage d’extension par défaut de 10–95%. Un bref avertissement apparaît sous 20% de SOC minimal appliqué, sans blocage. Le SOH modifie la capacité, ni la masse ni le coût des packs. Les copies conservent les limites SOC enregistrées tant que les hypothèses de batterie ne sont pas modifiées." },
          { title: "Paramètres de recharge facultatifs", text: "Cette section est repliée par défaut, comme les coûts d’infrastructure. Ouvrez-la pour Connexion et déconnexion du bus (1 minute par défaut) et Marge pour retards aux terminus (0 minute). Les copies avec des durées non standard l’ouvrent automatiquement. Le temps total de connexion/déconnexion est déduit une fois par session, dépôt compris : 5 minutes d’arrêt − 1 minute technique = 4 disponibles. La marge prudente exclut les dépôts : 6 − 1 technique − 2 de marge = 3 disponibles. Elle ne décale pas les courses ni ne propage les retards ; la modifier nécessite une nouvelle optimisation." },
          { title: "Gérer et dupliquer les évaluations enregistrées", text: "Chaque ligne se termine par les icônes Afficher les détails, Renommer, Dupliquer et Supprimer; survolez ou ciblez une icône pour lire son action. Dupliquer ouvre directement le formulaire d’évaluation, sans sélectionner la ligne ni utiliser un bouton Dupliquer en haut de page. ELETTRA restaure services, modèle de bus, références de batterie, limites SOC, contraintes et coûts de recharge, paramètres de prévision et options du solveur, et propose un nom modifiable se terminant par _copie, _copie_1, _copie_2, etc., sans répéter le suffixe. La copie est annulée plutôt que soumise partiellement si des ressources ou prévisions compatibles manquent. Supprimez une évaluation avec l’icône de la ligne, ou plusieurs évaluations sélectionnées avec l’action Supprimer en haut de page." },
          { id: "run-evaluation", title: "Calculer ensemble la moyenne et le Q95 agrégé", text: "Dans Modèle de bus et mode d’optimisation, Moyenne et Q95 indique les deux calculs prévus. Sélectionnez Lancer l’évaluation, vérifiez les services et le mode puis confirmez dans la boîte de dialogue. Le suivi distingue les estimations de consommation, la moyenne et le Q95. À la fin des deux calculs, ELETTRA ouvre le résultat de la moyenne s’il est disponible, ou le résultat Q95 terminé si le calcul de la moyenne a échoué. Si les deux échouent, la liste affiche le nombre d’échecs.", links: [{ href: "#mean-q95", label: "Interpréter la moyenne et le Q95" }] },
          { title: "Lire le verdict en premier", text: "Un calcul résolu peut rester physiquement infaisable si la batterie requise dépasse la limite du véhicule. Vérifiez d’abord le verdict et les packs requis par rapport aux packs disponibles." },
        ],
        figures: getGuideFigures("fr", "feasibilityForm"),
        note: { title: "Dimensionnement conservateur", text: "Utilisez un scénario exigeant mais plausible pour la décision technique. L’exploitation annuelle représentative est évaluée séparément." },
      },
      {
        id: "results",
        title: "4. Interpréter les résultats de faisabilité",
        intro: "Général résume la flotte ; vérifiez ensuite la batterie et le plan de recharge de chaque service voiture.",
        items: [
          { id: "mean-q95", title: "Utiliser la moyenne et le Q95 agrégé", text: "Dans Général, utilisez Afficher le résultat optimisé à côté des onglets pour passer de Moyenne à Q95. La moyenne dimensionne la configuration pour la consommation attendue dans les conditions choisies. Le Q95 la dimensionne pour un profil représentatif de consommation élevée. Comparez le verdict, les blocs batterie et les bornes partagées, puis ouvrez le même service voiture dans les deux configurations pour comparer le plan de recharge, le SOC minimal atteint et la marge au-dessus de la limite configurée. Le sélecteur charge la configuration enregistrée complète sans nouveau calcul et conserve l’onglet ouvert. Si le résultat demandé est en cours, a échoué ou manque, la configuration affichée reste visible et un message indique pourquoi." },
          { title: "Commencer par Général", text: "Pour une configuration faisable : Général résume tous les services voiture analysés et la plus grande batterie choisie. Chaque service conserve sa propre batterie; tous participent au dimensionnement et partagent l’infrastructure. Le volet GTFS compact de l’en-tête montre l’édition enregistrée lors de la création; pour un ancien résultat sans instantané, la provenance est explicitement dérivée des données actuelles du service." },
          { title: "Vérifier chaque service voiture", text: "Pour un service voiture physiquement vérifié : Le résumé affiche la consommation moyenne ou Q95 active, la consommation spécifique ainsi que les SOC minimal et maximal réellement atteints. Ces SOC sont des résultats, tandis que Fenêtre SOC configurée désigne les limites appliquées. Lisez-les avec la batterie, les recharges planifiées et la trajectoire SOC vérifiée. Les pourcentages de SOC se rapportent à la capacité résiduelle. Les hypothèses de batterie montrent les capacités initiale, résiduelle et utilisable ainsi que la plage de SOC appliquée ; kWh utilisables = kWh initiaux × SOH × (SOC maximal appliqué − SOC minimal appliqué). Pour 500 kWh et SOH 70%, il reste 350 kWh : SOC 40–90% donne 175 kWh utilisables, tandis que l’énergie utilisable initiale constante donne 250 kWh à 18,57–90%. L’avertissement concerne uniquement un minimum appliqué inférieur à 20%, distinct du SOC le plus bas atteint. Les tableaux de prévision et d’énergie utilisent le même SOH et la même plage appliquée." },
          { title: "Lire la demande totale et vérifier les limites de SOC", text: "Dans Batterie et marge énergétique, l’histogramme compte les séquences simulées selon leur consommation totale à la masse de batterie retenue. L’énergie rechargée est comptée à part. Pour chaque séquence Monte-Carlo, le modèle tire indépendamment une consommation pour chaque course, y compris les courses répétées, puis additionne ces valeurs sur le service voiture. Le trait vertical indique le profil actif. Environ 95 % des totaux simulés sont inférieurs ou égaux au Q95. ELETTRA utilise une séquence représentative de ce total. Une somme de Q95 par course aurait un autre sens. Vérifiez la courbe de SOC par rapport aux deux limites configurées. Entre départ et arrivée, le tracé d’une course est une approximation linéaire. Les 95 % concernent les totaux simulés de consommation. L’infobulle du SOC peut indiquer séparément la part des trajectoires simulées qui terminent le service dans les limites de SOC avec le plan retenu. Dans l’exemple Q95, une recharge au dépôt de 62,5 kWh aide à couvrir une demande de 539,2 kWh. Le SOC minimal de 153,3 kWh dépasse de 13,3 kWh la limite de 140 kWh." },
          { title: "Contrôler le plan de recharge et la recharge au dépôt", text: "Ouvrez Plan de recharge et vérifiez le lieu, l’heure et le jour de chaque session. Consultez Arrêt planifié, Disponible pour la recharge et Énergie rechargée. Détails de recharge indique le temps technique, la marge pour retards, les durées active et inactive et la puissance moyenne. Un bus connecté occupe la prise pendant tout l’arrêt. Le mode Batterie uniquement peut aussi programmer des recharges dans les limites de l’infrastructure installée. Si le départ du lendemain a été vérifié, comparez le SOC au départ à la cible sous Cycle journalier et recharge au dépôt. Pour un résultat non faisable, ouvrez Contraintes identifiées à côté du verdict ou de l’état du service pour consulter le diagnostic disponible pour le dépôt. Un diagnostic limité à la journée peut révéler un déficit sans établir de plan de nuit." },
          { title: "Ouvrir Plus d’informations si nécessaire", text: "Plan de recharge et Plus d’informations sont des cartes blanches dépliables. Elles contiennent sessions, détails des prévisions, hypothèses d’exploitation, limites SOC configurées et valeurs justificatives. Pour un dimensionnement vérifié, la prévision de la batterie choisie précède directement la référence initiale au maximum physique. Le rôle de la prévision et son nombre de packs permettent d’identifier celle qui a servi à vérifier la configuration finale." },
          { id: "resolve-feasibility", title: "Distinguer non-faisabilité, échec et résultat indisponible", text: "Un résultat non faisable établit une contrainte technique dans les conditions choisies, comme la capacité de la batterie ou l’accès aux bornes. Un calcul en cours reste ouvert. Un échec, un délai dépassé ou un résultat indisponible ne fournit aucun verdict vérifié pour le profil. Quand Général affiche l’état de chaque service pour une faisabilité non déterminée, ouvrez le service concerné et consultez Comment résoudre le problème. Un service non valide peut bloquer l’évaluation des autres. Un verdict orange pour la paire signifie qu’un profil est faisable et l’autre non. Le libellé précise lequel a passé la vérification." },
          { title: "Lire les estimations de batterie non faisables", text: "Pour une non-faisabilité établie, Général affiche les services voiture concernés avec les packs choisis, le maximum installable, le besoin estimé et les packs manquants par rapport à la batterie choisie. Les besoins en rouge dépassent le maximum physique ; — signifie indisponible, pas zéro. Ouvrez le nom du service pour consulter sa batterie. Les packs diagnostiques ou virtuels décrivent un déficit, pas une batterie installable vérifiée. Le diagnostic peut exclure la recharge avant le prochain départ : l’absence de déficit de batterie ne garantit pas un cycle journalier complet faisable. Les SOC et plans de recharge diagnostiques ne sont pas affichés comme une exploitation vérifiée ; les services physiquement faisables conservent leurs détails opérationnels." },
          { title: "Interpréter une consommation Q95 absente", text: "Un résultat Q95 techniquement non faisable peut contenir des valeurs de consommation. Si le diagnostic enregistré ne contient pas la consommation Q95 agrégée, la cellule affiche N/A avec une infobulle et la consommation spécifique apparaît sous la forme —. Ces deux symboles signalent une valeur manquante. Les quantiles par course ne servent pas à la reconstituer." },
          { title: "Trouver les explications contextuelles", text: "Les icônes d’information près du résultat, de l’estimation de batterie, de la légende et des colonnes de packs estimés ou manquants expliquent les contraintes et le périmètre diagnostique. Évaluation de la flotte, Batteries et investissement dans les bus, Infrastructure de recharge des services sélectionnés et Investissement de recharge par site ont aussi des infobulles. Ouvrez-les au survol, au focus clavier ou par toucher ; Échap les ferme. Scénario de demande, mode d’optimisation et résultat partagent l’en-tête de la flotte." },
          {"title": "Consulter les données brutes de faisabilité", "text": "Afficher les données brutes de faisabilité est disponible en haut à droite, à la place de l’icône de fermeture, dans Général comme dans chaque service voiture. Le bouton ouvre les entrées enregistrées et la configuration détaillée dans une fenêtre ; fermez-la pour revenir au résultat. Les cartes compactes SOH, Temps techniques, Hypothèses HVAC et Horaire GTFS de l’en-tête ouvrent les hypothèses enregistrées correspondantes."},
          {"title": "Exporter l’évaluation de faisabilité complète", "text": "Dans Général, choisissez Télécharger tous les résultats (JSON) en bas des résultats, à côté de Fermer, comme dans l’analyse annuelle. Le fichier de schéma 1 contient tous les services voiture et les conceptions Mean et Aggregate Q95 disponibles, quel que soit le profil affiché au clic. Chaque conception conserve sa configuration, ses investissements, limites SOC, plan de recharge, identifiants de prévision et provenance enregistrée. L’infrastructure est comptée une fois par conception ; Mean et Q95 sont des alternatives dont les investissements ne doivent pas être additionnés. Le téléchargement lit les calculs enregistrés sans lancer une nouvelle optimisation."},
          {"title": "Vérifier la disponibilité de l’export", "text": "La collecte conserve le contexte capturé au clic. Les prévisions manquantes et les profils indisponibles, en attente ou en échec sont explicitement signalés dans un fichier partiel ; téléchargez à nouveau pour réessayer le chargement. Un fichier partiel ne prouve pas l’infaisabilité ; les résultats diagnostiques ne sont pas des plans de recharge vérifiés. Les valeurs historiques par défaut et les prix actuels utilisés en remplacement restent identifiés. Les entrées complètes de reproduction HVAC nécessitent le téléchargement HVAC séparé. Les coûts et émissions annuels relèvent de l’export de l’analyse annuelle."},
        ],
        figures: getGuideFigures("fr", "feasibilityEfficiency", "feasibilitySizing", "infeasibility"),
      },
      {
        id: "yearly",
        title: "5. Analyse annuelle",
        intro: "L’analyse annuelle conserve le dimensionnement faisable du bus et de la recharge. Général évalue la flotte ou un groupe de bus représentatif; chaque service voiture présente sa propre efficacité annuelle.",
        ordered: true,
        items: [
          { title: "Créer une analyse à partir d’une évaluation admissible", text: "Ouvrez Simulations → Analyses annuelles → Nouveau. Renseignez le Nom, choisissez dans Simulation une évaluation terminée, faisable et admissible dont le nombre de packs est enregistré, puis réglez Nombre moyen de passagers à bord (%). Si Mean et Q95 agrégé sont tous deux admissibles, choisissez la variante voulue. L’évaluation fournit les services voiture, les batteries, la recharge et l’édition GTFS enregistrée." },
          { title: "Gérer et dupliquer les analyses annuelles enregistrées", text: "Chaque ligne se termine par les icônes Afficher les détails, Renommer, Dupliquer et Supprimer. Dupliquer ouvre un nouveau formulaire d’analyse prérempli avec l’évaluation de faisabilité source et l’occupation, et propose un nom modifiable se terminant par _copie, _copie_1, _copie_2, etc., sans répéter le suffixe; vérifiez les données héritées avant de lancer le calcul. Supprimez une analyse avec l’icône de la ligne, ou plusieurs analyses sélectionnées avec l’action Supprimer en haut de page." },
          { title: "Vérifier les données héritées", text: "Vérifiez les services voiture, le mode d’optimisation, la température de dimensionnement, les packs et les capacités. ELETTRA sélectionne automatiquement le dépôt de référence météo. Les scénarios en lecture seule indiquent les températures représentatives de jour (05:00–24:00) et leurs occurrences en jours/an. Un total différent de 365 déclenche un avertissement. Un total nul empêche le lancement. Choisissez Lancer l’analyse annuelle, vérifiez les nombres de services et de scénarios ainsi que le dépôt, puis choisissez Lancer l’analyse. Chaque scénario est appliqué à tous les services hérités. Les résultats s’ouvrent automatiquement." },
          { title: "Commencer par Général", text: "L’analyse annuelle de la flotte montre le kilométrage, l’énergie DC au bus, l’électricité achetée, la consommation des services en kWh/km, le TCO électrique et l’impact climatique. Min et Max désignent les services aux consommations moyennes extrêmes. Bus représentatif / Flotte affiche la flotte entière ou les valeurs par bus d’un groupe de même modèle et capacité. Les affectations de faisabilité sont conservées. L’électricité achetée est calculée à partir de l’énergie DC avec un rendement de recharge de 94 %. Min et Max indiquent sur deux lignes la consommation moyenne la plus basse et la plus élevée en kWh/km, avec le nom du service voiture correspondant." },
          { title: "Examiner les Coûts et les Émissions de la flotte", text: "Coûts affiche le TCO, le coût annuel équivalent, le coût cumulé actualisé et le seuil de rentabilité. Le segment violet montre l’investissement annualisé, remplacements et crédit de valeur résiduelle compris. Les investissements en bus et batteries reviennent intégralement aux véhicules physiques du périmètre. Dans l’évaluation actuelle, l’infrastructure partagée est comptée une fois pour la flotte et répartie selon le nombre de bus physiques, à parts égales par bus représentatif. Émissions montre les phases du cycle de vie, les indicateurs environnementaux et les réglages Kilométrage et consommation diesel. Le kilométrage et les hypothèses physiques communes sont enregistrés automatiquement. Le dimensionnement et les résultats simulés des services conservent leurs données d’origine." },
          { title: "Sélectionner un service voiture", text: "Choisissez un service voiture pour afficher son énergie annuelle simulée, sa distance et sa consommation. Le premier graphique présente les kWh/km selon la température. Dans le graphique de contribution énergétique, utilisez kWh/jour pour la journée type ou kWh/an pour sa contribution pondérée par sa fréquence. Par exemple, 100 kWh/jour pendant 40 jours/an donnent 4 000 kWh/an. Dans Efficacité, ouvrez Plus d'informations pour consulter les scénarios et les données de batterie." },
          { title: "Lire l’intervalle de consommation Q05–Q95", text: "Le calcul Monte-Carlo tire la consommation de chaque course indépendamment, y compris entre services, et additionne les courses du périmètre avant le calcul de Q05, Q50 et Q95. L’intervalle des 90 % centraux vaut pour une journée type par scénario de température. En kWh/km, on divise par la distance du même périmètre. En kWh/an, on multiplie l’intervalle par le nombre de jours du groupe météo. Le total annuel est une estimation ponctuelle. Celle-ci reste affichée pour chaque scénario privé d’intervalle." },
          { title: "Vérifier la provenance météo et HVAC", text: "Les volets GTFS et HVAC compacts identifient l’horaire et la politique d’auxiliaires enregistrés. L’analyse annuelle utilise le GHI PVGIS horaire dans le fuseau GTFS local et indique l’énergie HVAC en course et au terminus; la traçabilité et les actions JSON donnent les hypothèses et les entrées complètes de reproduction. La provenance enregistrée identifie l’édition GTFS utilisée pour la faisabilité. Pour une ancienne analyse, vérifiez si l’édition a été reconstituée à partir des services voiture actuels." },
          { title: "Examiner la configuration et exporter depuis Général", text: "Afficher les données de configuration ouvre le dimensionnement figé. Dans Général, choisissez Télécharger tous les résultats (JSON) à côté de Fermer. Le schéma 4 contient la flotte complète, tous les groupes représentatifs et les services disponibles, quel que soit le groupe sélectionné. Il conserve la provenance, les résultats par scénario, l’incertitude et les identifiants de prévision disponibles, ainsi que les hypothèses effectives et l’activité modifiée séparée de la simulation d’origine. Les anciennes analyses sans investissement de flotte figé conservent le schéma 3. Si elles affichent des coûts par service, elles peuvent répartir l’infrastructure selon l’énergie DC annuelle." },
          { title: "Vérifier l’état de sauvegarde avant de fermer", text: "Le JSON complet décrit l’évaluation actuelle et indique si ses hypothèses sont enregistrées. Les sauvegardes en attente ou en échec restent explicites dans le fichier. Fermer attend la sauvegarde; un échec ou une saisie invalide garde la page ouverte pour corriger la valeur ou réessayer la sauvegarde avant de rouvrir l’analyse." },
          { title: "Télécharger les résultats environnementaux actuels", text: "Le téléchargement séparé dans Émissions suit le périmètre sélectionné: flotte ou bus représentatif. Il est activé seulement lorsque l’évaluation actuelle est prête. Pendant une mise à jour ou après un échec, le JSON complet distingue toute réponse précédente des résultats actuels. Utilisez Réessayer après un échec de mise à jour. Les services voiture renvoient à l’évaluation environnementale de leur groupe représentatif; l’export n’invente pas d’impacts indépendants par service." },
          { title: "Reconnaître les anciens résultats uniquement agrégés", text: "Une ancienne analyse sans ventilation par service voiture peut n’afficher que Général. ELETTRA laisse absents les détails indisponibles au lieu de les inventer à partir des totaux." },
          {"title": "Définir la maintenance de la recharge", "text": "Dans Coûts → Modifier les hypothèses économiques → Paramètres économiques supplémentaires, choisissez un pourcentage annuel de l’investissement de recharge ou un montant fixe en CHF/an. Le pourcentage est modifiable : 2%/an est la valeur initiale, avec la référence INFRAS 2026 de 2–5%. Il ne s’agit pas de CHF 2/an. Vérifiez la méthode enregistrée et les unités, surtout pour les anciennes analyses ; un montant fixe nul exclut la maintenance de l’infrastructure. Le pourcentage porte sur l’investissement complet de recharge, avec un entretien compté une seule fois par flotte, hors bus et batteries ; l’infobulle explique cette hypothèse."},
          {"title": "Lire le périmètre de calcul", "text": "Dans Modifier les hypothèses économiques, vérifiez le prix de l’électricité en CHF/kWh réseau, le prix du diesel en CHF/l, la consommation diesel en l/km, l’entretien des bus en CHF/km et le kilométrage annuel par bus. Paramètres économiques supplémentaires indique l’horizon et les durées de vie en années, le taux d’actualisation en pourcentage et le prix d’achat diesel en CHF/bus. Méthode de calcul et périmètre explique les hypothèses communes aux deux technologies et le traitement de la valeur résiduelle."},
        ],
        figures: getGuideFigures("fr", "yearlyTemperature", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Ne pas redimensionner le véhicule ici", text: "L’analyse annuelle représente l’exploitation du design retenu lors de l’évaluation de faisabilité. Revenez à cette évaluation si le véhicule, la batterie ou la recharge doivent changer." },
      },
      {
        id: "comparison",
        title: "6. Comparer et exporter les analyses",
        intro: "Une comparaison est plus utile lorsque les variantes diffèrent par une décision ou une hypothèse clairement identifiée.",
        items: [
          { title: "Sélectionner deux analyses annuelles", text: "Ouvrez Simulations → Comparaison d'analyses et sélectionnez Analyse A et Analyse B parmi vos analyses enregistrées. Compatible exige le même ensemble non vide de services voiture et le même mode d’optimisation. Un service commun, un nombre identique de services ou un mode identique peuvent donner Partiellement comparable. Le badge aide à l’interprétation et les résultats disponibles restent affichés." },
          { title: "Comparer des indicateurs cohérents", text: "Aperçu, Efficacité, Coût et Émissions comparent Général. L’écart absolu est B − A. L’écart relatif est calculé par rapport à A si A est différent de zéro. Vérifiez la distance, l’édition GTFS, la météo et les hypothèses. Efficacité utilise les totaux de simulation enregistrés. Coût utilise le calcul annuel de la comparaison et Émissions une évaluation de flotte. Pour comparer des tarifs ou kilométrages modifiés, comparez les mêmes périmètres et champs des deux fichiers JSON annuels complets." },
          { title: "Exporter les éléments probants", text: "Dans Détails / Export, Exporter en CSV fournit valeurs A/B, écarts et complétude. Exporter en JSON conserve les modèles Général, les contrôles de compatibilité et les indicateurs. Pour les groupes, les résultats techniques par service, les hypothèses effectives et les coûts détaillés, utilisez Télécharger tous les résultats (JSON) dans Général de chaque analyse annuelle." },
        ],
        figures: getGuideFigures("fr", "comparison"),
        note: { title: "Nommer clairement les scénarios", text: "Incluez la principale différence dans le nom enregistré, par exemple le véhicule, le chauffage, l’occupation ou la stratégie de recharge." },
      },
      {
        id: "start",
        title: "Compte, langue et navigation",
        intro: "Le guide est public, mais les données de flotte et les analyses nécessitent un compte ELETTRA.",
        items: [
          { id: "registration", title: "Se connecter ou créer un compte", text: "À l’inscription, choisissez l’entreprise de transport dans la liste de suggestions. Une fois le compte créé, connectez-vous pour accéder à l’accueil. Lors de l’inscription, l’aperçu CARTO utilise la dernière édition GTFS disponible et affiche toutes les lignes représentables avec leur numéro pour aider à confirmer l’entreprise. La carte est indicative et les tracés sont simplifiés; elle ne constitue pas une référence détaillée du réseau." },
          { title: "Choisir la langue de l’interface", text: "Utilisez le sélecteur de langue dans l’en-tête de l’application. L’anglais, l’allemand, le français et l’italien sont disponibles; la préférence est conservée dans le navigateur." },
          { title: "Utiliser la navigation principale", text: "Accueil explique le flux de planification et donne accès aux six sections de travail. Flotte contient Bus, Arrêts personnalisés et Services voiture; Simulations contient Évaluation de faisabilité, Analyses annuelles et Comparaison d'analyses. Le guide reste accessible au bas de la barre latérale. Chaque carte ouvre un outil. Son lien Lire le guide ouvre le chapitre correspondant dans un nouvel onglet." },
        ],
        figures: getGuideFigures("fr", "shell"),
      },
      {
        id: "practice",
        title: "Hypothèses, limites et bonnes pratiques",
        intro: "La qualité d’une préfaisabilité dépend de la qualité et de la cohérence de ses hypothèses.",
        items: [
          { title: "Remplacer les valeurs par défaut lorsque possible", text: "Utilisez les informations de l’opérateur, du constructeur, des tarifs et des infrastructures. Consignez la source et la date en dehors d’ELETTRA lorsqu’une valeur est importante pour la décision." },
          { title: "Séparer les questions techniques et annuelles", text: "Utilisez l’évaluation de faisabilité pour la condition technique exigeante et l’analyse annuelle pour l’énergie, les coûts et les émissions représentatifs." },
          { title: "Comparer ce qui est comparable", text: "Maintenez un périmètre de service voiture, une distance annuelle et des limites cohérents. Tenez compte des avertissements de compatibilité de l’application." },
          { title: "Approfondir avant la mise en œuvre", text: "Utilisez ELETTRA pour identifier les configurations prometteuses et les hypothèses sensibles. Confirmez les décisions d’achat, de réseau, de recharge, de dépôt, de génie civil et d’exploitation par des études spécialisées." },
        ],
        note: { title: "Périmètre de l’évaluation", text: "ELETTRA est un outil de planification et de préfaisabilité. Un résultat faisable dépend des hypothèses retenues pour le service voiture, le véhicule, la météo, l’occupation, la batterie et la recharge; il ne constitue pas une certification opérationnelle." },
      },
      {
        id: "api",
        title: "API publique",
        items: [
          {
            id: "api-docs",
            title: "Consulter la documentation publique de l’API",
            text: "Sur le serveur ELETTRA, ouvrez /docs pour consulter les points d’accès, les paramètres et les réponses dans Swagger UI. Le schéma OpenAPI est disponible sous /openapi.json. Les deux sont consultables sans connexion. Les opérations protégées nécessitent un compte autorisé. Les liens ci-dessous ouvrent le service public ELETTRA.",
            links: publicApiLinks,
          },
        ],
      },
    ],
  },

  it: {
    ui: {
      operatingGuide: "Guida operativa",
      references: "Riferimenti",
      documentTitle: "Guida utente ELETTRA",
      backToApp: "Torna a ELETTRA",
      languageAriaLabel: "Seleziona lingua",
      print: "Stampa la guida",
      contents: "Indice della guida",
      eyebrow: "Documentazione utente",
      title: "Guida utente ELETTRA",
      introduction:
        "Una guida concisa e orientata alle attività per preparare un servizio di autobus, verificarne la fattibilità tecnica e interpretare i risultati annuali energetici, economici e ambientali.",
      baselineLabel: "Versioni di riferimento",
      baselineValue: referenceVersions,
      updatedLabel: "Guida aggiornata",
      updatedValue: "26 novembre 2026",
      footer:
        "ELETTRA supporta studi di prefattibilità. Le decisioni finali su veicoli, ricarica, rete e infrastrutture devono essere confermate mediante una progettazione tecnica dettagliata.",
      skipLink: "Vai alla guida",
      sidebarAriaLabel: "Indice della guida",
      brandAriaLabel: "Guida utente ELETTRA",
      openImage: "Apri la schermata a dimensione intera",
    },
    sections: [
      useCaseSections.it,
      {
        id: "fleet",
        title: "1. Modelli di autobus e fermate personalizzate",
        intro: "I dati riutilizzabili di veicoli e località forniscono gli input tecnici per turni macchina e valutazioni.",
        items: [
          { title: "Modelli di autobus", text: "Aprire Flotta → Autobus e scegliere Aggiungi per aprire Aggiungi modello autobus. Inserire la lunghezza effettiva (9–13 m o 17–19 m) e verificare la categoria assegnata. I nuovi modelli partono da LFP. Scegliere LFP o NMC. Verificare capacità passeggeri, massa del veicolo, limiti della batteria, potenza di ricarica, costi e durate di vita con i dati dell’operatore o del costruttore." },
          { title: "Stime per il veicolo e la batteria", text: "Il prezzo del veicolo senza batterie deriva dai prezzi di gara in funzione della lunghezza, con estrapolazione da 18 a 19 m. Prezzo e massa del pacco dipendono da capacità e chimica. I prezzi sono in CHF, IVA esclusa. I valori inseriti manualmente si conservano quando cambiano i relativi parametri. Ripristina stima riattiva il calcolo automatico del campo. Se le stime non si caricano, inserire i valori manualmente." },
          { title: "Limiti della batteria", text: "Inserire numeri interi positivi di pacchi, con un minimo inferiore o uguale al massimo. Usare lo stesso valore per entrambi se il bus accetta una sola configurazione. Il modulo mostra l’intervallo di capacità nominale e il prezzo corrente del pacco per kWh. La potenza massima di ricarica limita la potenza accettata dall’autobus. La capacità utilizzabile si definisce nella valutazione di fattibilità." },
          { title: "Fermate personalizzate", text: "Aggiungere qui depositi, stazioni di ricarica e nodi di scambio assenti dall’elenco delle fermate dell’orario. Aprire Flotta → Fermate personalizzate e scegliere Aggiungi. Inserire nome, tipo (Deposito, Stazione di ricarica o Nodo di scambio), indirizzo e città. Usare Cerca sulla mappa o spostare la mappa fino a posizionare il mirino. Controllare posizione e indirizzo ottenuti. Se la ricerca non riesce, posizionare manualmente la mappa e compilare indirizzo e città. Dettagli apre una vista in sola lettura. Usare Modifica per completare i dati mancanti delle fermate storiche." },
          { title: "Duplicare modelli e fermate personalizzate", text: "Usare Duplica sulla riga interessata per aprire una copia modificabile. I nomi proseguono nella famiglia del nome originale: Linea A_copia, Linea A_copia_1, Linea A_copia_2 e così via, anche copiando una copia. ELETTRA usa il primo suffisso disponibile considerando tutte le pagine dell’elenco. La stessa regola vale per turni macchina, valutazioni di fattibilità e analisi annuali. Il nome proposto resta modificabile." },
        ],
        figures: getGuideFigures("it", "busBattery", "customStop"),
        note: { title: "Prima di modificare o eliminare", text: "I record riutilizzabili possono essere referenziati da turni macchina o analisi. Verificare i lavori dipendenti prima di modificare un record già utilizzato." },
      },
      {
        id: "shifts",
        title: "2. Costruire un turno macchina",
        intro: "Un turno macchina comprende il servizio giornaliero completo di un autobus. Il planner sequenziale permette di costruire il turno dalla partenza al rientro in deposito, aggiungendo corse, trasferimenti a vuoto e soste.",
        ordered: true,
        items: [
          { title: "Aprire Flotta → Turni macchina e creare un turno macchina", text: "Scegliere Aggiungi per aprire il planner sequenziale." },
          { title: "Scegliere l’orario GTFS", text: "In Imposta il turno, scegliere giorno di servizio ed edizione GTFS. L’edizione più recente disponibile è preselezionata. I due campi rimangono bloccati finché il programma contiene attività e vengono salvati con il turno." },
          { title: "Definire i limiti del servizio", text: "Scegliere il deposito e l’ora di partenza. Inserire 25:10 per l’01:10 del giorno successivo. Il programma mostra 01:10 (+1). Le stazioni di ricarica e i nodi di scambio collegati a una fermata possono essere usati per le soste intermedie." },
          { title: "Filtrare e aggiungere le corse programmate", figures: getGuideFigures("it", "shiftPlanner"), text: "Scegliere una linea in Prossima attività. Dopo una corsa il planner propone le partenze dal capolinea corrente, incluse le banchine della stessa stazione GTFS. Selezionare Includi le corse che richiedono un trasferimento a vuoto per vedere altre partenze. Ricontrollare il filtro dopo un cambio di linea o di capolinea. Profilo apre fermate, orari, mappa e, se disponibile, profilo altimetrico." },
          { title: "Confermare i trasferimenti e aggiungere le corse", text: "Aggiungere con un clic una corsa con Prosecuzione diretta. Per un trasferimento a vuoto verificare o modificare gli orari proposti e scegliere Aggiungi attività. Gli orari GTFS restano fissi. Se la stima manca o supera il tempo disponibile, verificare gli orari prima di usare il turno. Un arrivo dopo la partenza pubblicata blocca la conferma." },
          { title: "Aggiungere una sosta intermedia", text: "Selezionare Aggiungi sosta in deposito, scegliere una fermata personalizzata e impostare arrivo e ripartenza. Aggiungere altre corse o soste secondo necessità." },
          { title: "Pianificare il rientro, rivedere e salvare", text: "Dopo almeno una corsa di linea, scegliere Pianifica rientro in deposito per concludere al deposito di partenza. Controllare gli orari di rientro e confermare con Aggiungi attività. Risolvere i conflitti in La tua giornata di servizio, inserire nome e modello in Rivedi e salva e selezionare Salva turno macchina." },
          { title: "Modificare il programma salvato completo", text: "Modifica riapre il programma sequenziale. Modificare un trasferimento, una sosta o il rientro, oppure usare Inserisci prima. Per prolungare un turno già chiuso, inserire la corsa prima del rientro. Annulla ultima modifica ripristina il programma precedente. Salvare con Aggiorna turno macchina." },
          { title: "Modificare i turni macchina storici", figures: getGuideFigures("it", "shiftComposer"), text: "I turni storici si aprono nell’editor precedente. Modificare le corse in Componi la giornata. Selezionare un giorno di servizio prima di aprire Gestisci soste intermedie. Cambiare una sosta può aggiungere o escludere corse. Controllare entrambi gli elenchi nell’anteprima prima di scegliere Applica al turno o Annulla. Concludere con Rivedi e salva." },
          { title: "Cercare o duplicare i turni salvati", text: "La ricerca interroga l’elenco completo sul server prima della paginazione. Duplica salva subito una copia con il modello di autobus e, per i turni sequenziali, il programma completo, il giorno e l’edizione GTFS. Usare Modifica sulla copia salvata per rinominarla o aggiornarla. Il nome usa il primo suffisso libero della famiglia originale (_copia, _copia_1, _copia_2). Usare Elimina su una riga oppure selezionarne più di una. Se una valutazione dipendente blocca l’eliminazione, il messaggio indica quali turni rimangono." },
          { title: "Visualizzare un turno salvato", text: "Scegliere Visualizza turno macchina per controllare le informazioni generali e i movimenti registrati. Spazio-tempo è la vista predefinita. Mostra il tempo in orizzontale e le fermate in verticale. Tutte le linee condividono lo stesso diagramma e ciascuna mantiene il proprio colore. I tratti tratteggiati indicano le corse fuori linea. In Mappa usare Prima, Precedente, Successiva e Ultima per controllare ogni movimento, inclusi quelli di deposito. Il diagramma segnala le discontinuità dovute a dati di trasferimento mancanti e indica località e orari interessati." },
        ],
        figures: getGuideFigures("it", "shift"),
        note: { title: "Perché il servizio completo è importante", text: "Gli spostamenti da deposito e di trasferimento consumano energia anche senza passeggeri. Ometterli può rendere la valutazione troppo ottimistica." },
      },
      {
        id: "feasibility",
        title: "3. Valutazione di fattibilità",
        intro: "La valutazione collega la domanda energetica prevista alle decisioni su batteria e ricarica.",
        ordered: true,
        items: [
          { title: "Scegliere l’orario GTFS e i turni macchina", text: "Aprire Simulazioni → Valutazione di fattibilità e creare una nuova valutazione. Selezionare prima una sola edizione GTFS; la tabella mostra quindi soltanto i turni compatibili. I turni storici che mescolano edizioni sono esclusi dalle nuove valutazioni e il cambio di edizione svuota la selezione corrente. Scegliere un giorno di servizio per visualizzare i turni che circolano in quel giorno nell’edizione selezionata. Cambiando giorno, i turni incompatibili vengono rimossi dalla selezione." },
          { title: "Scegliere una modalità di ottimizzazione", modes: useCaseSections.it.items },
          { title: "Impostare lo scenario", text: "Verificare temperatura esterna, occupazione, riscaldamento, intervallo utilizzabile dello stato di carica e parametri avanzati. Configurare i punti di ricarica candidati quando necessario. La scelta del modello di autobus segue i turni selezionati e resta stabile mentre si modificano gli altri input." },
          { title: "Verificare il numero iniziale di prese", text: "Le nuove valutazioni propongono 1 presa per ogni capolinea non di deposito nelle modalità Solo batteria, Ricarica e Congiunta. Per i depositi il numero iniziale deriva invece dai turni selezionati che rientrano in ciascun deposito: N turni corrispondono a N bus e inizialmente N prese in quel deposito. Sono ipotesi modificabili. Solo batteria usa il numero installato; Ricarica e Congiunta il massimo consentito. Con le potenze predefinite, una presa al capolinea ha un limite di sito di 450 kW e N prese al deposito un limite di 150 × N kW. Verificare quantità e potenze prima dell’avvio. Le valutazioni duplicate conservano la configurazione salvata." },
          { title: "Capacità della batteria e SOH", text: "Impostare SOH (predefinito 70%), Capacità utilizzabile (50%) e Riferimento della capacità (Residua o Iniziale). Solo Iniziale mostra l’Utilizzo massimo della capacità residua modificabile (85%). I limiti SOC sono calcolati automaticamente; la breve anteprima mostra energia e finestra applicata, con spiegazioni nei tooltip. Per 500 kWh, Residua dà 175 kWh a SOC 40–90%; Iniziale mantiene 250 kWh a SOC 18,57–90%. La frazione utilizzabile / SOH non può superare l’utilizzo massimo della capacità residua. La preferenza è 90%, con intervallo di espansione predefinito 10–95%. Sotto il 20% di SOC minimo applicato compare un breve avviso senza blocco. Il SOH cambia la capacità, non massa o costo dei pacchi. Le copie mantengono i limiti SOC salvati finché non si modificano le ipotesi della batteria." },
          { title: "Parametri opzionali di ricarica", text: "Questa sezione è inizialmente chiusa, come i costi dell’infrastruttura. Aprirla per modificare Collegamento e scollegamento del bus (predefinito 1 minuto) e Margine per ritardi al capolinea (0 minuti). Le copie con tempi non predefiniti la aprono automaticamente. Il tempo complessivo di collegamento/scollegamento si sottrae una volta per sessione, anche in deposito: sosta di 5 minuti − 1 tecnico = 4 disponibili. Il margine prudenziale esclude i depositi: 6 − 1 tecnico − 2 di margine = 3 disponibili. Non sposta le corse né propaga ritardi; modificarlo richiede una nuova ottimizzazione." },
          { title: "Gestire e duplicare le valutazioni salvate", text: "Ogni riga termina con le icone Visualizza dettagli, Rinomina, Duplica ed Elimina; passare il mouse o portare il focus su un’icona per leggerne l’azione. Duplica apre direttamente il modulo della valutazione, senza selezionare la riga e senza un pulsante Duplica in alto. ELETTRA ripristina turni, modello, riferimenti batteria, limiti SOC, vincoli e costi di ricarica, impostazioni previsionali e opzioni del risolutore e propone un nome modificabile con i suffissi _copia, _copia_1, _copia_2, ecc., senza ripetere il suffisso. Se mancano risorse originali o previsioni compatibili, la copia viene annullata invece di essere inviata parzialmente. Usare l’icona Elimina della riga per una valutazione oppure selezionare più righe e usare l’azione Elimina in alto per un’eliminazione multipla." },
          { id: "run-evaluation", title: "Calcolare insieme Media e Q95 aggregato", text: "In Modello autobus e modalità di ottimizzazione, la voce Media e Q95 indica i due calcoli previsti. Seleziona Avvia valutazione, controlla turni e modalità e conferma nella finestra di dialogo. L’avanzamento distingue stime dei consumi, Media e Q95. Al termine dei due calcoli ELETTRA apre il risultato Media, se concluso, oppure il risultato Q95 concluso se Media non è riuscito. Se falliscono entrambi, l’elenco indica il numero di calcoli non riusciti.", links: [{ href: "#mean-q95", label: "Come leggere Media e Q95" }] },
          { title: "Leggere prima il verdetto", text: "Un calcolo concluso può essere fisicamente non fattibile se la batteria richiesta supera il limite del veicolo. Verificare prima verdetto e pacchi richiesti rispetto a quelli disponibili." },
        ],
        figures: getGuideFigures("it", "feasibilityForm"),
        note: { title: "Dimensionamento conservativo", text: "Usare uno scenario impegnativo ma plausibile per il controllo tecnico. L’esercizio annuale rappresentativo viene valutato separatamente." },
      },
      {
        id: "results",
        title: "4. Interpretare i risultati di fattibilità",
        intro: "Generale riepiloga la flotta; controlla poi batteria e piano di ricarica di ciascun turno macchina.",
        items: [
          { id: "mean-q95", title: "Come usare Media e Q95 aggregato", text: "In Generale, usa Mostra risultato ottimizzato accanto alle schede per passare da Media a Q95. Media dimensiona la configurazione per il consumo atteso nelle condizioni scelte. Q95 la dimensiona per un profilo rappresentativo ad alto consumo. Confronta l’esito, i pacchi batteria e le prese condivise, poi apri lo stesso turno macchina in entrambe le configurazioni per confrontare il piano di ricarica, il SOC minimo raggiunto e il margine rispetto al limite configurato. Il selettore carica l’intero progetto salvato senza nuovi calcoli e mantiene aperta la scheda. Se il risultato richiesto è in corso, non è riuscito o non è disponibile, resta visibile il progetto già mostrato e compare un messaggio." },
          { title: "Iniziare da Generale", text: "Per una configurazione fattibile: Generale riepiloga tutti i turni macchina analizzati e la batteria scelta più grande. Ogni turno mantiene la propria batteria; tutti partecipano al dimensionamento e condividono l’infrastruttura. Il riquadro GTFS compatto nell’intestazione mostra l’edizione registrata alla creazione; per un risultato storico senza istantanea, la provenienza viene indicata esplicitamente come derivata dai dati correnti del turno." },
          { title: "Controllare ogni turno macchina", text: "Per un turno macchina fisicamente verificato: Il riepilogo mostra consumo Media o Q95 attivo, consumo specifico e valori minimo e massimo del SOC effettivamente raggiunti. Questi sono risultati, mentre Intervallo SOC configurato identifica i limiti applicati nella valutazione. Leggerli insieme a batteria, ricariche pianificate e traiettoria SOC verificata. Le percentuali di SOC si riferiscono alla capacità residua. Le ipotesi della batteria mostrano capacità iniziale, residua e utilizzabile e finestra SOC applicata; kWh utilizzabili = kWh iniziali × SOH × (SOC massimo applicato − SOC minimo applicato). Con 500 kWh e SOH 70% restano 350 kWh: SOC 40–90% dà 175 kWh utilizzabili, mentre l’energia utilizzabile iniziale costante dà 250 kWh a 18,57–90%. L’avviso riguarda solo un minimo applicato sotto il 20%, distinto dal SOC minimo raggiunto. Le tabelle delle previsioni e dell’energia usano lo stesso SOH e la stessa finestra applicata." },
          { title: "Leggere il consumo totale e verificare i limiti SOC", text: "In Batteria e margine energetico, l’istogramma conta le sequenze simulate in base al consumo totale con la massa della batteria selezionata. L’energia ricaricata è conteggiata a parte. Per ogni sequenza Monte Carlo, il modello estrae in modo indipendente un consumo per ogni occorrenza di corsa, anche se la corsa si ripete, e somma i valori sul turno. La linea verticale indica il profilo attivo. Circa il 95% dei totali simulati è pari o inferiore al Q95. ELETTRA usa una sequenza rappresentativa con quel totale. La somma dei Q95 delle singole corse avrebbe un significato diverso. Controlla la curva del SOC rispetto ai due limiti configurati. Tra partenza e arrivo di una corsa la curva è approssimata con una retta. Il 95% riguarda i totali di consumo simulati. Il tooltip del SOC può mostrare a parte la quota di traiettorie simulate che completano il turno entro i limiti SOC con il piano scelto. Nell’esempio Q95 i 62,5 kWh ricaricati in deposito contribuiscono a coprire 539,2 kWh di domanda. Il SOC minimo di 153,3 kWh rimane 13,3 kWh sopra il limite di 140 kWh." },
          { title: "Verificare il piano di ricarica e la ricarica in deposito", text: "Apri Piano di ricarica e controlla luogo, ora e giorno di ogni sessione. Leggi Sosta pianificata, Disponibile per la ricarica ed Energia ricaricata. Dettagli di ricarica indica tempo tecnico, margine per ritardi, tempi attivo e inattivo e potenza media. Un autobus connesso occupa la presa per l’intera sosta. Anche Solo batteria può pianificare ricariche nei limiti dell’infrastruttura installata. Se hai richiesto la verifica della ripartenza il giorno seguente, confronta il SOC alla partenza con il valore obiettivo in Ciclo giornaliero e ricarica in deposito. Per un esito non fattibile, apri Vincoli identificati accanto all’esito o allo stato del turno per vedere la diagnosi disponibile per il deposito. Una diagnosi limitata all’esercizio diurno può mostrare carenze, ma non stabilisce un piano notturno." },
          { title: "Aprire Maggiori informazioni quando serve", text: "Piano di ricarica e Maggiori informazioni sono schede bianche espandibili. Contengono sessioni, dettagli delle previsioni, ipotesi operative, limiti SOC configurati e valori di supporto. Per un dimensionamento verificato, la previsione per la batteria scelta precede quella iniziale di riferimento al massimo fisico. Il ruolo della previsione e il numero di pacchi aiutano a individuare quella usata per verificare la configurazione finale." },
          { id: "resolve-feasibility", title: "Distinguere non fattibilità, calcolo non riuscito e dato indisponibile", text: "Un risultato non fattibile accerta un vincolo tecnico nelle ipotesi selezionate, per esempio la capacità della batteria o l’accesso alle prese. Un calcolo in corso è ancora aperto. Un errore, il superamento del tempo limite o un risultato indisponibile lasciano il profilo senza un esito verificato. Se in Generale la fattibilità è Non determinata e compaiono gli esiti per turno, apri il turno interessato e consulta Come risolvere. Un turno non valido può bloccare la valutazione degli altri. Un esito di fattibilità arancione per la coppia indica che un profilo è fattibile e l’altro no. Leggi l’etichetta per sapere quale ha superato la verifica." },
          { title: "Leggere le stime di batteria nei casi non fattibili", text: "Per una non fattibilità accertata, Generale mostra i turni macchina interessati con pacchi scelti, massimo installabile, fabbisogno stimato e pacchi mancanti rispetto alla batteria scelta. I fabbisogni in rosso superano il massimo fisico; — significa dato non disponibile, non zero. Aprire il nome di un turno per vedere la batteria. I pacchi diagnostici o virtuali rappresentano una carenza, non una batteria installabile verificata. La diagnosi può escludere la ricarica prima della prossima partenza: l’assenza di una carenza di batteria non certifica un ciclo giornaliero completo fattibile. SOC e piani di ricarica diagnostici non sono mostrati come esercizio verificato; i turni fisicamente fattibili mantengono i propri dettagli operativi." },
          { title: "Interpretare il consumo Q95 mancante", text: "Un risultato Q95 tecnicamente non fattibile può contenere valori di consumo. Se nel risultato diagnostico salvato manca il consumo Q95 aggregato, la cella del consumo mostra N/A con un tooltip e il consumo specifico è indicato con —. Entrambi segnalano un valore mancante. I quantili delle singole corse non vengono sommati per ricostruirlo." },
          { title: "Trovare le spiegazioni contestuali", text: "Le icone informative accanto a esito, stima della batteria, legenda e intestazioni dei pacchi stimati o mancanti spiegano vincoli e ambito diagnostico. Anche Valutazione della flotta, Batterie e investimento nei bus, Infrastruttura di ricarica dei turni macchina selezionati e Investimento nell’infrastruttura di ricarica per sito hanno tooltip. Aprirli con mouse, focus da tastiera o tocco; Esc li chiude. Scenario di domanda, modalità di ottimizzazione ed esito condividono l’intestazione della flotta." },
          {"title": "Consultare i dati grezzi di fattibilità", "text": "Visualizza i dati grezzi di fattibilità è sempre disponibile in alto a destra, al posto dell’icona di chiusura, sia in Generale sia nei singoli turni macchina. Il pulsante apre gli input salvati e i dettagli di configurazione in una finestra; chiuderla per tornare ai risultati. I riquadri compatti SOH, Tempi tecnici, Ipotesi HVAC e Orario GTFS nell’intestazione aprono le rispettive ipotesi salvate."},
          {"title": "Esportare la valutazione di fattibilità completa", "text": "In Generale, scegliere Scarica tutti i risultati (JSON) in fondo ai risultati, accanto a Chiudi, come nell’analisi annuale. Il file con schema 1 contiene tutti i turni macchina e i progetti Mean e Aggregate Q95 disponibili, indipendentemente dal profilo visualizzato al clic. Ogni progetto conserva configurazione, investimenti, limiti SOC, piano di ricarica, ID delle previsioni e provenienza registrata. L’infrastruttura viene conteggiata una volta per progetto; Mean e Q95 sono alternative i cui investimenti non vanno sommati. Il download legge i calcoli salvati senza avviare una nuova ottimizzazione."},
          {"title": "Verificare la disponibilità dell’esportazione", "text": "La raccolta mantiene il contesto acquisito al clic. Previsioni mancanti e profili non disponibili, in attesa o falliti sono segnalati esplicitamente in un file parziale; scaricare nuovamente per ritentare il caricamento. Un file parziale non dimostra l’infattibilità; i risultati diagnostici non sono piani di ricarica verificati. Valori predefiniti storici e prezzi correnti usati come ripiego restano identificati. Gli input completi per riprodurre HVAC richiedono il download HVAC separato. Costi ed emissioni annuali appartengono all’esportazione dell’analisi annuale."},
        ],
        figures: getGuideFigures("it", "feasibilityEfficiency", "feasibilitySizing", "infeasibility"),
      },
      {
        id: "yearly",
        title: "5. Analisi annuale",
        intro: "L’analisi annuale mantiene fisso il progetto fattibile di autobus e ricarica. Generale valuta la flotta o un gruppo di bus rappresentativo; ogni turno macchina mostra la propria efficienza annuale.",
        ordered: true,
        items: [
          { title: "Creare un’analisi da una valutazione idonea", text: "Aprire Simulazioni → Analisi annuali → Nuovo. Inserire il Nome, scegliere in Simulazione una valutazione completata, fattibile e idonea con numero di pacchi registrato, e impostare Passeggeri medi a bordo (%). Se sono idonee sia la variante Media sia Q95 aggregato, scegliere quella da analizzare. La valutazione fornisce turni macchina, batterie, ricarica ed edizione GTFS registrata." },
          { title: "Gestire e duplicare le analisi annuali salvate", text: "Ogni riga termina con le icone Visualizza dettagli, Rinomina, Duplica ed Elimina. Duplica apre un nuovo modulo di analisi precompilato con la valutazione di fattibilità di origine e l’occupazione e propone un nome modificabile con i suffissi _copia, _copia_1, _copia_2, ecc., senza ripetere il suffisso; verificare gli input ereditati prima dell’avvio. Usare l’icona Elimina della riga per una sola analisi oppure selezionare più righe e usare l’azione Elimina in alto per un’eliminazione multipla." },
          { title: "Verificare gli input ereditati", text: "Controllare turni macchina, modalità di ottimizzazione, temperatura di dimensionamento, pacchi e capacità. ELETTRA seleziona automaticamente il deposito di riferimento meteo. Gli scenari in sola lettura mostrano le temperature diurne rappresentative (05:00–24:00) e le occorrenze in giorni/anno. Un totale diverso da 365 produce un avviso. Un totale nullo impedisce l’avvio. Scegliere Esegui analisi annuale, controllare il numero di turni, gli scenari e il deposito, quindi scegliere Avvia analisi. Ogni scenario si applica a tutti i turni ereditati. I risultati si aprono automaticamente." },
          { title: "Iniziare da Generale", text: "L’Analisi annuale della flotta mostra distanza, energia DC ai bus, elettricità acquistata, consumo dei turni in kWh/km, TCO elettrico e impatto climatico. Min e Max identificano i turni con il consumo medio più basso e più alto. Bus rappresentativo / Flotta mostra tutta la flotta oppure i valori per autobus di un gruppo con lo stesso modello e la stessa capacità. Le assegnazioni della fattibilità restano valide. L’elettricità acquistata si calcola dall’energia DC con un rendimento di ricarica del 94%. Min e Max indicano su due righe il consumo medio più basso e quello più alto in kWh/km, con il nome del rispettivo turno." },
          { title: "Esaminare Costi ed Emissioni della flotta", text: "Costi mostra TCO, costo annuo equivalente, costi cumulati attualizzati e pareggio. Il segmento viola mostra l’investimento annualizzato, incluse sostituzioni e credito del valore residuo. Gli investimenti in autobus e batterie appartengono integralmente ai veicoli fisici nell’ambito selezionato. Nella valutazione attuale, l’infrastruttura condivisa si conta una volta per la flotta e si ripartisce in base al numero di bus fisici, con una quota uguale per bus rappresentativo. Emissioni mostra fasi del ciclo di vita, indicatori e controlli per Chilometraggi e consumo diesel. Percorrenze e ipotesi fisiche comuni si salvano automaticamente. Il progetto tecnico e i risultati simulati dei turni mantengono i dati originali." },
          { title: "Selezionare un turno macchina", text: "Aprire il turno macchina per leggere energia annuale simulata, distanza e consumo. Il primo grafico mostra il consumo specifico in kWh/km per temperatura. Nel grafico del contributo energetico scegliere kWh/giorno per il giorno tipo o kWh/anno per il contributo ponderato per le occorrenze. Per esempio, 100 kWh/giorno per 40 giorni/anno corrispondono a 4 000 kWh/anno. In Efficienza, aprire Ulteriori informazioni per consultare scenari e batteria." },
          { title: "Leggere l’intervallo di consumo Q05–Q95", text: "Il Monte Carlo campiona il consumo di ogni corsa in modo indipendente, anche fra turni diversi, e somma le corse nello stesso ambito prima di calcolare Q05, Q50 e Q95. L’intervallo centrale del 90% vale per un giorno tipo di ogni scenario di temperatura. In kWh/km si divide per la distanza dello stesso ambito. In kWh/anno si moltiplica l’intervallo per il numero di giorni del gruppo meteo. Il totale annuo è una stima puntuale. La stima resta visibile anche per gli scenari senza intervallo." },
          { title: "Verificare la provenienza meteo e HVAC", text: "I riquadri compatti GTFS e HVAC identificano orario e politica degli ausiliari salvati. L’analisi annuale usa il GHI orario PVGIS nel fuso GTFS locale e riporta energia HVAC in corsa e al capolinea; tracciabilità e azioni JSON espongono ipotesi e input completi di riproduzione. La provenienza registrata identifica l’edizione GTFS usata per la fattibilità. Per le analisi storiche verifica se l’edizione è stata ricostruita dai turni macchina attuali." },
          { title: "Esaminare la configurazione ed esportare da Generale", text: "Visualizza dati di configurazione apre il progetto congelato. In Generale scegliere Scarica tutti i risultati (JSON) vicino a Chiudi. Lo schema 4 include la flotta completa, tutti i gruppi rappresentativi e i turni disponibili, qualunque sia il gruppo selezionato. Conserva la provenienza, i risultati per scenario, l’incertezza e gli ID delle previsioni disponibili, oltre alle ipotesi effettive e all’attività modificata separata dalla simulazione originale. Le analisi storiche prive dell’investimento di flotta congelato mantengono lo schema 3. Quando mostrano costi per turno, possono ripartire l’infrastruttura in base all’energia DC annuale." },
          { title: "Controllare lo stato del salvataggio prima di chiudere", text: "Il JSON completo descrive la valutazione corrente e indica se le sue ipotesi sono state salvate. Salvataggi in attesa o falliti restano espliciti nel file. Chiudi attende il salvataggio; un errore o un input non valido mantiene aperta la pagina per correggere il valore o riprovare il salvataggio prima di riaprire l’analisi." },
          { title: "Scaricare i risultati ambientali correnti", text: "Il download separato in Emissioni segue l’ambito selezionato: flotta o bus rappresentativo. È abilitato solo quando la valutazione corrente è pronta. Durante un aggiornamento o dopo un errore, il JSON completo distingue eventuali risposte precedenti dai risultati correnti. Usare Riprova dopo un aggiornamento fallito. I turni macchina rimandano alla valutazione ambientale del proprio gruppo rappresentativo; l’esportazione non inventa impatti indipendenti per turno." },
          { title: "Riconoscere i risultati storici solo aggregati", text: "Un’analisi precedente priva del dettaglio per turno macchina può mostrare soltanto Generale. ELETTRA lascia assenti i dettagli non disponibili invece di ricavarli artificialmente dai totali." },
          {"title": "Impostare la manutenzione della ricarica", "text": "In Costi → Modifica ipotesi economiche → Parametri economici aggiuntivi, scegliere una percentuale annua dell’investimento di ricarica oppure un importo fisso in CHF/anno. La percentuale è modificabile: il valore iniziale è 2%/anno, con riferimento all’intervallo INFRAS 2026 del 2–5%. Non significa CHF 2/anno. Verificare metodo salvato e unità, soprattutto nelle analisi storiche; un importo fisso pari a zero esclude il costo di manutenzione dell’infrastruttura. La percentuale si applica all’investimento completo della ricarica, con manutenzione conteggiata una volta per flotta, esclusi autobus e batterie; il tooltip spiega questa ipotesi di modello."},
          {"title": "Leggere il perimetro di calcolo", "text": "In Modifica ipotesi economiche verificare prezzo dell’elettricità in CHF/kWh rete, prezzo del diesel in CHF/l, consumo diesel in l/km, manutenzione dei bus in CHF/km e km annui per bus. Parametri economici aggiuntivi indica orizzonte e durate in anni, tasso di attualizzazione in percentuale e prezzo d’acquisto diesel in CHF/bus. Metodo di calcolo e perimetro spiega le ipotesi comuni alle due tecnologie e come si tratta il valore residuo."},
        ],
        figures: getGuideFigures("it", "yearlyTemperature", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Non ridimensionare qui il veicolo", text: "L’analisi annuale rappresenta l’esercizio del progetto scelto nella valutazione di fattibilità. Tornare alla fattibilità se occorre cambiare veicolo, batteria o ricarica." },
      },
      {
        id: "comparison",
        title: "6. Confrontare ed esportare le analisi",
        intro: "Il confronto è più utile quando le alternative differiscono per una decisione o un’ipotesi chiaramente identificata.",
        items: [
          { title: "Selezionare due analisi annuali", text: "Aprire Simulazioni → Confronto analisi e scegliere Analisi A e Analisi B. Compatibile richiede lo stesso insieme non vuoto di turni macchina e la stessa modalità di ottimizzazione. Un turno in comune, lo stesso numero di turni o la stessa modalità possono dare Parzialmente comparabile. L’indicazione aiuta a interpretare i risultati, che restano visibili se disponibili." },
          { title: "Confrontare indicatori coerenti", text: "Panoramica, Efficienza, Costo ed Emissioni confrontano Generale. La differenza assoluta è B − A. La differenza relativa usa A come denominatore e richiede A diverso da zero. Verificare distanza, edizione GTFS, meteo e ipotesi. Efficienza usa i totali di simulazione salvati. Costo usa il calcolo annuale del confronto ed Emissioni una valutazione di flotta. Per confrontare tariffe o percorrenze modificate, prendere gli stessi ambiti e campi dai JSON annuali completi delle due analisi." },
          { title: "Esportare le evidenze", text: "In Dettagli / Export, Esporta CSV fornisce valori A/B, differenze e completezza. Esporta JSON conserva i modelli per Generale, i controlli di compatibilità e le metriche. Per gruppi, risultati tecnici per turno, ipotesi effettive e costi dettagliati, aprire ciascuna analisi e scegliere Scarica tutti i risultati (JSON) in Generale." },
        ],
        figures: getGuideFigures("it", "comparison"),
        note: { title: "Nominare chiaramente gli scenari", text: "Includere nel nome salvato la differenza principale, ad esempio veicolo, riscaldamento, occupazione o strategia di ricarica." },
      },
      {
        id: "start",
        title: "Account, lingua e navigazione",
        intro: "La guida è pubblica, ma i dati della flotta e le analisi richiedono un account ELETTRA.",
        items: [
          { id: "registration", title: "Accedere o creare un account", text: "Durante la registrazione scegli l’azienda di trasporto dall’elenco dei suggerimenti. Una volta creato l’account, accedi per aprire la Home. Durante la registrazione, l’anteprima CARTO usa l’ultima edizione GTFS disponibile e mostra tutte le linee disegnabili con il relativo numero per aiutare a confermare l’azienda. La mappa è indicativa e i percorsi sono semplificati: non va utilizzata come riferimento dettagliato della rete." },
          { title: "Scegliere la lingua dell’interfaccia", text: "Usare il selettore della lingua nell’intestazione dell’applicazione. Sono disponibili inglese, tedesco, francese e italiano; la preferenza viene memorizzata nel browser." },
          { title: "Usare la navigazione principale", text: "Home spiega il flusso di pianificazione e collega direttamente le sei sezioni operative. Flotta contiene Autobus, Fermate personalizzate e Turni macchina; Simulazioni contiene Valutazione di fattibilità, Analisi annuali e Confronto analisi. La guida utente resta disponibile in fondo alla barra laterale. Ogni scheda della Home apre uno strumento. Il collegamento Leggi la guida apre direttamente il relativo capitolo in una nuova scheda." },
        ],
        figures: getGuideFigures("it", "shell"),
      },
      {
        id: "practice",
        title: "Ipotesi, limiti e buone pratiche",
        intro: "La qualità di una prefattibilità dipende dalla qualità e dalla coerenza delle ipotesi.",
        items: [
          { title: "Sostituire i valori predefiniti quando possibile", text: "Usare dati dell’operatore, del costruttore, delle tariffe e delle infrastrutture. Registrare fonte e data al di fuori di ELETTRA quando il valore è importante per una decisione." },
          { title: "Separare le domande tecniche da quelle annuali", text: "Usare la valutazione di fattibilità per la condizione tecnica impegnativa e l’analisi annuale per energia, costi ed emissioni rappresentativi." },
          { title: "Confrontare scenari coerenti", text: "Mantenere coerenti perimetro del servizio, distanza annuale e confini dell’analisi. Usare gli avvisi di compatibilità dell’applicazione." },
          { title: "Approfondire prima dell’implementazione", text: "Usare ELETTRA per identificare configurazioni promettenti e ipotesi sensibili. Confermare acquisti, rete elettrica, caricatori, deposito, opere civili e decisioni operative mediante studi specialistici." },
        ],
        note: { title: "Perimetro della valutazione", text: "ELETTRA è uno strumento di pianificazione e prefattibilità. Un risultato fattibile dipende dalle ipotesi selezionate per servizio, veicolo, meteo, occupazione, batteria e ricarica; non costituisce una certificazione operativa." },
      },
      {
        id: "api",
        title: "API pubblica",
        items: [
          {
            id: "api-docs",
            title: "Consultare la documentazione pubblica dell’API",
            text: "Apri /docs sul server ELETTRA per consultare gli endpoint, i parametri e le risposte in Swagger UI. Lo schema OpenAPI è disponibile su /openapi.json. Entrambi sono consultabili senza accedere. Per eseguire operazioni protette serve un account autorizzato. I collegamenti portano al servizio pubblico ELETTRA.",
            links: publicApiLinks,
          },
        ],
      },
    ],
  },
};
