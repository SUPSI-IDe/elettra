import { useCaseSections } from "./use-cases.js";

export const GUIDE_BASELINE_VERSION = "0.11.0";
export const GUIDE_UPDATED_AT = "13 November 2026";

export const SUPPORTED_GUIDE_LANGUAGES = ["en", "de", "fr", "it"];

const applicationShellImage = new URL("./images/application-shell.png", import.meta.url).href;
const customStopImage = new URL("./images/custom-stop.png", import.meta.url).href;
const shiftVisualisationImage = new URL("./images/shift-visualisation.png", import.meta.url).href;
const feasibilityFormImage = new URL("./images/feasibility-form.png", import.meta.url).href;
const feasibilityEfficiencyImage = new URL("./images/feasibility-efficiency.png", import.meta.url).href;
const feasibilitySizingImage = new URL("./images/feasibility-sizing.png", import.meta.url).href;
const yearlyEfficiencyImage = new URL("./images/yearly-efficiency.png", import.meta.url).href;
const yearlyEmissionsImage = new URL("./images/yearly-emissions.png", import.meta.url).href;

const GUIDE_FIGURES = {
  shell: {
    src: applicationShellImage,
    captions: {
      en: "Authenticated Home with direct links to the six planning sections. Home, Fleet, Simulations and the user guide remain available from the sidebar.",
      de: "Authentifizierte Startseite mit direkten Links zu den sechs Planungsbereichen. Startseite, Flotte, Simulationen und Benutzerhandbuch bleiben über die Seitenleiste erreichbar.",
      fr: "Accueil authentifié avec des liens directs vers les six sections de planification. Accueil, Flotte, Simulations et le guide restent accessibles dans la barre latérale.",
      it: "Home autenticata con collegamenti diretti alle sei sezioni di pianificazione. Home, Flotta, Simulazioni e guida utente restano disponibili nella barra laterale.",
    },
  },
  customStop: {
    src: customStopImage,
    captions: {
      en: "Editing a legacy custom stop: recovered location fields remain editable and a current stop type can be assigned before saving.",
      de: "Bearbeitung einer älteren benutzerdefinierten Haltestelle: wiederhergestellte Ortsfelder bleiben editierbar und vor dem Speichern kann ein aktueller Typ zugewiesen werden.",
      fr: "Modification d’un ancien arrêt personnalisé: les champs de lieu récupérés restent modifiables et un type actuel peut être attribué avant l’enregistrement.",
      it: "Modifica di una fermata personalizzata storica: i campi recuperati restano modificabili e prima del salvataggio si può assegnare un tipo attuale.",
    },
  },
  shift: {
    src: shiftVisualisationImage,
    captions: {
      en: "Vehicle block visualisation with general information and the default space-time diagram. The toggle also opens a trip-by-trip map; depot connections are included in both views.",
      de: "Visualisierung eines Fahrzeugumlaufs mit allgemeinen Informationen und dem standardmässigen Raum-Zeit-Diagramm. Über den Umschalter lässt sich auch eine Karte für jede einzelne Fahrt öffnen; Depotverbindungen sind in beiden Ansichten enthalten.",
      fr: "Visualisation d’un service voiture avec ses informations générales et le diagramme espace-temps affiché par défaut. Le sélecteur ouvre aussi une carte course par course; les liaisons au dépôt figurent dans les deux vues.",
      it: "Visualizzazione di un turno macchina con informazioni generali e diagramma spazio-tempo predefinito. Il selettore apre anche la mappa corsa per corsa; i collegamenti al deposito sono inclusi in entrambe le viste.",
    },
  },
  feasibilityForm: {
    src: feasibilityFormImage,
    captions: {
      en: "Feasibility form with the selected GTFS timetable, compatible vehicle blocks and the environmental, state-of-charge and optimisation assumptions.",
      de: "Machbarkeitsformular mit gewähltem GTFS-Fahrplan, kompatiblen Fahrzeugumläufen sowie Umwelt-, Ladezustands- und Optimierungsannahmen.",
      fr: "Formulaire de faisabilité avec l’horaire GTFS choisi, les services voiture compatibles et les hypothèses d’environnement, d’état de charge et d’optimisation.",
      it: "Modulo di fattibilità con orario GTFS selezionato, turni macchina compatibili e ipotesi ambientali, di stato di carica e ottimizzazione.",
    },
  },
  feasibilityEfficiency: {
    src: feasibilityEfficiencyImage,
    captions: {
      en: "General feasibility view with compact recorded GTFS provenance, the common battery configuration and shared charging infrastructure.",
      de: "Allgemeine Machbarkeitsansicht mit kompakter aufgezeichneter GTFS-Herkunft, gemeinsamer Batteriekonfiguration und geteilter Ladeinfrastruktur.",
      fr: "Vue Général de la faisabilité avec provenance GTFS enregistrée compacte, batterie commune et infrastructure de recharge partagée.",
      it: "Vista Generale della fattibilità con provenienza GTFS registrata e compatta, configurazione comune della batteria e infrastruttura condivisa.",
    },
  },
  feasibilitySizing: {
    src: feasibilitySizingImage,
    captions: {
      en: "A vehicle-block result with active Mean/Q95 consumption, reached SOC values, visual energy analysis and expandable charging details.",
      de: "Ergebnis eines Fahrzeugumlaufs mit aktivem Mittelwert-/Q95-Verbrauch, erreichten SOC-Werten, visueller Energieanalyse und aufklappbaren Ladedetails.",
      fr: "Résultat d’un service voiture avec consommation moyenne/Q95 active, SOC atteints, analyse énergétique visuelle et détails de recharge dépliables.",
      it: "Risultato di un turno macchina con consumo Media/Q95 attivo, valori SOC raggiunti, analisi energetica visiva e dettagli di ricarica espandibili.",
    },
  },
  yearlyEfficiency: {
    src: yearlyEfficiencyImage,
    captions: {
      en: "General yearly-analysis scope with the compact fleet summary and Costs view for the fleet or a representative bus group.",
      de: "Allgemeiner Bereich der Jahresanalyse mit kompakter Flottenübersicht und Kostenansicht für die Flotte oder eine repräsentative Busgruppe.",
      fr: "Périmètre Général de l’analyse annuelle avec le résumé compact et la vue Coûts de la flotte ou d’un groupe de bus représentatif.",
      it: "Ambito Generale dell’analisi annuale con riepilogo compatto e vista Costi della flotta o di un gruppo di bus rappresentativo.",
    },
  },
  yearlyEmissions: {
    src: yearlyEmissionsImage,
    captions: {
      en: "Fleet Emissions view with lifecycle-phase bars and the expandable activity and diesel-consumption controls below the charts.",
      de: "Emissionsansicht der Flotte mit Balken nach Lebenszyklusphase und den aufklappbaren Reglern für Fahrleistung und Dieselverbrauch unter den Diagrammen.",
      fr: "Vue Émissions de la flotte avec barres par phase du cycle de vie et réglages dépliables du kilométrage et de la consommation diesel sous les graphiques.",
      it: "Vista Emissioni della flotta con barre per fase del ciclo di vita e controlli espandibili di chilometraggi e consumo diesel sotto i grafici.",
    },
  },
};

const getGuideFigures = (language, ...keys) => keys.map((key) => ({
  src: GUIDE_FIGURES[key].src,
  caption: GUIDE_FIGURES[key].captions[language] ?? GUIDE_FIGURES[key].captions.en,
}));

export const guideContent = {
  en: {
    ui: {
      documentTitle: "ELETTRA user guide",
      backToApp: "Back to ELETTRA",
      languageLabel: "Language",
      languageAriaLabel: "Guide language",
      print: "Print guide",
      contents: "Guide contents",
      eyebrow: "User documentation",
      title: "ELETTRA user guide",
      introduction:
        "A concise, task-oriented guide to preparing a bus service, checking technical feasibility and interpreting yearly energy, cost and environmental results.",
      baselineLabel: "Interface baseline",
      baselineValue: `Frontend v${GUIDE_BASELINE_VERSION}`,
      updatedLabel: "Guide updated",
      updatedValue: GUIDE_UPDATED_AT,
      footer:
        "ELETTRA supports pre-feasibility studies. Confirm final vehicle, charging, grid and infrastructure decisions through detailed engineering.",
      skipLink: "Skip to the guide",
      sidebarAriaLabel: "Guide contents",
      brandAriaLabel: "ELETTRA user guide",
      screenshotNote: "The screenshots show examples from different supported interface languages.",
      openImage: "Open full-size screenshot",
    },
    sections: [
      useCaseSections.en,
      {
        id: "start",
        title: "1. Getting started",
        intro:
          "The guide is public, but fleet data and analyses require an ELETTRA account.",
        items: [
          {
            title: "Choose the interface language",
            text: "Use the language selector in the application header. English, German, French and Italian are available, and the preference is retained in the browser.",
          },
          {
            title: "Sign in or create an account",
            text: "Open ELETTRA from the link above. Sign in with an existing account or create one and select the appropriate transport company when requested. During registration, the CARTO preview uses the latest available GTFS edition and shows every drawable line with its number to help confirm the company. The map is indicative and its routes are simplified, so it should not be used as a detailed network reference.",
          },
          {
            title: "Use the main navigation",
            text: "Home explains the planning workflow and links to all six working sections. Fleet contains Bus Models, Custom Stops and Vehicle blocks. Simulations contains Feasibility evaluation, Yearly analyses and Analysis comparison; the user guide remains at the bottom of the sidebar.",
          },
        ],
        figures: getGuideFigures("en", "shell"),
        note: {
          title: "Assessment boundary",
          text: "ELETTRA is a planning and pre-feasibility tool. A feasible result is conditional on the selected service, vehicle, weather, occupancy, battery and charging assumptions; it is not an operational certificate.",
        },
      },
      {
        id: "workflow",
        title: "2. Recommended workflow",
        intro:
          "Complete the steps in sequence so that every analysis has a traceable vehicle, service and scenario basis.",
        ordered: true,
        items: [
          {
            title: "Create a bus model",
            text: "Describe the candidate bus, including its vehicle category, capacity, mass, battery-pack limits, charging power, costs and lifetimes.",
          },
          {
            title: "Create required custom stops",
            text: "Add depots, charging locations or hubs that are not represented by the scheduled public-transport stops.",
          },
          {
            title: "Build a vehicle block",
            text: "Select scheduled trips, define the start and return locations, and check the ordered vehicle block and auxiliary movements.",
          },
          {
            title: "Run a feasibility evaluation",
            text: "Select one or more vehicle blocks, choose the optimisation mode and set the operating and charging assumptions.",
          },
          {
            title: "Check the technical gate",
            text: "Review the feasibility verdict, predicted demand, usable battery energy, required packs and charging results before continuing.",
          },
          {
            title: "Create, compare and export yearly analyses",
            text: "Reuse a feasible design across representative temperature scenarios, inspect annual indicators and compare saved alternatives.",
          },
        ],
      },
      {
        id: "fleet",
        title: "3. Bus models and custom stops",
        intro:
          "Reusable fleet and location records provide the technical inputs for vehicle blocks and evaluations.",
        items: [
          {
            title: "Bus models",
            text: "Open Fleet → Bus Models and select Add Bus Model. Choose a vehicle category to initialise representative values, then review every required technical and economic field before saving. Defaults remain editable and should be replaced when operator or manufacturer data are available.",
          },
          {
            title: "Battery limits",
            text: "Minimum and maximum pack counts, pack capacity and pack mass define the battery configurations the feasibility calculation may use. Maximum charging power limits the power accepted by the vehicle.",
          },
          {
            title: "Custom stops",
            text: "Open Fleet → Custom Stops and select the stop type. Enter an address or coordinates, or position the point with the map. The Details action opens a consistent read-only dialog; Edit also supports older custom stops whose saved data predate the current form. Use clear names that distinguish depots, charging locations and hubs.",
          },
        ],
        figures: getGuideFigures("en", "customStop"),
        note: {
          title: "Before editing or deleting",
          text: "Reusable records may be referenced by vehicle blocks or analyses. Review dependent work before changing a record that has already been used.",
        },
      },
      {
        id: "shifts",
        title: "4. Building a vehicle block",
        intro:
          "A vehicle block is the ordered sequence of trips and depot connections assigned to one bus, evaluated for the selected bus model.",
        ordered: true,
        items: [
          {
            title: "Open Fleet → Vehicle blocks and create a vehicle block",
            text: "Give the vehicle block a recognisable name and select the candidate bus model.",
          },
          {
            title: "Choose the GTFS timetable",
            text: "A new vehicle block starts with the newest available GTFS edition. Select the edition before choosing a line and day; changing it after adding trips asks for confirmation and clears the selected trips. The saved edition becomes part of the block’s provenance.",
          },
          {
            title: "Filter and add scheduled trips",
            text: "Use the line and day filters, then add the required scheduled trips in their operating order. The list contains only trips from the selected GTFS edition.",
          },
          {
            title: "Define the vehicle block boundaries",
            text: "Select the start and return locations and their times. ELETTRA includes the connecting auxiliary movements needed to represent the complete vehicle block.",
          },
          {
            title: "Check and save",
            text: "Review the trip sequence, timeline, distance and map/elevation context. Correct gaps or implausible timing before saving the vehicle block.",
          },
          {
            title: "Find or duplicate saved vehicle blocks",
            text: "Search checks the complete server-side list before pagination, so a match remains discoverable beyond the current page. Select one or more blocks and use Duplicate to copy their trips, bus model and recorded GTFS edition before editing the copies.",
          },
          {
            title: "Visualise a saved vehicle block",
            text: "Open Visualise/Details to review the general information and the complete movement chain. Space-time is the default view: time runs horizontally, stops vertically, multi-line work is separated by route, and depot connections are dashed. Switch to Map to inspect one movement at a time, including its stops and times, with First, Previous, Next and Last. A warning identifies discontinuities caused by missing transfer data rather than drawing an invented connection.",
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
        title: "5. Feasibility evaluation",
        intro:
          "The feasibility evaluation couples predicted energy demand with battery and charging decisions.",
        ordered: true,
        items: [
          {
            title: "Choose the GTFS timetable and vehicle blocks",
            text: "Open Simulations → Feasibility evaluation and create a new evaluation. Select one GTFS edition first; the table then shows only compatible vehicle blocks. Blocks that mix historical editions are excluded from new evaluations and changing the edition clears the current selection.",
          },
          {
            title: "Choose an optimisation mode",
            text: "Battery only varies the pack configuration; Charging keeps the battery configuration fixed and evaluates charging infrastructure; Joint evaluates battery and charging decisions together.",
          },
          {
            title: "Set the scenario",
            text: "Review external temperature, occupancy, heating configuration, usable state-of-charge window and any advanced service parameters. Configure candidate charging locations when required by the selected mode. The bus-model choice follows the selected blocks and remains stable while other inputs are edited.",
          },
          {
            title: "Duplicate an evaluation safely",
            text: "From the evaluation list, select exactly one run and choose Duplicate. ELETTRA restores its blocks, bus model, battery references, SOC limits, charging constraints and costs, forecast settings and solver options. Duplication is cancelled rather than submitting a partial copy when original resources or compatible forecasts are unavailable; previously incorrect historical copies still require review and recalculation.",
          },
          {
            title: "Run and wait for completion",
            text: "The evaluation is saved as a named run. Progress and execution status are shown in the application; do not interpret an unfinished run as a result.",
          },
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
        title: "6. Interpreting feasibility results",
        intro: "Use General for the fleet summary and shared infrastructure, then check the battery and charging plan of each vehicle block.",
        items: [
          {
            title: "Start with General",
            text: "General summarizes all analyzed vehicle blocks and the largest selected battery. Each vehicle block retains its own selected battery; all vehicle blocks participate in sizing and share the charging infrastructure. The compact GTFS disclosure in the header shows the edition recorded when the evaluation was created; historical results without a snapshot are explicitly derived from current block data.",
          },
          {
            title: "Check every vehicle block tab",
            text: "Each vehicle block summary shows the active Mean or Q95 consumption and specific consumption, plus the minimum and maximum SOC actually reached. These reached values are outcomes, while Configured SOC window identifies the limits entered in the evaluation. Read them with nominal and usable capacity, selected packs, planned charging and the verified trajectory.",
          },
          {
            title: "Read visual analysis and energy adequacy together",
            text: "New evaluations calculate Mean and Aggregate Q95 together. The selector opens the complete optimized design for that profile, including battery, chargers and charging schedule, without starting another calculation. In More information, the forecast for the selected and verified battery is listed directly before the initial physical-maximum reference, making their roles and pack counts explicit. Q95 of total consumption is not a 95% guarantee of trajectory feasibility.",
          },
          {
            title: "Inspect the charging plan",
            text: "For Charging and Joint evaluations, verify where and when each session occurs, its duration, delivered energy and average power. Battery-only evaluations can show a fixed or absent charging plan instead of an optimised one.",
          },
          {
            title: "Open More information when needed",
            text: "Charging plan and More information are expandable white cards. Use them for sessions, prediction details, operating assumptions, configured SOC limits and supporting values. If any vehicle block fails, revise the vehicle, state-of-charge window, scenario or charging design and run a separately named evaluation.",
          },
          {
            title: "Distinguish infeasible from not determined",
            text: "Infeasible means that the optimisation completed and rejected the design. Not determined means that the calculation stopped before producing a feasibility verdict. General lists the outcome of every selected vehicle block; each vehicle-block tab identifies the reason, any blocking vehicle block and translated How to resolve guidance. Correct the indicated source data or configuration, then run a new evaluation. One invalid vehicle block can prevent the others from being evaluated without making them infeasible.",
          },
        ],
        figures: getGuideFigures("en", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Yearly analysis",
        intro:
          "A yearly analysis keeps the feasible bus and charging design fixed. General assesses the fleet or a representative bus group; each vehicle block shows its own annual efficiency.",
        ordered: true,
        items: [
          {
            title: "Create an analysis from an eligible evaluation",
            text: "Open Simulations → Yearly analyses, create a new analysis and select the completed feasibility evaluation that defines the vehicle, vehicle blocks, battery, charging design and GTFS edition. The annual result preserves that recorded provenance rather than silently following later changes to a block.",
          },
          {
            title: "Review the inherited inputs",
            text: "Check the selected evaluation, operating assumptions, representative temperatures and their occurrences before starting. Temperature scenarios change consumption estimates; they do not resize the battery, change the charging infrastructure or repeat the feasibility decision.",
          },
          {
            title: "Start with General",
            text: "The compact Annual fleet assessment shows distance, bus-side and grid energy, minimum/maximum vehicle-block efficiency, electric TCO and climate impact. Use Representative bus / Fleet to inspect the complete fleet or a group sharing the same model and battery size; feasibility assignments do not change.",
          },
          {
            title: "Review Costs and Emissions for the fleet",
            text: "Costs combines a compact TCO row, annual and cumulative charts, break-even and detailed tables. Bus and battery CAPEX belongs in full to the physical vehicles in scope; shared charging infrastructure is counted once for the fleet and only its cost is allocated to representative bus groups by annual DC energy. Emissions shows lifecycle-phase bars and environmental indicators. Their expandable assumption controls sit below the charts, share automatically saved values and never rerun feasibility.",
          },
          {
            title: "Select a vehicle block",
            text: "A compact white row immediately below the scope selector reports yearly energy, simulated distance and average efficiency. The Efficiency view then shows temperature-dependent consumption, uncertainty and occurrence-weighted energy directly, without a redundant single-item tab.",
          },
          {
            title: "Check weather and HVAC provenance",
            text: "The compact GTFS and HVAC disclosures identify the saved timetable and auxiliary-energy policy. Yearly HVAC uses hourly PVGIS GHI in the local GTFS timezone and reports trip and terminal energy; the traceability section and JSON actions expose the assumptions and complete reproduction inputs.",
          },
          {
            title: "Inspect the configuration and export from General",
            text: "Use View configuration data for the frozen design. Download all results is available only in General, next to Close, and saves General plus a separate entry for every available vehicle block.",
          },
          {
            title: "Recognise aggregate-only historical results",
            text: "An older analysis that contains no per-vehicle block breakdown can show General only. ELETTRA leaves unavailable vehicle block details absent instead of inventing them from aggregate totals.",
          },
        ],
        figures: getGuideFigures("en", "yearlyEfficiency", "yearlyEmissions"),
        note: {
          title: "Do not resize the vehicle here",
          text: "Yearly analysis represents operation of the design selected at the feasibility gate. Return to feasibility evaluation if the vehicle, battery or charging design must change.",
        },
      },
      {
        id: "comparison",
        title: "8. Comparing and exporting analyses",
        intro:
          "Comparison is most useful when alternatives differ by one clearly identified decision or assumption.",
        items: [
          {
            title: "Select two yearly analyses",
            text: "Open Simulations → Analysis comparison and choose Analysis A and Analysis B. The compatibility summary identifies whether the cases can be compared directly.",
          },
          {
            title: "Compare consistent indicators",
            text: "Review the same Overview, Efficiency, Cost and Emissions categories for both analyses. When vehicle block sets or assumptions differ, interpret aggregate differences with care.",
          },
          {
            title: "Export evidence",
            text: "Use the Details / Export area to export comparison data as CSV or JSON.",
          },
        ],
        note: {
          title: "Name scenarios clearly",
          text: "Include the principal difference in each saved name, for example the vehicle, heating configuration, occupancy assumption or charging strategy.",
        },
      },
      {
        id: "practice",
        title: "9. Interpretation and good practice",
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
      },
    ],
  },

  de: {
    ui: {
      documentTitle: "ELETTRA-Benutzerhandbuch",
      backToApp: "Zurück zu ELETTRA",
      languageLabel: "Sprache",
      languageAriaLabel: "Sprache des Handbuchs",
      print: "Handbuch drucken",
      contents: "Inhalt des Handbuchs",
      eyebrow: "Benutzerdokumentation",
      title: "ELETTRA-Benutzerhandbuch",
      introduction:
        "Ein kompaktes, aufgabenorientiertes Handbuch zur Vorbereitung eines Busbetriebs, zur Prüfung der technischen Machbarkeit und zur Interpretation der jährlichen Energie-, Kosten- und Umweltergebnisse.",
      baselineLabel: "Stand der Benutzeroberfläche",
      baselineValue: `Frontend v${GUIDE_BASELINE_VERSION}`,
      updatedLabel: "Handbuch aktualisiert",
      updatedValue: "13. November 2026",
      footer:
        "ELETTRA unterstützt Vorstudien. Endgültige Fahrzeug-, Lade-, Netz- und Infrastrukturentscheidungen müssen durch eine detaillierte Fachplanung bestätigt werden.",
      skipLink: "Zum Handbuch springen",
      sidebarAriaLabel: "Inhalt des Handbuchs",
      brandAriaLabel: "ELETTRA-Benutzerhandbuch",
      screenshotNote: "Die Screenshots zeigen Beispiele in verschiedenen unterstützten Oberflächensprachen.",
      openImage: "Screenshot in voller Grösse öffnen",
    },
    sections: [
      useCaseSections.de,
      {
        id: "start",
        title: "1. Erste Schritte",
        intro:
          "Das Handbuch ist öffentlich zugänglich; Flottendaten und Analysen erfordern jedoch ein ELETTRA-Konto.",
        items: [
          {
            title: "Sprache der Benutzeroberfläche wählen",
            text: "Verwenden Sie die Sprachauswahl in der Kopfzeile der Anwendung. Englisch, Deutsch, Französisch und Italienisch stehen zur Verfügung; die Auswahl wird im Browser gespeichert.",
          },
          {
            title: "Anmelden oder Konto erstellen",
            text: "Öffnen Sie ELETTRA über den obigen Link. Melden Sie sich mit einem bestehenden Konto an oder erstellen Sie ein Konto und wählen Sie bei Bedarf das zuständige Transportunternehmen. Bei der Registrierung verwendet die CARTO-Vorschau die neueste verfügbare GTFS-Ausgabe und zeigt alle darstellbaren Linien mit ihren Nummern, um die Auswahl zu bestätigen. Die Karte dient nur zur Orientierung und stellt die Linien vereinfacht dar; sie ist keine detaillierte Netzreferenz.",
          },
          {
            title: "Hauptnavigation verwenden",
            text: "Die Startseite erklärt den Planungsablauf und verlinkt alle sechs Arbeitsbereiche. Unter Flotte finden Sie Busmodelle, benutzerdefinierte Haltestellen und Fahrzeugumläufe, unter Simulationen Machbarkeitsbewertung, Jahresanalysen und Analysenvergleich; das Benutzerhandbuch bleibt unten in der Seitenleiste erreichbar.",
          },
        ],
        figures: getGuideFigures("de", "shell"),
        note: {
          title: "Grenzen der Bewertung",
          text: "ELETTRA ist ein Planungs- und Vorstudienwerkzeug. Ein machbares Ergebnis gilt nur für die gewählten Betriebs-, Fahrzeug-, Wetter-, Belegungs-, Batterie- und Ladeannahmen und ist kein Betriebsnachweis.",
        },
      },
      {
        id: "workflow",
        title: "2. Empfohlener Arbeitsablauf",
        intro:
          "Führen Sie die Schritte der Reihe nach aus, damit jede Analyse auf einer nachvollziehbaren Fahrzeug-, Betriebs- und Szenariogrundlage beruht.",
        ordered: true,
        items: [
          { title: "Busmodell erstellen", text: "Beschreiben Sie den vorgesehenen Bus mit Fahrzeugkategorie, Kapazität, Masse, Batteriegrenzen, Ladeleistung, Kosten und Lebensdauern." },
          { title: "Erforderliche benutzerdefinierte Haltestellen erstellen", text: "Erfassen Sie Depots, Ladeorte oder Knoten, die nicht durch reguläre ÖV-Haltestellen abgebildet werden." },
          { title: "Fahrzeugumlauf aufbauen", text: "Wählen Sie Fahrplanfahrten, Start- und Rückkehrort und prüfen Sie den geordneten Fahrzeugumlauf einschliesslich Leerfahrten." },
          { title: "Machbarkeitsbewertung durchführen", text: "Wählen Sie einen oder mehrere Fahrzeugumläufe, den Optimierungsmodus sowie Betriebs- und Ladeannahmen." },
          { title: "Technischen Entscheidungspunkt prüfen", text: "Prüfen Sie Machbarkeit, Energiebedarf, nutzbare Batterieenergie, erforderliche Packs und Ladeergebnisse, bevor Sie fortfahren." },
          { title: "Jahresanalysen erstellen, vergleichen und exportieren", text: "Bewerten Sie das machbare Design unter repräsentativen Temperaturen, prüfen Sie Jahresindikatoren und vergleichen Sie gespeicherte Alternativen." },
        ],
      },
      {
        id: "fleet",
        title: "3. Busmodelle und benutzerdefinierte Haltestellen",
        intro: "Wiederverwendbare Fahrzeug- und Ortsdaten liefern die technischen Eingaben für Fahrzeugumläufe und Bewertungen.",
        items: [
          { title: "Busmodelle", text: "Öffnen Sie Flotte → Busmodelle und wählen Sie Busmodell hinzufügen. Eine Fahrzeugkategorie liefert Ausgangswerte; prüfen Sie danach alle technischen und wirtschaftlichen Pflichtfelder. Ersetzen Sie Standardwerte durch Betreiber- oder Herstellerdaten, wenn diese verfügbar sind." },
          { title: "Batteriegrenzen", text: "Minimale und maximale Packzahl, Packkapazität und Packmasse definieren die zulässigen Batteriekonfigurationen. Die maximale Ladeleistung begrenzt die vom Fahrzeug aufnehmbare Leistung." },
          { title: "Benutzerdefinierte Haltestellen", text: "Öffnen Sie Flotte → Benutzerdefinierte Haltestellen und wählen Sie den Typ. Geben Sie Adresse oder Koordinaten ein oder setzen Sie den Punkt auf der Karte. Details öffnet einen einheitlichen schreibgeschützten Dialog; Bearbeiten unterstützt auch ältere Haltestellen, deren gespeicherte Daten dem aktuellen Formular vorausgehen. Verwenden Sie eindeutige Namen für Depots, Ladeorte und Knoten." },
        ],
        figures: getGuideFigures("de", "customStop"),
        note: { title: "Vor Bearbeiten oder Löschen", text: "Wiederverwendbare Datensätze können von Fahrzeugumläufen oder Analysen referenziert werden. Prüfen Sie abhängige Arbeiten, bevor Sie einen bereits verwendeten Datensatz ändern." },
      },
      {
        id: "shifts",
        title: "4. Fahrzeugumlauf aufbauen",
        intro: "Ein Fahrzeugumlauf stellt den vollständigen, geordneten Tagesumlauf dar, der für ein Busmodell bewertet wird.",
        ordered: true,
        items: [
          { title: "Flotte → Fahrzeugumläufe öffnen und Fahrzeugumlauf erstellen", text: "Vergeben Sie einen verständlichen Namen und wählen Sie das vorgesehene Busmodell." },
          { title: "GTFS-Fahrplan wählen", text: "Ein neuer Fahrzeugumlauf verwendet zunächst die neueste verfügbare GTFS-Ausgabe. Wählen Sie die Ausgabe vor Linie und Tag; ein späterer Wechsel muss bestätigt werden und entfernt bereits ausgewählte Fahrten. Die gespeicherte Ausgabe wird Teil der Herkunft des Fahrzeugumlaufs." },
          { title: "Fahrplanfahrten filtern und hinzufügen", text: "Filtern Sie nach Linie und Tag und fügen Sie die benötigten Fahrten in Betriebsreihenfolge hinzu. Die Liste enthält nur Fahrten der gewählten GTFS-Ausgabe." },
          { title: "Grenzen des Fahrzeugumlaufs festlegen", text: "Wählen Sie Start- und Rückkehrort sowie die Zeiten. ELETTRA berücksichtigt die Verbindungsfahrten, die für den vollständigen Fahrzeugumlauf benötigt werden." },
          { title: "Prüfen und speichern", text: "Prüfen Sie Fahrtenfolge, Zeitachse, Distanz sowie Karten- und Höhenkontext. Korrigieren Sie Lücken oder unplausible Zeiten vor dem Speichern." },
          { title: "Gespeicherte Fahrzeugumläufe finden oder duplizieren", text: "Die Suche prüft die vollständige serverseitige Liste vor der Seitennummerierung, sodass Treffer auch ausserhalb der aktuellen Seite gefunden werden. Wählen Sie einen oder mehrere Fahrzeugumläufe und verwenden Sie Duplizieren, um Fahrten, Busmodell und gespeicherte GTFS-Ausgabe zu übernehmen." },
          { title: "Gespeicherten Fahrzeugumlauf visualisieren", text: "Öffnen Sie Visualisieren/Details, um die allgemeinen Informationen und die vollständige Bewegungskette zu prüfen. Raum-Zeit ist die Standardansicht: Die Zeit verläuft horizontal, die Haltestellen vertikal, Mehrlinien-Umläufe werden nach Linie getrennt und Depotverbindungen gestrichelt dargestellt. Wechseln Sie zu Karte, um jede Bewegung mit Haltestellen und Zeiten einzeln über Erste, Vorherige, Nächste und Letzte zu prüfen. Ein Hinweis kennzeichnet Unterbrechungen durch fehlende Überführungsdaten, statt eine Verbindung zu erfinden." },
        ],
        figures: getGuideFigures("de", "shift"),
        note: { title: "Warum der vollständige Fahrzeugumlauf wichtig ist", text: "Depot- und Überführungsfahrten benötigen Energie, auch wenn keine Fahrgäste befördert werden. Ihr Weglassen kann die Bewertung zu optimistisch machen." },
      },
      {
        id: "feasibility",
        title: "5. Machbarkeitsbewertung",
        intro: "Die Machbarkeitsbewertung verbindet den prognostizierten Energiebedarf mit Batterie- und Ladeentscheidungen.",
        ordered: true,
        items: [
          { title: "GTFS-Fahrplan und Fahrzeugumläufe auswählen", text: "Öffnen Sie Simulationen → Machbarkeitsbewertung und erstellen Sie eine neue Bewertung. Wählen Sie zuerst eine GTFS-Ausgabe; die Tabelle zeigt danach nur kompatible Fahrzeugumläufe. Historische Umläufe mit gemischten Ausgaben sind für neue Bewertungen ausgeschlossen, und ein Ausgabenwechsel leert die aktuelle Auswahl." },
          { title: "Optimierungsmodus wählen", text: "Nur Batterie variiert die Packkonfiguration; Laden hält die Batterie fest und bewertet die Ladeinfrastruktur; Gemeinsam bewertet Batterie- und Ladeentscheidungen zusammen." },
          { title: "Szenario festlegen", text: "Prüfen Sie Aussentemperatur, Belegung, Heizung, nutzbares Ladezustandsfenster und erweiterte Betriebsparameter. Konfigurieren Sie bei Bedarf mögliche Ladeorte. Die Busmodellauswahl folgt den gewählten Umläufen und bleibt beim Bearbeiten anderer Eingaben stabil." },
          { title: "Bewertung sicher duplizieren", text: "Wählen Sie in der Bewertungsliste genau einen Lauf und dann Duplizieren. ELETTRA übernimmt Fahrzeugumläufe, Busmodell, Batteriereferenzen, SOC-Grenzen, Ladebedingungen und -kosten, Prognose- und Solveroptionen. Fehlen Originalressourcen oder kompatible Prognosen, wird die Kopie abgebrochen statt unvollständig gesendet; früher fehlerhafte historische Kopien müssen weiterhin geprüft und neu berechnet werden." },
          { title: "Berechnung starten und Abschluss abwarten", text: "Die Bewertung wird als benannter Lauf gespeichert. Status und Fortschritt werden angezeigt; ein laufender Prozess ist noch kein Ergebnis." },
          { title: "Urteil vor anderen Indikatoren lesen", text: "Ein erfolgreich beendeter Solverlauf kann physisch nicht machbar sein, wenn die erforderliche Batterie das Fahrzeuglimit überschreitet. Prüfen Sie zuerst Urteil und erforderliche gegenüber verfügbaren Packs." },
        ],
        figures: getGuideFigures("de", "feasibilityForm"),
        note: { title: "Konservative Dimensionierung", text: "Verwenden Sie für den technischen Entscheidungspunkt ein anspruchsvolles, aber plausibles Szenario. Der repräsentative Jahresbetrieb wird separat bewertet." },
      },
      {
        id: "results",
        title: "6. Machbarkeitsergebnisse interpretieren",
        intro: "Allgemein zeigt die Flottenübersicht; prüfen Sie danach Batterie und Ladeplan jedes Fahrzeugumlaufs.",
        items: [
          { title: "Mit Allgemein beginnen", text: "Allgemein fasst alle analysierten Fahrzeugumläufe und die grösste gewählte Batterie zusammen. Jeder Umlauf behält seine eigene Batterie; alle nehmen an der Dimensionierung teil und teilen die Ladeinfrastruktur. Die kompakte GTFS-Angabe im Kopf zeigt die bei Erstellung aufgezeichnete Ausgabe; bei historischen Ergebnissen ohne Snapshot wird die Herkunft ausdrücklich aus den aktuellen Umlaufdaten abgeleitet." },
          { title: "Jeden Fahrzeugumlauf prüfen", text: "Die Zusammenfassung zeigt den aktiven Mittelwert- oder Q95-Verbrauch, den spezifischen Verbrauch sowie den tatsächlich erreichten minimalen und maximalen SOC. Diese Werte sind Ergebnisse; Konfiguriertes SOC-Fenster bezeichnet die eingegebenen Grenzen. Lesen Sie sie zusammen mit Batterie, geplanten Ladevorgängen und verifiziertem SOC-Verlauf." },
          { title: "Visuelle Analyse und Energieeignung zusammen lesen", text: "Neue Bewertungen berechnen Mittelwert und aggregiertes Q95 gemeinsam. Die Auswahl öffnet die vollständige Auslegung des Profils ohne neue Berechnung. Unter Weitere Informationen steht die Prognose der gewählten und verifizierten Batterie unmittelbar vor der anfänglichen Referenz am physischen Maximum; Rollen und Packzahlen bleiben dadurch eindeutig. Q95 des Gesamtverbrauchs garantiert keine 95% SOC-Machbarkeit." },
          { title: "Ladeplan prüfen", text: "Prüfen Sie bei Laden und Gemeinsam Ort und Zeit jedes Ladevorgangs sowie Dauer, geladene Energie und mittlere Leistung. Bei Nur Batterie kann statt eines optimierten Plans ein fester oder kein Ladeplan erscheinen." },
          { title: "Bei Bedarf Weitere Informationen öffnen", text: "Ladeplan und Weitere Informationen sind aufklappbare weisse Karten. Sie enthalten Ladevorgänge, Prognosedetails, Betriebsannahmen, konfigurierte SOC-Grenzen und unterstützende Werte. Wenn ein Fahrzeugumlauf nicht abgedeckt ist, ändern Sie Fahrzeug, Ladezustandsfenster, Szenario oder Ladeauslegung und führen Sie eine separat benannte Bewertung aus." },
          { title: "Nicht machbar und Nicht bestimmt unterscheiden", text: "Nicht machbar bedeutet, dass die Optimierung abgeschlossen und die Auslegung verworfen wurde. Nicht bestimmt bedeutet, dass die Berechnung vor einem Machbarkeitsurteil abgebrochen ist. Allgemein zeigt das Ergebnis jedes ausgewählten Fahrzeugumlaufs; die jeweilige Registerkarte nennt den Grund, blockierende Fahrzeugumläufe und übersetzte Hinweise unter So beheben Sie das Problem. Korrigieren Sie die angegebenen Ausgangsdaten oder die Konfiguration und starten Sie eine neue Bewertung. Ein ungültiger Fahrzeugumlauf kann die Bewertung der anderen verhindern, ohne dass diese dadurch nicht machbar sind." },
        ],
        figures: getGuideFigures("de", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Jahresanalyse",
        intro: "Die Jahresanalyse hält die machbare Bus- und Ladeauslegung fest. Allgemein bewertet die Flotte oder eine repräsentative Busgruppe; jeder Fahrzeugumlauf zeigt seine eigene Jahreseffizienz.",
        ordered: true,
        items: [
          { title: "Analyse aus einer geeigneten Bewertung erstellen", text: "Öffnen Sie Simulationen → Jahresanalysen, erstellen Sie eine Analyse und wählen Sie die abgeschlossene Machbarkeitsbewertung, die Fahrzeug, Fahrzeugumläufe, Batterie, Laden und GTFS-Ausgabe festlegt. Das Jahresergebnis bewahrt diese aufgezeichnete Herkunft, statt späteren Änderungen eines Umlaufs still zu folgen." },
          { title: "Übernommene Eingaben prüfen", text: "Prüfen Sie Bewertung, Betriebsannahmen, repräsentative Temperaturen und deren Häufigkeiten vor dem Start. Temperaturszenarien verändern Verbrauchsschätzungen; sie dimensionieren die Batterie nicht neu, ändern die Ladeinfrastruktur nicht und wiederholen die Machbarkeitsentscheidung nicht." },
          { title: "Mit Allgemein beginnen", text: "Die kompakte jährliche Flottenanalyse zeigt Distanz, Bus- und Netzenergie, minimale/maximale Umlaufeffizienz, Elektro-TCO und Klimawirkung. Mit Repräsentativer Bus / Flotte prüfen Sie die gesamte Flotte oder eine Gruppe mit gleichem Modell und gleicher Batteriegrösse; die Zuweisungen aus der Machbarkeit bleiben unverändert." },
          { title: "Kosten und Emissionen der Flotte prüfen", text: "Kosten kombiniert eine kompakte TCO-Zeile, Jahres- und kumulative Diagramme, Kostengleichheit und Detailtabellen. Bus- und Batterie-CAPEX gehören vollständig zu den physischen Fahrzeugen im gewählten Bereich; die gemeinsame Ladeinfrastruktur wird einmal für die Flotte gezählt und nur ihre Kosten werden repräsentativen Busgruppen auf Basis der jährlichen DC-Energie zugeordnet. Emissionen zeigt Balken nach Lebenszyklusphase und Umweltindikatoren. Die aufklappbaren Annahmen stehen unter den Diagrammen, verwenden automatisch gespeicherte gemeinsame Werte und starten die Machbarkeit nie neu." },
          { title: "Einen Fahrzeugumlauf auswählen", text: "Direkt unter der Bereichsauswahl zeigt eine kompakte weisse Zeile Jahresenergie, simulierte Distanz und mittlere Effizienz. Danach erscheint Effizienz mit temperaturabhängigem Verbrauch, Unsicherheit und häufigkeitsgewichteter Energie direkt, ohne überflüssige Registerkarte mit nur einem Eintrag." },
          { title: "Wetter- und HVAC-Herkunft prüfen", text: "Die kompakten GTFS- und HVAC-Angaben nennen Fahrplan und gespeicherte Nebenverbrauchspolitik. Die Jahresanalyse verwendet stündliche PVGIS-GHI in der lokalen GTFS-Zeitzone und weist HVAC-Energie während Fahrt und Endaufenthalt aus; Nachvollziehbarkeit und JSON-Aktionen liefern Annahmen und vollständige Reproduktionseingaben." },
          { title: "Konfiguration prüfen und unter Allgemein exportieren", text: "Konfigurationsdaten anzeigen öffnet die festgeschriebene Auslegung. Alle Ergebnisse herunterladen steht nur unter Allgemein neben Schliessen zur Verfügung und speichert Allgemein sowie einen eigenen Eintrag für jeden verfügbaren Fahrzeugumlauf." },
          { title: "Nur aggregierte historische Ergebnisse erkennen", text: "Eine ältere Analyse ohne Aufschlüsselung nach Fahrzeugumläufen kann nur Allgemein anzeigen. ELETTRA lässt nicht verfügbare Fahrzeugumlaufdetails weg, statt sie aus Gesamtsummen zu erfinden." },
        ],
        figures: getGuideFigures("de", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Fahrzeug hier nicht neu dimensionieren", text: "Die Jahresanalyse beschreibt den Betrieb des an der Machbarkeitsschwelle gewählten Designs. Kehren Sie zur Machbarkeitsbewertung zurück, wenn Fahrzeug, Batterie oder Laden geändert werden sollen." },
      },
      {
        id: "comparison",
        title: "8. Analysen vergleichen und exportieren",
        intro: "Ein Vergleich ist besonders aussagekräftig, wenn sich die Alternativen in einer klar benannten Entscheidung oder Annahme unterscheiden.",
        items: [
          { title: "Zwei Jahresanalysen auswählen", text: "Öffnen Sie Simulationen → Analysenvergleich und wählen Sie Analyse A und B. Die Kompatibilitätsübersicht zeigt, ob ein direkter Vergleich möglich ist." },
          { title: "Konsistente Indikatoren vergleichen", text: "Prüfen Sie für beide Analysen Übersicht, Effizienz, Kosten und Emissionen. Bei unterschiedlichen Fahrzeugumläufen oder Annahmen sind aggregierte Unterschiede vorsichtig zu interpretieren." },
          { title: "Nachweise exportieren", text: "Im Bereich Details / Export können Vergleichsdaten als CSV oder JSON exportiert werden." },
        ],
        note: { title: "Szenarien eindeutig benennen", text: "Nehmen Sie den wichtigsten Unterschied in den Namen auf, beispielsweise Fahrzeug, Heizung, Belegung oder Ladestrategie." },
      },
      {
        id: "practice",
        title: "9. Interpretation und gute Praxis",
        intro: "Die Qualität einer Vorstudie hängt von der Qualität und Konsistenz ihrer Annahmen ab.",
        items: [
          { title: "Standardwerte durch Nachweise ersetzen", text: "Verwenden Sie Betreiber-, Hersteller-, Tarif- und Infrastrukturdaten, wenn verfügbar. Halten Sie Quelle und Datum ausserhalb von ELETTRA fest, wenn ein Wert entscheidungsrelevant ist." },
          { title: "Technische und jährliche Fragen trennen", text: "Verwenden Sie die Machbarkeitsbewertung für die anspruchsvolle technische Bedingung und die Jahresanalyse für repräsentative Jahresenergie, Kosten und Emissionen." },
          { title: "Vergleichbarkeit sicherstellen", text: "Halten Sie Betriebsumfang, Jahresdistanz und Systemgrenzen bei Vergleichen konsistent. Beachten Sie die Kompatibilitätswarnungen der Anwendung." },
          { title: "Vor Umsetzung vertiefen", text: "Nutzen Sie ELETTRA, um aussichtsreiche Konfigurationen und empfindliche Annahmen zu erkennen. Bestätigen Sie Beschaffung, Stromnetz, Ladegeräte, Depot, Bau und Betrieb durch entsprechende Fachstudien." },
        ],
      },
    ],
  },

  fr: {
    ui: {
      documentTitle: "Guide d’utilisation ELETTRA",
      backToApp: "Retour à ELETTRA",
      languageLabel: "Langue",
      languageAriaLabel: "Langue du guide",
      print: "Imprimer le guide",
      contents: "Sommaire du guide",
      eyebrow: "Documentation utilisateur",
      title: "Guide d’utilisation ELETTRA",
      introduction:
        "Un guide concis et orienté vers les tâches pour préparer un service voiture, vérifier sa faisabilité technique et interpréter les résultats annuels d’énergie, de coûts et d’environnement.",
      baselineLabel: "Version de référence de l’interface",
      baselineValue: `Frontend v${GUIDE_BASELINE_VERSION}`,
      updatedLabel: "Guide mis à jour",
      updatedValue: "13 novembre 2026",
      footer:
        "ELETTRA soutient les études de préfaisabilité. Les décisions finales relatives aux véhicules, à la recharge, au réseau et aux infrastructures doivent être confirmées par des études d’ingénierie détaillées.",
      skipLink: "Accéder au guide",
      sidebarAriaLabel: "Sommaire du guide",
      brandAriaLabel: "Guide d’utilisation ELETTRA",
      screenshotNote: "Les captures présentent des exemples dans différentes langues prises en charge par l’interface.",
      openImage: "Ouvrir la capture en taille réelle",
    },
    sections: [
      useCaseSections.fr,
      {
        id: "start",
        title: "1. Premiers pas",
        intro: "Le guide est public, mais les données de flotte et les analyses nécessitent un compte ELETTRA.",
        items: [
          { title: "Choisir la langue de l’interface", text: "Utilisez le sélecteur de langue dans l’en-tête de l’application. L’anglais, l’allemand, le français et l’italien sont disponibles; la préférence est conservée dans le navigateur." },
          { title: "Se connecter ou créer un compte", text: "Ouvrez ELETTRA avec le lien ci-dessus. Connectez-vous avec un compte existant ou créez-en un et sélectionnez l’entreprise de transport appropriée lorsque cela est demandé. Lors de l’inscription, l’aperçu CARTO utilise la dernière édition GTFS disponible et affiche toutes les lignes représentables avec leur numéro pour aider à confirmer l’entreprise. La carte est indicative et les tracés sont simplifiés; elle ne constitue pas une référence détaillée du réseau." },
          { title: "Utiliser la navigation principale", text: "Accueil explique le flux de planification et donne accès aux six sections de travail. Flotte contient Modèles de bus, Arrêts personnalisés et Services voiture; Simulations contient Évaluation de faisabilité, Analyses annuelles et Comparaison d’analyses. Le guide reste accessible au bas de la barre latérale." },
        ],
        figures: getGuideFigures("fr", "shell"),
        note: { title: "Périmètre de l’évaluation", text: "ELETTRA est un outil de planification et de préfaisabilité. Un résultat faisable dépend des hypothèses retenues pour le service voiture, le véhicule, la météo, l’occupation, la batterie et la recharge; il ne constitue pas une certification opérationnelle." },
      },
      {
        id: "workflow",
        title: "2. Flux de travail recommandé",
        intro: "Suivez les étapes dans l’ordre afin que chaque analyse repose sur un véhicule, un service voiture et un scénario traçables.",
        ordered: true,
        items: [
          { title: "Créer un modèle de bus", text: "Décrivez le bus candidat: catégorie, capacité, masse, limites de batterie, puissance de recharge, coûts et durées de vie." },
          { title: "Créer les arrêts personnalisés nécessaires", text: "Ajoutez les dépôts, points de recharge ou pôles qui ne figurent pas parmi les arrêts planifiés du réseau." },
          { title: "Construire un service voiture", text: "Sélectionnez les courses planifiées, définissez les lieux de départ et de retour et vérifiez le service voiture ordonné avec les mouvements auxiliaires." },
          { title: "Lancer une évaluation de faisabilité", text: "Sélectionnez un ou plusieurs services voiture, choisissez le mode d’optimisation et définissez les hypothèses d’exploitation et de recharge." },
          { title: "Vérifier la décision technique", text: "Examinez le verdict, la demande énergétique, l’énergie utile, les packs requis et les résultats de recharge avant de poursuivre." },
          { title: "Créer, comparer et exporter les analyses annuelles", text: "Réutilisez le design faisable avec des températures représentatives, examinez les indicateurs annuels et comparez les variantes enregistrées." },
        ],
      },
      {
        id: "fleet",
        title: "3. Modèles de bus et arrêts personnalisés",
        intro: "Les données réutilisables sur les véhicules et les lieux alimentent les services voiture et les évaluations.",
        items: [
          { title: "Modèles de bus", text: "Ouvrez Flotte → Modèles de bus et sélectionnez Ajouter un modèle de bus. Une catégorie de véhicule initialise des valeurs représentatives; vérifiez ensuite tous les champs techniques et économiques requis. Remplacez les valeurs par défaut lorsque des données d’opérateur ou de constructeur sont disponibles." },
          { title: "Limites de batterie", text: "Les nombres minimal et maximal de packs, leur capacité et leur masse définissent les configurations utilisables par le calcul. La puissance maximale de recharge limite la puissance acceptée par le véhicule." },
          { title: "Arrêts personnalisés", text: "Ouvrez Flotte → Arrêts personnalisés et choisissez le type. Saisissez une adresse ou des coordonnées, ou placez le point sur la carte. Détails ouvre un dialogue cohérent en lecture seule; Modifier prend aussi en charge les anciens arrêts dont les données précèdent le formulaire actuel. Utilisez des noms clairs pour les dépôts, points de recharge et pôles." },
        ],
        figures: getGuideFigures("fr", "customStop"),
        note: { title: "Avant de modifier ou supprimer", text: "Les données réutilisables peuvent être référencées par des services voiture ou des analyses. Vérifiez les travaux dépendants avant de modifier une donnée déjà utilisée." },
      },
      {
        id: "shifts",
        title: "4. Construire un service voiture",
        intro: "Un service voiture représente la mission journalière complète et ordonnée évaluée pour un modèle de bus candidat.",
        ordered: true,
        items: [
          { title: "Ouvrir Flotte → Services voiture et créer un service voiture", text: "Donnez au service voiture un nom explicite et sélectionnez le modèle de bus candidat." },
          { title: "Choisir l’horaire GTFS", text: "Un nouveau service voiture utilise d’abord la dernière édition GTFS disponible. Choisissez l’édition avant la ligne et le jour; un changement après l’ajout de courses demande confirmation et efface la sélection. L’édition enregistrée fait partie de la provenance du service voiture." },
          { title: "Filtrer et ajouter les courses planifiées", text: "Utilisez les filtres de ligne et de jour, puis ajoutez les courses dans leur ordre d’exploitation. La liste contient uniquement les courses de l’édition GTFS choisie." },
          { title: "Définir les limites du service voiture", text: "Sélectionnez les lieux et heures de départ et de retour. ELETTRA inclut les déplacements auxiliaires nécessaires pour représenter la mission complète." },
          { title: "Vérifier et enregistrer", text: "Contrôlez la séquence, la chronologie, la distance et le contexte cartographique et altimétrique. Corrigez les lacunes ou horaires invraisemblables avant l’enregistrement." },
          { title: "Rechercher ou dupliquer les services enregistrés", text: "La recherche interroge la liste complète côté serveur avant la pagination, afin de retrouver une correspondance au-delà de la page courante. Sélectionnez un ou plusieurs services et utilisez Dupliquer pour reprendre leurs courses, leur modèle de bus et leur édition GTFS enregistrée." },
          { title: "Visualiser un service voiture enregistré", text: "Ouvrez Visualiser/Détails pour contrôler les informations générales et la chaîne complète des mouvements. Espace-temps est la vue par défaut: le temps est horizontal, les arrêts verticaux, les services multiligne sont séparés par ligne et les liaisons au dépôt sont en pointillés. Passez à Carte pour examiner chaque mouvement, ses arrêts et ses horaires avec Première, Précédente, Suivante et Dernière. Un avertissement signale les discontinuités dues à des données de transfert manquantes au lieu d’inventer une liaison." },
        ],
        figures: getGuideFigures("fr", "shift"),
        note: { title: "Pourquoi la mission complète est importante", text: "Les déplacements depuis le dépôt et les transferts consomment de l’énergie même sans passagers. Les omettre peut rendre l’évaluation trop optimiste." },
      },
      {
        id: "feasibility",
        title: "5. Évaluation de faisabilité",
        intro: "L’évaluation associe la demande énergétique prévue aux décisions de batterie et de recharge.",
        ordered: true,
        items: [
          { title: "Choisir l’horaire GTFS et les services voiture", text: "Ouvrez Simulations → Évaluation de faisabilité et créez une évaluation. Choisissez d’abord une édition GTFS; le tableau ne montre ensuite que les services compatibles. Les anciens services mélangeant plusieurs éditions sont exclus des nouvelles évaluations et changer d’édition efface la sélection courante." },
          { title: "Choisir un mode d’optimisation", text: "Batterie uniquement fait varier les packs; Recharge maintient la batterie fixe et évalue l’infrastructure; Conjoint évalue simultanément batterie et recharge." },
          { title: "Définir le scénario", text: "Vérifiez la température extérieure, l’occupation, le chauffage, la fenêtre utile d’état de charge et les paramètres avancés. Configurez les lieux de recharge candidats lorsque nécessaire. Le choix du modèle de bus suit les services sélectionnés et reste stable pendant la modification des autres entrées." },
          { title: "Dupliquer une évaluation en sécurité", text: "Dans la liste, sélectionnez exactement un calcul puis Dupliquer. ELETTRA restaure services, modèle de bus, références de batterie, limites SOC, contraintes et coûts de recharge, paramètres de prévision et options du solveur. La copie est annulée plutôt que soumise partiellement si des ressources ou prévisions compatibles manquent; les anciennes copies incorrectes doivent toujours être contrôlées et recalculées." },
          { title: "Lancer et attendre la fin", text: "L’évaluation est enregistrée comme un calcul nommé. La progression et l’état d’exécution sont affichés; un calcul inachevé ne doit pas être interprété comme un résultat." },
          { title: "Lire le verdict en premier", text: "Un calcul résolu peut rester physiquement infaisable si la batterie requise dépasse la limite du véhicule. Vérifiez d’abord le verdict et les packs requis par rapport aux packs disponibles." },
        ],
        figures: getGuideFigures("fr", "feasibilityForm"),
        note: { title: "Dimensionnement conservateur", text: "Utilisez un scénario exigeant mais plausible pour la décision technique. L’exploitation annuelle représentative est évaluée séparément." },
      },
      {
        id: "results",
        title: "6. Interpréter les résultats de faisabilité",
        intro: "Général résume la flotte ; vérifiez ensuite la batterie et le plan de recharge de chaque service voiture.",
        items: [
          { title: "Commencer par Général", text: "Général résume tous les services voiture analysés et la plus grande batterie choisie. Chaque service conserve sa propre batterie; tous participent au dimensionnement et partagent l’infrastructure. Le volet GTFS compact de l’en-tête montre l’édition enregistrée lors de la création; pour un ancien résultat sans instantané, la provenance est explicitement dérivée des données actuelles du service." },
          { title: "Vérifier chaque service voiture", text: "Le résumé affiche la consommation moyenne ou Q95 active, la consommation spécifique ainsi que les SOC minimal et maximal réellement atteints. Ces SOC sont des résultats, tandis que Fenêtre SOC configurée désigne les limites saisies. Lisez-les avec la batterie, les recharges planifiées et la trajectoire SOC vérifiée." },
          { title: "Lire ensemble l’analyse visuelle et l’adéquation énergétique", text: "Les nouvelles évaluations calculent ensemble la moyenne et le Q95 agrégé. Le sélecteur ouvre le projet complet sans nouveau calcul. Dans Plus d’informations, la prévision de la batterie sélectionnée et vérifiée précède directement la référence initiale au maximum physique, ce qui explicite leurs rôles et nombres de packs. Le Q95 du total ne garantit pas une faisabilité SOC de 95%." },
          { title: "Contrôler le plan de recharge", text: "Pour les modes Recharge et Conjoint, vérifiez le lieu et l’heure de chaque session, sa durée, l’énergie fournie et la puissance moyenne. Le mode Batterie uniquement peut présenter un plan fixe ou aucun plan au lieu d’un plan optimisé." },
          { title: "Ouvrir Plus d’informations si nécessaire", text: "Plan de recharge et Plus d’informations sont des cartes blanches dépliables. Elles contiennent sessions, détails des prévisions, hypothèses d’exploitation, limites SOC configurées et valeurs justificatives. Si un service voiture échoue, modifiez le véhicule, la fenêtre d’état de charge, le scénario ou la recharge et lancez une évaluation portant un autre nom." },
          { title: "Distinguer non faisable de non déterminée", text: "Non faisable signifie que l’optimisation s’est terminée et a rejeté le dimensionnement. Non déterminée signifie que le calcul s’est arrêté avant de produire un verdict de faisabilité. Général présente le résultat de chaque service voiture sélectionné; l’onglet correspondant indique le motif, les services bloquants et des conseils traduits sous Comment résoudre le problème. Corrigez les données sources ou la configuration indiquées, puis lancez une nouvelle évaluation. Un service voiture non valide peut empêcher l’évaluation des autres sans les rendre non faisables." },
        ],
        figures: getGuideFigures("fr", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Analyse annuelle",
        intro: "L’analyse annuelle conserve le dimensionnement faisable du bus et de la recharge. Général évalue la flotte ou un groupe de bus représentatif; chaque service voiture présente sa propre efficacité annuelle.",
        ordered: true,
        items: [
          { title: "Créer une analyse à partir d’une évaluation admissible", text: "Ouvrez Simulations → Analyses annuelles, créez une analyse et sélectionnez l’évaluation terminée qui définit véhicule, services voiture, batterie, recharge et édition GTFS. Le résultat annuel conserve cette provenance enregistrée au lieu de suivre silencieusement les modifications ultérieures d’un service." },
          { title: "Vérifier les données héritées", text: "Contrôlez l’évaluation, les hypothèses d’exploitation, les températures représentatives et leurs occurrences avant le calcul. Les scénarios de température modifient la consommation; ils ne redimensionnent pas la batterie, ne changent pas l’infrastructure et ne répètent pas la décision de faisabilité." },
          { title: "Commencer par Général", text: "L’analyse annuelle compacte de la flotte présente distance, énergie au bus et au réseau, efficacité minimale/maximale des services, TCO électrique et impact climatique. Bus représentatif / Flotte permet d’examiner la flotte entière ou un groupe partageant modèle et taille de batterie; les affectations de faisabilité ne changent pas." },
          { title: "Examiner les Coûts et les Émissions de la flotte", text: "Coûts combine une ligne TCO compacte, des graphiques annuels et cumulés, le seuil de rentabilité et des tableaux détaillés. Les CAPEX des bus et batteries appartiennent intégralement aux véhicules physiques du périmètre; l’infrastructure partagée est comptée une fois pour la flotte et seul son coût est attribué aux groupes représentatifs selon l’énergie DC annuelle. Émissions montre les barres par phase du cycle de vie et les indicateurs environnementaux. Les hypothèses dépliables sont sous les graphiques, partagent des valeurs enregistrées automatiquement et ne relancent jamais la faisabilité." },
          { title: "Sélectionner un service voiture", text: "Une ligne blanche compacte, directement sous le sélecteur, indique énergie annuelle, distance simulée et efficacité moyenne. Efficacité présente ensuite directement consommation selon la température, incertitude et énergie pondérée, sans onglet redondant à élément unique." },
          { title: "Vérifier la provenance météo et HVAC", text: "Les volets GTFS et HVAC compacts identifient l’horaire et la politique d’auxiliaires enregistrés. L’analyse annuelle utilise le GHI PVGIS horaire dans le fuseau GTFS local et indique l’énergie HVAC en course et au terminus; la traçabilité et les actions JSON donnent les hypothèses et les entrées complètes de reproduction." },
          { title: "Examiner la configuration et exporter depuis Général", text: "Afficher les données de configuration ouvre le dimensionnement figé. Télécharger tous les résultats apparaît uniquement dans Général, près de Fermer, et enregistre Général ainsi qu’une entrée distincte pour chaque service voiture disponible." },
          { title: "Reconnaître les anciens résultats uniquement agrégés", text: "Une ancienne analyse sans ventilation par service voiture peut n’afficher que Général. ELETTRA laisse absents les détails indisponibles au lieu de les inventer à partir des totaux." },
        ],
        figures: getGuideFigures("fr", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Ne pas redimensionner le véhicule ici", text: "L’analyse annuelle représente l’exploitation du design retenu lors de l’évaluation de faisabilité. Revenez à cette évaluation si le véhicule, la batterie ou la recharge doivent changer." },
      },
      {
        id: "comparison",
        title: "8. Comparer et exporter les analyses",
        intro: "Une comparaison est plus utile lorsque les variantes diffèrent par une décision ou une hypothèse clairement identifiée.",
        items: [
          { title: "Sélectionner deux analyses annuelles", text: "Ouvrez Simulations → Comparaison d’analyses et choisissez Analyse A et Analyse B. Le résumé de compatibilité indique si la comparaison peut être directe." },
          { title: "Comparer des indicateurs cohérents", text: "Examinez Aperçu, Efficacité, Coûts et Émissions pour les deux analyses. Si les services voiture ou hypothèses diffèrent, interprétez les écarts agrégés avec prudence." },
          { title: "Exporter les éléments probants", text: "Utilisez la zone Détails / Export pour exporter les données de comparaison en CSV ou JSON." },
        ],
        note: { title: "Nommer clairement les scénarios", text: "Incluez la principale différence dans le nom enregistré, par exemple le véhicule, le chauffage, l’occupation ou la stratégie de recharge." },
      },
      {
        id: "practice",
        title: "9. Interprétation et bonnes pratiques",
        intro: "La qualité d’une préfaisabilité dépend de la qualité et de la cohérence de ses hypothèses.",
        items: [
          { title: "Remplacer les valeurs par défaut lorsque possible", text: "Utilisez les informations de l’opérateur, du constructeur, des tarifs et des infrastructures. Consignez la source et la date en dehors d’ELETTRA lorsqu’une valeur est importante pour la décision." },
          { title: "Séparer les questions techniques et annuelles", text: "Utilisez l’évaluation de faisabilité pour la condition technique exigeante et l’analyse annuelle pour l’énergie, les coûts et les émissions représentatifs." },
          { title: "Comparer ce qui est comparable", text: "Maintenez un périmètre de service voiture, une distance annuelle et des limites cohérents. Tenez compte des avertissements de compatibilité de l’application." },
          { title: "Approfondir avant la mise en œuvre", text: "Utilisez ELETTRA pour identifier les configurations prometteuses et les hypothèses sensibles. Confirmez les décisions d’achat, de réseau, de recharge, de dépôt, de génie civil et d’exploitation par des études spécialisées." },
        ],
      },
    ],
  },

  it: {
    ui: {
      documentTitle: "Guida utente ELETTRA",
      backToApp: "Torna a ELETTRA",
      languageLabel: "Lingua",
      languageAriaLabel: "Lingua della guida",
      print: "Stampa la guida",
      contents: "Indice della guida",
      eyebrow: "Documentazione utente",
      title: "Guida utente ELETTRA",
      introduction:
        "Una guida concisa e orientata alle attività per preparare un servizio di autobus, verificarne la fattibilità tecnica e interpretare i risultati annuali energetici, economici e ambientali.",
      baselineLabel: "Versione di riferimento dell’interfaccia",
      baselineValue: `Frontend v${GUIDE_BASELINE_VERSION}`,
      updatedLabel: "Guida aggiornata",
      updatedValue: "13 novembre 2026",
      footer:
        "ELETTRA supporta studi di prefattibilità. Le decisioni finali su veicoli, ricarica, rete e infrastrutture devono essere confermate mediante una progettazione tecnica dettagliata.",
      skipLink: "Vai alla guida",
      sidebarAriaLabel: "Indice della guida",
      brandAriaLabel: "Guida utente ELETTRA",
      screenshotNote: "Le schermate mostrano esempi in diverse lingue supportate dall’interfaccia.",
      openImage: "Apri la schermata a dimensione intera",
    },
    sections: [
      useCaseSections.it,
      {
        id: "start",
        title: "1. Per iniziare",
        intro: "La guida è pubblica, ma i dati della flotta e le analisi richiedono un account ELETTRA.",
        items: [
          { title: "Scegliere la lingua dell’interfaccia", text: "Usare il selettore della lingua nell’intestazione dell’applicazione. Sono disponibili inglese, tedesco, francese e italiano; la preferenza viene memorizzata nel browser." },
          { title: "Accedere o creare un account", text: "Aprire ELETTRA dal collegamento qui sopra. Accedere con un account esistente oppure crearne uno e selezionare l’azienda di trasporto appropriata quando richiesto. Durante la registrazione, l’anteprima CARTO usa l’ultima edizione GTFS disponibile e mostra tutte le linee disegnabili con il relativo numero per aiutare a confermare l’azienda. La mappa è indicativa e i percorsi sono semplificati: non va utilizzata come riferimento dettagliato della rete." },
          { title: "Usare la navigazione principale", text: "Home spiega il flusso di pianificazione e collega direttamente le sei sezioni operative. Flotta contiene Modelli di autobus, Fermate personalizzate e Turni macchina; Simulazioni contiene Valutazione di fattibilità, Analisi annuali e Confronto analisi. La guida utente resta disponibile in fondo alla barra laterale." },
        ],
        figures: getGuideFigures("it", "shell"),
        note: { title: "Perimetro della valutazione", text: "ELETTRA è uno strumento di pianificazione e prefattibilità. Un risultato fattibile dipende dalle ipotesi selezionate per servizio, veicolo, meteo, occupazione, batteria e ricarica; non costituisce una certificazione operativa." },
      },
      {
        id: "workflow",
        title: "2. Flusso di lavoro consigliato",
        intro: "Completare le fasi in sequenza affinché ogni analisi abbia una base tracciabile di veicolo, servizio e scenario.",
        ordered: true,
        items: [
          { title: "Creare un modello di autobus", text: "Descrivere il veicolo candidato, inclusi categoria, capacità, massa, limiti della batteria, potenza di ricarica, costi e durate di vita." },
          { title: "Creare le fermate personalizzate necessarie", text: "Aggiungere depositi, punti di ricarica o nodi non rappresentati dalle fermate del trasporto pubblico programmate." },
          { title: "Costruire un turno macchina", text: "Selezionare le corse programmate, definire le località di partenza e ritorno e verificare il servizio ordinato e gli spostamenti ausiliari." },
          { title: "Eseguire una valutazione di fattibilità", text: "Selezionare uno o più turni macchina, scegliere la modalità di ottimizzazione e impostare le ipotesi operative e di ricarica." },
          { title: "Verificare il controllo tecnico", text: "Esaminare il verdetto, la domanda energetica, l’energia utilizzabile, i pacchi richiesti e i risultati di ricarica prima di proseguire." },
          { title: "Creare, confrontare ed esportare le analisi annuali", text: "Riutilizzare il progetto fattibile con temperature rappresentative, esaminare gli indicatori annuali e confrontare le alternative salvate." },
        ],
      },
      {
        id: "fleet",
        title: "3. Modelli di autobus e fermate personalizzate",
        intro: "I dati riutilizzabili di veicoli e località forniscono gli input tecnici per turni macchina e valutazioni.",
        items: [
          { title: "Modelli di autobus", text: "Aprire Flotta → Modelli di autobus e selezionare Aggiungi modello. Scegliere una categoria per inizializzare valori rappresentativi, quindi verificare tutti i campi tecnici ed economici obbligatori. Sostituire i valori predefiniti quando sono disponibili dati dell’operatore o del costruttore." },
          { title: "Limiti della batteria", text: "Numero minimo e massimo di pacchi, capacità e massa definiscono le configurazioni utilizzabili dal calcolo. La potenza massima di ricarica limita la potenza accettata dal veicolo." },
          { title: "Fermate personalizzate", text: "Aprire Flotta → Fermate personalizzate e scegliere il tipo. Inserire indirizzo o coordinate oppure posizionare il punto sulla mappa. Dettagli apre una finestra coerente in sola lettura; Modifica supporta anche le fermate storiche salvate prima del modulo attuale. Usare nomi chiari per depositi, punti di ricarica e nodi." },
        ],
        figures: getGuideFigures("it", "customStop"),
        note: { title: "Prima di modificare o eliminare", text: "I record riutilizzabili possono essere referenziati da turni macchina o analisi. Verificare i lavori dipendenti prima di modificare un record già utilizzato." },
      },
      {
        id: "shifts",
        title: "4. Costruire un turno macchina",
        intro: "Un turno macchina rappresenta il servizio giornaliero completo e ordinato valutato per un modello di autobus candidato.",
        ordered: true,
        items: [
          { title: "Aprire Flotta → Turni macchina e creare un turno macchina", text: "Assegnare un nome riconoscibile e selezionare il modello di autobus candidato." },
          { title: "Scegliere l’orario GTFS", text: "Un nuovo turno macchina usa inizialmente l’edizione GTFS più recente disponibile. Selezionare l’edizione prima di linea e giorno; cambiarla dopo aver aggiunto corse richiede conferma e svuota la selezione. L’edizione salvata entra nella provenienza del turno." },
          { title: "Filtrare e aggiungere le corse programmate", text: "Usare i filtri per linea e giorno, quindi aggiungere le corse necessarie nel loro ordine operativo. L’elenco contiene solo corse dell’edizione GTFS selezionata." },
          { title: "Definire i limiti del servizio", text: "Selezionare località e orari di partenza e ritorno. ELETTRA include gli spostamenti ausiliari necessari per rappresentare il servizio completo." },
          { title: "Verificare e salvare", text: "Controllare sequenza, linea temporale, distanza e contesto cartografico e altimetrico. Correggere lacune o tempi non plausibili prima di salvare." },
          { title: "Cercare o duplicare i turni salvati", text: "La ricerca interroga l’elenco completo sul server prima della paginazione, quindi trova corrispondenze oltre la pagina corrente. Selezionare uno o più turni e usare Duplica per copiarne corse, modello di autobus ed edizione GTFS registrata prima di modificare le copie." },
          { title: "Visualizzare un turno salvato", text: "Aprire Visualizza/Dettagli per controllare le informazioni generali e la catena completa dei movimenti. Spazio-tempo è la vista predefinita: il tempo scorre in orizzontale, le fermate in verticale, i turni multilinea sono separati per linea e i collegamenti al deposito sono tratteggiati. Passare a Mappa per esaminare un movimento alla volta con fermate e orari usando Prima, Precedente, Successiva e Ultima. Un avviso segnala le discontinuità dovute a dati di trasferimento mancanti invece di inventare un collegamento." },
        ],
        figures: getGuideFigures("it", "shift"),
        note: { title: "Perché il servizio completo è importante", text: "Gli spostamenti da deposito e di trasferimento consumano energia anche senza passeggeri. Ometterli può rendere la valutazione troppo ottimistica." },
      },
      {
        id: "feasibility",
        title: "5. Valutazione di fattibilità",
        intro: "La valutazione collega la domanda energetica prevista alle decisioni su batteria e ricarica.",
        ordered: true,
        items: [
          { title: "Scegliere l’orario GTFS e i turni macchina", text: "Aprire Simulazioni → Valutazione di fattibilità e creare una nuova valutazione. Selezionare prima una sola edizione GTFS; la tabella mostra quindi soltanto i turni compatibili. I turni storici che mescolano edizioni sono esclusi dalle nuove valutazioni e il cambio di edizione svuota la selezione corrente." },
          { title: "Scegliere una modalità di ottimizzazione", text: "Solo batteria varia la configurazione dei pacchi; Ricarica mantiene fissa la batteria e valuta l’infrastruttura; Congiunta valuta insieme batteria e ricarica." },
          { title: "Impostare lo scenario", text: "Verificare temperatura esterna, occupazione, riscaldamento, intervallo utilizzabile dello stato di carica e parametri avanzati. Configurare i punti di ricarica candidati quando necessario. La scelta del modello di autobus segue i turni selezionati e resta stabile mentre si modificano gli altri input." },
          { title: "Duplicare una valutazione in sicurezza", text: "Nell’elenco selezionare esattamente una valutazione e scegliere Duplica. ELETTRA ripristina turni, modello, riferimenti batteria, limiti SOC, vincoli e costi di ricarica, impostazioni previsionali e opzioni del risolutore. Se mancano risorse originali o previsioni compatibili, la copia viene annullata invece di essere inviata parzialmente; le copie storiche errate richiedono comunque verifica e ricalcolo." },
          { title: "Eseguire e attendere il completamento", text: "La valutazione viene salvata come esecuzione con nome. L’applicazione mostra avanzamento e stato; un’esecuzione non conclusa non è un risultato." },
          { title: "Leggere prima il verdetto", text: "Un calcolo concluso può essere fisicamente non fattibile se la batteria richiesta supera il limite del veicolo. Verificare prima verdetto e pacchi richiesti rispetto a quelli disponibili." },
        ],
        figures: getGuideFigures("it", "feasibilityForm"),
        note: { title: "Dimensionamento conservativo", text: "Usare uno scenario impegnativo ma plausibile per il controllo tecnico. L’esercizio annuale rappresentativo viene valutato separatamente." },
      },
      {
        id: "results",
        title: "6. Interpretare i risultati di fattibilità",
        intro: "Generale riepiloga la flotta; controlla poi batteria e piano di ricarica di ciascun turno macchina.",
        items: [
          { title: "Iniziare da Generale", text: "Generale riepiloga tutti i turni macchina analizzati e la batteria scelta più grande. Ogni turno mantiene la propria batteria; tutti partecipano al dimensionamento e condividono l’infrastruttura. Il riquadro GTFS compatto nell’intestazione mostra l’edizione registrata alla creazione; per un risultato storico senza istantanea, la provenienza viene indicata esplicitamente come derivata dai dati correnti del turno." },
          { title: "Controllare ogni turno macchina", text: "Il riepilogo mostra consumo Media o Q95 attivo, consumo specifico e valori minimo e massimo del SOC effettivamente raggiunti. Questi sono risultati, mentre Intervallo SOC configurato identifica i limiti inseriti nella valutazione. Leggerli insieme a batteria, ricariche pianificate e traiettoria SOC verificata." },
          { title: "Leggere insieme analisi visiva e adeguatezza energetica", text: "Le nuove valutazioni calcolano insieme Media e Q95 aggregato. Il selettore apre il progetto completo senza avviare altri calcoli. In Maggiori informazioni, la previsione della batteria selezionata e verificata precede direttamente il riferimento iniziale al massimo fisico, rendendo espliciti ruoli e numero di pacchi. Il Q95 del consumo totale non garantisce il 95% di fattibilità SOC." },
          { title: "Verificare il piano di ricarica", text: "Per le modalità Ricarica e Congiunta, controllare dove e quando avviene ogni sessione, la durata, l’energia fornita e la potenza media. In Solo batteria può comparire un piano fisso o assente invece di uno ottimizzato." },
          { title: "Aprire Maggiori informazioni quando serve", text: "Piano di ricarica e Maggiori informazioni sono schede bianche espandibili. Contengono sessioni, dettagli delle previsioni, ipotesi operative, limiti SOC configurati e valori di supporto. Se un turno macchina non è coperto, modificare veicolo, intervallo SOC, scenario o progetto di ricarica ed eseguire una valutazione con un nome distinto." },
          { title: "Distinguere non fattibile da non determinata", text: "Non fattibile significa che l’ottimizzazione è terminata e ha escluso la configurazione. Non determinata significa che il calcolo si è interrotto prima di produrre un verdetto di fattibilità. Generale mostra l’esito di ogni turno macchina selezionato; la relativa scheda indica il motivo, gli eventuali turni bloccanti e i suggerimenti tradotti sotto Come risolvere. Correggere i dati di origine o la configurazione indicati, quindi eseguire una nuova valutazione. Un turno macchina non valido può impedire la valutazione degli altri senza renderli non fattibili." },
        ],
        figures: getGuideFigures("it", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Analisi annuale",
        intro: "L’analisi annuale mantiene fisso il progetto fattibile di autobus e ricarica. Generale valuta la flotta o un gruppo di bus rappresentativo; ogni turno macchina mostra la propria efficienza annuale.",
        ordered: true,
        items: [
          { title: "Creare un’analisi da una valutazione idonea", text: "Aprire Simulazioni → Analisi annuali, creare una nuova analisi e selezionare la valutazione completata che definisce veicolo, turni macchina, batteria, ricarica ed edizione GTFS. Il risultato annuale conserva questa provenienza registrata invece di seguire in silenzio modifiche successive ai turni." },
          { title: "Verificare gli input ereditati", text: "Controllare la valutazione, le ipotesi operative, le temperature rappresentative e le loro occorrenze prima dell’avvio. Gli scenari di temperatura cambiano le stime di consumo; non ridimensionano la batteria, non modificano l’infrastruttura e non ripetono la decisione di fattibilità." },
          { title: "Iniziare da Generale", text: "L’Analisi annuale della flotta mostra in modo compatto distanza, energia ai bus e dalla rete, efficienza minima/massima dei turni, TCO elettrico e impatto climatico. Bus rappresentativo / Flotta consente di esaminare la flotta completa o un gruppo con lo stesso modello e la stessa batteria; le assegnazioni della fattibilità non cambiano." },
          { title: "Esaminare Costi ed Emissioni della flotta", text: "Costi combina una riga TCO compatta, grafici annui e cumulati, pareggio e tabelle di dettaglio. I CAPEX di autobus e batterie appartengono integralmente ai veicoli fisici nell’ambito selezionato; l’infrastruttura condivisa è conteggiata una sola volta per la flotta e solo il suo costo viene allocato ai gruppi rappresentativi in base all’energia DC annuale. Emissioni mostra barre per fase del ciclo di vita e indicatori ambientali. Le ipotesi espandibili sono sotto i grafici, condividono valori salvati automaticamente e non rilanciano mai la fattibilità." },
          { title: "Selezionare un turno macchina", text: "Una riga bianca compatta subito sotto il selettore riporta energia annuale, distanza simulata ed efficienza media. Efficienza mostra quindi direttamente consumo in funzione della temperatura, incertezza ed energia ponderata, senza una tab ridondante con un solo elemento." },
          { title: "Verificare la provenienza meteo e HVAC", text: "I riquadri compatti GTFS e HVAC identificano orario e politica degli ausiliari salvati. L’analisi annuale usa il GHI orario PVGIS nel fuso GTFS locale e riporta energia HVAC in corsa e al capolinea; tracciabilità e azioni JSON espongono ipotesi e input completi di riproduzione." },
          { title: "Esaminare la configurazione ed esportare da Generale", text: "Visualizza dati di configurazione apre il progetto congelato. Scarica tutti i risultati compare solo in Generale, vicino a Chiudi, e salva Generale più una voce separata per ogni turno macchina disponibile." },
          { title: "Riconoscere i risultati storici solo aggregati", text: "Un’analisi precedente priva del dettaglio per turno macchina può mostrare soltanto Generale. ELETTRA lascia assenti i dettagli non disponibili invece di ricavarli artificialmente dai totali." },
        ],
        figures: getGuideFigures("it", "yearlyEfficiency", "yearlyEmissions"),
        note: { title: "Non ridimensionare qui il veicolo", text: "L’analisi annuale rappresenta l’esercizio del progetto scelto nella valutazione di fattibilità. Tornare alla fattibilità se occorre cambiare veicolo, batteria o ricarica." },
      },
      {
        id: "comparison",
        title: "8. Confrontare ed esportare le analisi",
        intro: "Il confronto è più utile quando le alternative differiscono per una decisione o un’ipotesi chiaramente identificata.",
        items: [
          { title: "Selezionare due analisi annuali", text: "Aprire Simulazioni → Confronto analisi e scegliere Analisi A e Analisi B. Il riepilogo di compatibilità indica se i casi possono essere confrontati direttamente." },
          { title: "Confrontare indicatori coerenti", text: "Esaminare Panoramica, Efficienza, Costi ed Emissioni per entrambe le analisi. Se turni macchina o ipotesi differiscono, interpretare con cautela le differenze aggregate." },
          { title: "Esportare le evidenze", text: "Usare Dettagli / Esporta per esportare i dati di confronto in CSV o JSON." },
        ],
        note: { title: "Nominare chiaramente gli scenari", text: "Includere nel nome salvato la differenza principale, ad esempio veicolo, riscaldamento, occupazione o strategia di ricarica." },
      },
      {
        id: "practice",
        title: "9. Interpretazione e buone pratiche",
        intro: "La qualità di una prefattibilità dipende dalla qualità e dalla coerenza delle ipotesi.",
        items: [
          { title: "Sostituire i valori predefiniti quando possibile", text: "Usare dati dell’operatore, del costruttore, delle tariffe e delle infrastrutture. Registrare fonte e data al di fuori di ELETTRA quando il valore è importante per una decisione." },
          { title: "Separare le domande tecniche da quelle annuali", text: "Usare la valutazione di fattibilità per la condizione tecnica impegnativa e l’analisi annuale per energia, costi ed emissioni rappresentativi." },
          { title: "Confrontare scenari coerenti", text: "Mantenere coerenti perimetro del servizio, distanza annuale e confini dell’analisi. Usare gli avvisi di compatibilità dell’applicazione." },
          { title: "Approfondire prima dell’implementazione", text: "Usare ELETTRA per identificare configurazioni promettenti e ipotesi sensibili. Confermare acquisti, rete elettrica, caricatori, deposito, opere civili e decisioni operative mediante studi specialistici." },
        ],
      },
    ],
  },
};
