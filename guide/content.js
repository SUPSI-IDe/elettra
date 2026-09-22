export const GUIDE_BASELINE_VERSION = "0.1.9";
export const GUIDE_UPDATED_AT = "17 September 2026";

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
      en: "Application shell on the Bus Models page. The sidebar separates Fleet and Simulations, while account and language controls remain available in the header.",
      de: "Anwendungsrahmen auf der Seite Busmodelle. Die Seitenleiste trennt Flotte und Simulationen; Konto- und Sprachsteuerung bleiben in der Kopfzeile verfügbar.",
      fr: "Structure de l’application sur la page des modèles de bus. La barre latérale sépare Flotte et Simulations; les contrôles du compte et de la langue restent disponibles dans l’en-tête.",
      it: "Struttura dell’applicazione nella pagina dei modelli di autobus. La barra laterale separa Flotta e Simulazioni, mentre account e lingua restano disponibili nell’intestazione.",
    },
  },
  customStop: {
    src: customStopImage,
    captions: {
      en: "Custom-stop form with structured location fields and map-assisted positioning.",
      de: "Formular für benutzerdefinierte Haltestellen mit strukturierten Ortsangaben und kartengestützter Positionierung.",
      fr: "Formulaire d’arrêt personnalisé avec champs de localisation structurés et positionnement assisté par carte.",
      it: "Modulo della fermata personalizzata con campi strutturati e posizionamento assistito dalla mappa.",
    },
  },
  shift: {
    src: shiftVisualisationImage,
    captions: {
      en: "Shift visualisation showing duty information, ordered movements, depot connections and the operating timeline.",
      de: "Visualisierung eines Dienstes mit Betriebsinformationen, geordneten Fahrten, Depotverbindungen und Zeitachse.",
      fr: "Visualisation d’un service avec ses informations, les mouvements ordonnés, les liaisons au dépôt et la chronologie d’exploitation.",
      it: "Visualizzazione di un turno con informazioni, movimenti ordinati, collegamenti al deposito e linea temporale operativa.",
    },
  },
  feasibilityForm: {
    src: feasibilityFormImage,
    captions: {
      en: "Feasibility-evaluation form for selecting shifts and defining environmental, occupancy, heating, state-of-charge and optimisation assumptions.",
      de: "Formular der Machbarkeitsbewertung zur Auswahl von Diensten und Festlegung von Umwelt-, Belegungs-, Heizungs-, Ladezustands- und Optimierungsannahmen.",
      fr: "Formulaire d’évaluation de faisabilité pour sélectionner les services et définir les hypothèses d’environnement, d’occupation, de chauffage, d’état de charge et d’optimisation.",
      it: "Modulo della valutazione di fattibilità per selezionare i turni e definire le ipotesi ambientali, di occupazione, riscaldamento, stato di carica e ottimizzazione.",
    },
  },
  feasibilityEfficiency: {
    src: feasibilityEfficiencyImage,
    captions: {
      en: "Efficiency view comparing consumption quantiles, battery-covered energy and drivetrain and auxiliary demand across pack scenarios.",
      de: "Effizienzansicht zum Vergleich von Verbrauchsquantilen, batterieabgedeckter Energie sowie Antriebs- und Nebenverbrauch für verschiedene Packszenarien.",
      fr: "Vue Efficacité comparant les quantiles de consommation, l’énergie couverte par la batterie et les demandes de traction et auxiliaire selon les scénarios de packs.",
      it: "Vista Efficienza con il confronto tra quantili di consumo, energia coperta dalla batteria e domanda di trazione e ausiliaria nei diversi scenari di pacchi.",
    },
  },
  feasibilitySizing: {
    src: feasibilitySizingImage,
    captions: {
      en: "Feasibility insight and battery-sizing detail, including the verdict, assumptions and required versus physical pack limits.",
      de: "Machbarkeitshinweis und Batteriedimensionierung mit Urteil, Annahmen und Vergleich der erforderlichen Packs mit der physischen Grenze.",
      fr: "Synthèse de faisabilité et détail du dimensionnement de la batterie, avec verdict, hypothèses et comparaison des packs requis à la limite physique.",
      it: "Sintesi della fattibilità e dettaglio del dimensionamento della batteria, con verdetto, ipotesi e confronto tra pacchi richiesti e limite fisico.",
    },
  },
  yearlyEfficiency: {
    src: yearlyEfficiencyImage,
    captions: {
      en: "Yearly Efficiency view with temperature-dependent consumption and occurrence-weighted annual energy contributions.",
      de: "Jährliche Effizienzansicht mit temperaturabhängigem Verbrauch und nach Häufigkeit gewichteten jährlichen Energiebeiträgen.",
      fr: "Vue Efficacité annuelle avec consommation dépendant de la température et contributions énergétiques annuelles pondérées par occurrence.",
      it: "Vista Efficienza annuale con consumo dipendente dalla temperatura e contributi energetici annuali ponderati per occorrenza.",
    },
  },
  yearlyEmissions: {
    src: yearlyEmissionsImage,
    captions: {
      en: "Yearly Emissions view comparing annual pollutant savings and lifecycle CO₂-equivalent contributions.",
      de: "Jährliche Emissionsansicht zum Vergleich der Schadstoffeinsparungen und der Lebenszyklusbeiträge in CO₂-Äquivalenten.",
      fr: "Vue Émissions annuelles comparant les réductions de polluants et les contributions au cycle de vie en équivalent CO₂.",
      it: "Vista Emissioni annuali con il confronto dei risparmi di inquinanti e dei contributi del ciclo di vita in CO₂ equivalente.",
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
            text: "Open ELETTRA from the link above. Sign in with an existing account or create one and select the appropriate transport company when requested.",
          },
          {
            title: "Use the main navigation",
            text: "Fleet contains Bus Models, Custom Stops and Shifts. Simulations contains Feasibility evaluation, Yearly analyses and Analysis comparison.",
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
            title: "Build a shift",
            text: "Select scheduled trips, define the start and return locations, and check the ordered duty and auxiliary movements.",
          },
          {
            title: "Run a feasibility evaluation",
            text: "Select one or more shifts, choose the optimisation mode and set the operating and charging assumptions.",
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
          "Reusable fleet and location records provide the technical inputs for shifts and evaluations.",
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
            text: "Open Fleet → Custom Stops and select the stop type. Enter an address or coordinates, or position the point with the map. Use clear names that distinguish depots, charging locations and hubs.",
          },
        ],
        figures: getGuideFigures("en", "customStop"),
        note: {
          title: "Before editing or deleting",
          text: "Reusable records may be referenced by shifts or analyses. Review dependent work before changing a record that has already been used.",
        },
      },
      {
        id: "shifts",
        title: "4. Building a shift",
        intro:
          "A shift represents the complete ordered duty evaluated for one candidate bus model.",
        ordered: true,
        items: [
          {
            title: "Open Fleet → Shifts and create a shift",
            text: "Give the shift a recognisable name and select the candidate bus model.",
          },
          {
            title: "Filter and add scheduled trips",
            text: "Use the line and day filters, then add the required scheduled trips in their operating order.",
          },
          {
            title: "Define the duty boundaries",
            text: "Select the start and return locations and their times. ELETTRA includes the connecting auxiliary movements needed to represent the complete duty.",
          },
          {
            title: "Check and save",
            text: "Review the trip sequence, timeline, distance and map/elevation context. Correct gaps or implausible timing before saving the shift.",
          },
        ],
        figures: getGuideFigures("en", "shift"),
        note: {
          title: "Why the complete duty matters",
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
            title: "Select the shifts",
            text: "Open Simulations → Feasibility evaluation, create a new evaluation and select the shifts to be assessed together.",
          },
          {
            title: "Choose an optimisation mode",
            text: "Battery only varies the pack configuration; Charging keeps the battery configuration fixed and evaluates charging infrastructure; Joint evaluates battery and charging decisions together.",
          },
          {
            title: "Set the scenario",
            text: "Review external temperature, occupancy, heating configuration, usable state-of-charge window and any advanced service parameters. Configure candidate charging locations when required by the selected mode.",
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
        intro:
          "Treat the result as a decision gate supported by energy and charging evidence.",
        items: [
          {
            title: "Feasibility verdict",
            text: "Feasible — Q50-based demand scenario means that the analysed configuration satisfies the implemented energy, state-of-charge, timing and charging constraints using median demand. Q05 and Q95 remain comparison scenarios for understanding uncertainty. Infeasible means that one or more assumptions or design choices must be revised.",
          },
          {
            title: "Energy and uncertainty",
            text: "Compare prediction quantiles, drivetrain and auxiliary demand, and usable battery energy. A wider prediction range indicates greater uncertainty in the expected trip demand.",
          },
          {
            title: "Battery and charging",
            text: "Review optimised and maximum physical pack counts, minimum and maximum state of charge, charged energy, charging sessions and station use where available.",
          },
          {
            title: "Iterate",
            text: "Duplicate or create a new evaluation to test another vehicle, service, state-of-charge window, temperature, occupancy or charging configuration. Keep each case under a distinct name.",
          },
        ],
        figures: getGuideFigures("en", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Yearly analysis",
        intro:
          "A yearly analysis keeps the feasible technical design fixed and evaluates it across representative annual temperature conditions.",
        ordered: true,
        items: [
          {
            title: "Create an analysis from an eligible evaluation",
            text: "Open Simulations → Yearly analyses, create a new analysis and select the completed feasibility evaluation that defines the vehicle, shifts, battery and charging design.",
          },
          {
            title: "Review the inherited configuration",
            text: "Check the selected evaluation, operating assumptions, representative temperatures and their occurrences before starting the calculation.",
          },
          {
            title: "Read Overview and Efficiency",
            text: "Use the headline annual indicators, temperature-dependent consumption, uncertainty intervals and occurrence-weighted energy contributions to understand yearly operation.",
          },
          {
            title: "Review Costs and Emissions",
            text: "Inspect the economic and environmental tabs, their editable assumptions and methodology information. Missing inputs and incomplete assessment boundaries are reported rather than silently treated as zero.",
          },
          {
            title: "Inspect or download the configuration",
            text: "Use View configuration data to verify provenance and Download all results to save the complete JSON result.",
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
            text: "Review the same Overview, Efficiency, Cost and Emissions categories for both analyses. When shift sets or assumptions differ, interpret aggregate differences with care.",
          },
          {
            title: "Export evidence",
            text: "Use the Details / Export area to export comparison data as CSV or JSON. Yearly result pages also provide the complete analysis result as JSON.",
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
      updatedValue: "17. September 2026",
      footer:
        "ELETTRA unterstützt Vorstudien. Endgültige Fahrzeug-, Lade-, Netz- und Infrastrukturentscheidungen müssen durch eine detaillierte Fachplanung bestätigt werden.",
      skipLink: "Zum Handbuch springen",
      sidebarAriaLabel: "Inhalt des Handbuchs",
      brandAriaLabel: "ELETTRA-Benutzerhandbuch",
      screenshotNote: "Die Screenshots zeigen Beispiele in verschiedenen unterstützten Oberflächensprachen.",
      openImage: "Screenshot in voller Grösse öffnen",
    },
    sections: [
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
            text: "Öffnen Sie ELETTRA über den obigen Link. Melden Sie sich mit einem bestehenden Konto an oder erstellen Sie ein Konto und wählen Sie bei Bedarf das zuständige Transportunternehmen.",
          },
          {
            title: "Hauptnavigation verwenden",
            text: "Unter Flotte finden Sie Busmodelle, benutzerdefinierte Haltestellen und Dienste. Unter Simulationen finden Sie Machbarkeitsbewertung, Jahresanalysen und Analysenvergleich.",
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
          { title: "Dienst aufbauen", text: "Wählen Sie Fahrplanfahrten, Start- und Rückkehrort und prüfen Sie den geordneten Dienst einschliesslich Leerfahrten." },
          { title: "Machbarkeitsbewertung durchführen", text: "Wählen Sie einen oder mehrere Dienste, den Optimierungsmodus sowie Betriebs- und Ladeannahmen." },
          { title: "Technischen Entscheidungspunkt prüfen", text: "Prüfen Sie Machbarkeit, Energiebedarf, nutzbare Batterieenergie, erforderliche Packs und Ladeergebnisse, bevor Sie fortfahren." },
          { title: "Jahresanalysen erstellen, vergleichen und exportieren", text: "Bewerten Sie das machbare Design unter repräsentativen Temperaturen, prüfen Sie Jahresindikatoren und vergleichen Sie gespeicherte Alternativen." },
        ],
      },
      {
        id: "fleet",
        title: "3. Busmodelle und benutzerdefinierte Haltestellen",
        intro: "Wiederverwendbare Fahrzeug- und Ortsdaten liefern die technischen Eingaben für Dienste und Bewertungen.",
        items: [
          { title: "Busmodelle", text: "Öffnen Sie Flotte → Busmodelle und wählen Sie Busmodell hinzufügen. Eine Fahrzeugkategorie liefert Ausgangswerte; prüfen Sie danach alle technischen und wirtschaftlichen Pflichtfelder. Ersetzen Sie Standardwerte durch Betreiber- oder Herstellerdaten, wenn diese verfügbar sind." },
          { title: "Batteriegrenzen", text: "Minimale und maximale Packzahl, Packkapazität und Packmasse definieren die zulässigen Batteriekonfigurationen. Die maximale Ladeleistung begrenzt die vom Fahrzeug aufnehmbare Leistung." },
          { title: "Benutzerdefinierte Haltestellen", text: "Öffnen Sie Flotte → Benutzerdefinierte Haltestellen und wählen Sie den Typ. Geben Sie Adresse oder Koordinaten ein oder setzen Sie den Punkt auf der Karte. Verwenden Sie eindeutige Namen für Depots, Ladeorte und Knoten." },
        ],
        figures: getGuideFigures("de", "customStop"),
        note: { title: "Vor Bearbeiten oder Löschen", text: "Wiederverwendbare Datensätze können von Diensten oder Analysen referenziert werden. Prüfen Sie abhängige Arbeiten, bevor Sie einen bereits verwendeten Datensatz ändern." },
      },
      {
        id: "shifts",
        title: "4. Dienst aufbauen",
        intro: "Ein Dienst stellt den vollständigen, geordneten Tagesumlauf dar, der für ein Busmodell bewertet wird.",
        ordered: true,
        items: [
          { title: "Flotte → Dienste öffnen und Dienst erstellen", text: "Vergeben Sie einen verständlichen Namen und wählen Sie das vorgesehene Busmodell." },
          { title: "Fahrplanfahrten filtern und hinzufügen", text: "Filtern Sie nach Linie und Tag und fügen Sie die benötigten Fahrten in Betriebsreihenfolge hinzu." },
          { title: "Grenzen des Dienstes festlegen", text: "Wählen Sie Start- und Rückkehrort sowie die Zeiten. ELETTRA berücksichtigt die Verbindungsfahrten, die für den vollständigen Dienst benötigt werden." },
          { title: "Prüfen und speichern", text: "Prüfen Sie Fahrtenfolge, Zeitachse, Distanz sowie Karten- und Höhenkontext. Korrigieren Sie Lücken oder unplausible Zeiten vor dem Speichern." },
        ],
        figures: getGuideFigures("de", "shift"),
        note: { title: "Warum der vollständige Dienst wichtig ist", text: "Depot- und Überführungsfahrten benötigen Energie, auch wenn keine Fahrgäste befördert werden. Ihr Weglassen kann die Bewertung zu optimistisch machen." },
      },
      {
        id: "feasibility",
        title: "5. Machbarkeitsbewertung",
        intro: "Die Machbarkeitsbewertung verbindet den prognostizierten Energiebedarf mit Batterie- und Ladeentscheidungen.",
        ordered: true,
        items: [
          { title: "Dienste auswählen", text: "Öffnen Sie Simulationen → Machbarkeitsbewertung, erstellen Sie eine neue Bewertung und wählen Sie die gemeinsam zu untersuchenden Dienste." },
          { title: "Optimierungsmodus wählen", text: "Nur Batterie variiert die Packkonfiguration; Laden hält die Batterie fest und bewertet die Ladeinfrastruktur; Gemeinsam bewertet Batterie- und Ladeentscheidungen zusammen." },
          { title: "Szenario festlegen", text: "Prüfen Sie Aussentemperatur, Belegung, Heizung, nutzbares Ladezustandsfenster und erweiterte Betriebsparameter. Konfigurieren Sie bei Bedarf mögliche Ladeorte." },
          { title: "Berechnung starten und Abschluss abwarten", text: "Die Bewertung wird als benannter Lauf gespeichert. Status und Fortschritt werden angezeigt; ein laufender Prozess ist noch kein Ergebnis." },
          { title: "Urteil vor anderen Indikatoren lesen", text: "Ein erfolgreich beendeter Solverlauf kann physisch nicht machbar sein, wenn die erforderliche Batterie das Fahrzeuglimit überschreitet. Prüfen Sie zuerst Urteil und erforderliche gegenüber verfügbaren Packs." },
        ],
        figures: getGuideFigures("de", "feasibilityForm"),
        note: { title: "Konservative Dimensionierung", text: "Verwenden Sie für den technischen Entscheidungspunkt ein anspruchsvolles, aber plausibles Szenario. Der repräsentative Jahresbetrieb wird separat bewertet." },
      },
      {
        id: "results",
        title: "6. Machbarkeitsergebnisse interpretieren",
        intro: "Behandeln Sie das Ergebnis als Entscheidungspunkt, der durch Energie- und Ladeinformationen gestützt wird.",
        items: [
          { title: "Machbarkeitsurteil", text: "Machbar — Bedarfsszenario Q50 bedeutet, dass die analysierte Konfiguration die implementierten Energie-, Ladezustands-, Zeit- und Ladebedingungen mit dem Medianbedarf erfüllt. Q05 und Q95 bleiben Vergleichsszenarien zur Einordnung der Unsicherheit. Nicht machbar bedeutet, dass Annahmen oder Designentscheidungen geändert werden müssen." },
          { title: "Energie und Unsicherheit", text: "Vergleichen Sie Prognosequantile, Antriebs- und Nebenverbrauch sowie nutzbare Batterieenergie. Eine breitere Prognosespanne weist auf eine grössere Unsicherheit hin." },
          { title: "Batterie und Laden", text: "Prüfen Sie optimierte und maximal physische Packzahl, minimalen und maximalen Ladezustand, geladene Energie, Ladevorgänge und Stationsnutzung, sofern verfügbar." },
          { title: "Iterieren", text: "Duplizieren oder erstellen Sie Bewertungen für andere Fahrzeuge, Dienste, Ladezustandsfenster, Temperaturen, Belegungen oder Ladekonfigurationen. Verwenden Sie eindeutige Namen." },
        ],
        figures: getGuideFigures("de", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Jahresanalyse",
        intro: "Die Jahresanalyse hält das machbare technische Design fest und bewertet es unter repräsentativen Jahrestemperaturen.",
        ordered: true,
        items: [
          { title: "Analyse aus einer geeigneten Bewertung erstellen", text: "Öffnen Sie Simulationen → Jahresanalysen, erstellen Sie eine Analyse und wählen Sie die abgeschlossene Machbarkeitsbewertung, die Fahrzeug, Dienste, Batterie und Laden festlegt." },
          { title: "Übernommene Konfiguration prüfen", text: "Prüfen Sie Bewertung, Betriebsannahmen, repräsentative Temperaturen und deren Häufigkeiten vor dem Start." },
          { title: "Übersicht und Effizienz lesen", text: "Nutzen Sie Jahreskennzahlen, temperaturabhängigen Verbrauch, Unsicherheitsintervalle und gewichtete Energiebeiträge zur Beurteilung des Jahresbetriebs." },
          { title: "Kosten und Emissionen prüfen", text: "Prüfen Sie Wirtschafts- und Umweltregister, veränderbare Annahmen und Methodeninformationen. Fehlende Eingaben und unvollständige Grenzen werden ausgewiesen und nicht als null behandelt." },
          { title: "Konfiguration prüfen oder herunterladen", text: "Mit Konfigurationsdaten anzeigen prüfen Sie die Herkunft; mit Alle Ergebnisse herunterladen speichern Sie das vollständige JSON-Ergebnis." },
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
          { title: "Konsistente Indikatoren vergleichen", text: "Prüfen Sie für beide Analysen Übersicht, Effizienz, Kosten und Emissionen. Bei unterschiedlichen Diensten oder Annahmen sind aggregierte Unterschiede vorsichtig zu interpretieren." },
          { title: "Nachweise exportieren", text: "Im Bereich Details / Export können Vergleichsdaten als CSV oder JSON exportiert werden. Jahresergebnisse bieten zusätzlich das vollständige Ergebnis als JSON." },
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
        "Un guide concis et orienté vers les tâches pour préparer un service de bus, vérifier sa faisabilité technique et interpréter les résultats annuels d’énergie, de coûts et d’environnement.",
      baselineLabel: "Version de référence de l’interface",
      baselineValue: `Frontend v${GUIDE_BASELINE_VERSION}`,
      updatedLabel: "Guide mis à jour",
      updatedValue: "17 septembre 2026",
      footer:
        "ELETTRA soutient les études de préfaisabilité. Les décisions finales relatives aux véhicules, à la recharge, au réseau et aux infrastructures doivent être confirmées par des études d’ingénierie détaillées.",
      skipLink: "Accéder au guide",
      sidebarAriaLabel: "Sommaire du guide",
      brandAriaLabel: "Guide d’utilisation ELETTRA",
      screenshotNote: "Les captures présentent des exemples dans différentes langues prises en charge par l’interface.",
      openImage: "Ouvrir la capture en taille réelle",
    },
    sections: [
      {
        id: "start",
        title: "1. Premiers pas",
        intro: "Le guide est public, mais les données de flotte et les analyses nécessitent un compte ELETTRA.",
        items: [
          { title: "Choisir la langue de l’interface", text: "Utilisez le sélecteur de langue dans l’en-tête de l’application. L’anglais, l’allemand, le français et l’italien sont disponibles; la préférence est conservée dans le navigateur." },
          { title: "Se connecter ou créer un compte", text: "Ouvrez ELETTRA avec le lien ci-dessus. Connectez-vous avec un compte existant ou créez-en un et sélectionnez l’entreprise de transport appropriée lorsque cela est demandé." },
          { title: "Utiliser la navigation principale", text: "Flotte contient Modèles de bus, Arrêts personnalisés et Services. Simulations contient Évaluation de faisabilité, Analyses annuelles et Comparaison d’analyses." },
        ],
        figures: getGuideFigures("fr", "shell"),
        note: { title: "Périmètre de l’évaluation", text: "ELETTRA est un outil de planification et de préfaisabilité. Un résultat faisable dépend des hypothèses retenues pour le service, le véhicule, la météo, l’occupation, la batterie et la recharge; il ne constitue pas une certification opérationnelle." },
      },
      {
        id: "workflow",
        title: "2. Flux de travail recommandé",
        intro: "Suivez les étapes dans l’ordre afin que chaque analyse repose sur un véhicule, un service et un scénario traçables.",
        ordered: true,
        items: [
          { title: "Créer un modèle de bus", text: "Décrivez le bus candidat: catégorie, capacité, masse, limites de batterie, puissance de recharge, coûts et durées de vie." },
          { title: "Créer les arrêts personnalisés nécessaires", text: "Ajoutez les dépôts, points de recharge ou pôles qui ne figurent pas parmi les arrêts planifiés du réseau." },
          { title: "Construire un service", text: "Sélectionnez les courses planifiées, définissez les lieux de départ et de retour et vérifiez le service ordonné avec les mouvements auxiliaires." },
          { title: "Lancer une évaluation de faisabilité", text: "Sélectionnez un ou plusieurs services, choisissez le mode d’optimisation et définissez les hypothèses d’exploitation et de recharge." },
          { title: "Vérifier la décision technique", text: "Examinez le verdict, la demande énergétique, l’énergie utile, les packs requis et les résultats de recharge avant de poursuivre." },
          { title: "Créer, comparer et exporter les analyses annuelles", text: "Réutilisez le design faisable avec des températures représentatives, examinez les indicateurs annuels et comparez les variantes enregistrées." },
        ],
      },
      {
        id: "fleet",
        title: "3. Modèles de bus et arrêts personnalisés",
        intro: "Les données réutilisables sur les véhicules et les lieux alimentent les services et les évaluations.",
        items: [
          { title: "Modèles de bus", text: "Ouvrez Flotte → Modèles de bus et sélectionnez Ajouter un modèle de bus. Une catégorie de véhicule initialise des valeurs représentatives; vérifiez ensuite tous les champs techniques et économiques requis. Remplacez les valeurs par défaut lorsque des données d’opérateur ou de constructeur sont disponibles." },
          { title: "Limites de batterie", text: "Les nombres minimal et maximal de packs, leur capacité et leur masse définissent les configurations utilisables par le calcul. La puissance maximale de recharge limite la puissance acceptée par le véhicule." },
          { title: "Arrêts personnalisés", text: "Ouvrez Flotte → Arrêts personnalisés et choisissez le type. Saisissez une adresse ou des coordonnées, ou placez le point sur la carte. Utilisez des noms clairs pour les dépôts, points de recharge et pôles." },
        ],
        figures: getGuideFigures("fr", "customStop"),
        note: { title: "Avant de modifier ou supprimer", text: "Les données réutilisables peuvent être référencées par des services ou des analyses. Vérifiez les travaux dépendants avant de modifier une donnée déjà utilisée." },
      },
      {
        id: "shifts",
        title: "4. Construire un service",
        intro: "Un service représente la mission journalière complète et ordonnée évaluée pour un modèle de bus candidat.",
        ordered: true,
        items: [
          { title: "Ouvrir Flotte → Services et créer un service", text: "Donnez au service un nom explicite et sélectionnez le modèle de bus candidat." },
          { title: "Filtrer et ajouter les courses planifiées", text: "Utilisez les filtres de ligne et de jour, puis ajoutez les courses dans leur ordre d’exploitation." },
          { title: "Définir les limites du service", text: "Sélectionnez les lieux et heures de départ et de retour. ELETTRA inclut les déplacements auxiliaires nécessaires pour représenter la mission complète." },
          { title: "Vérifier et enregistrer", text: "Contrôlez la séquence, la chronologie, la distance et le contexte cartographique et altimétrique. Corrigez les lacunes ou horaires invraisemblables avant l’enregistrement." },
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
          { title: "Sélectionner les services", text: "Ouvrez Simulations → Évaluation de faisabilité, créez une nouvelle évaluation et sélectionnez les services à analyser ensemble." },
          { title: "Choisir un mode d’optimisation", text: "Batterie uniquement fait varier les packs; Recharge maintient la batterie fixe et évalue l’infrastructure; Conjoint évalue simultanément batterie et recharge." },
          { title: "Définir le scénario", text: "Vérifiez la température extérieure, l’occupation, le chauffage, la fenêtre utile d’état de charge et les paramètres avancés. Configurez les lieux de recharge candidats lorsque nécessaire." },
          { title: "Lancer et attendre la fin", text: "L’évaluation est enregistrée comme un calcul nommé. La progression et l’état d’exécution sont affichés; un calcul inachevé ne doit pas être interprété comme un résultat." },
          { title: "Lire le verdict en premier", text: "Un calcul résolu peut rester physiquement infaisable si la batterie requise dépasse la limite du véhicule. Vérifiez d’abord le verdict et les packs requis par rapport aux packs disponibles." },
        ],
        figures: getGuideFigures("fr", "feasibilityForm"),
        note: { title: "Dimensionnement conservateur", text: "Utilisez un scénario exigeant mais plausible pour la décision technique. L’exploitation annuelle représentative est évaluée séparément." },
      },
      {
        id: "results",
        title: "6. Interpréter les résultats de faisabilité",
        intro: "Interprétez le résultat comme une décision technique étayée par des informations d’énergie et de recharge.",
        items: [
          { title: "Verdict de faisabilité", text: "Faisable — scénario de demande Q50 signifie que la configuration respecte les contraintes implémentées d’énergie, d’état de charge, de temps et de recharge avec la demande médiane. Q05 et Q95 restent des scénarios de comparaison pour apprécier l’incertitude. Infaisable signifie qu’une hypothèse ou un choix de conception doit être revu." },
          { title: "Énergie et incertitude", text: "Comparez les quantiles de prédiction, la demande de traction et auxiliaire et l’énergie utile de la batterie. Une plage plus large indique une incertitude plus élevée." },
          { title: "Batterie et recharge", text: "Examinez les packs optimisés et la limite physique, les états de charge minimal et maximal, l’énergie chargée, les sessions et l’utilisation des stations lorsqu’ils sont disponibles." },
          { title: "Itérer", text: "Dupliquez ou créez une évaluation pour tester un autre véhicule, service, état de charge, température, occupation ou dispositif de recharge. Donnez un nom distinct à chaque cas." },
        ],
        figures: getGuideFigures("fr", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Analyse annuelle",
        intro: "L’analyse annuelle maintient fixe le design technique faisable et l’évalue pour des températures annuelles représentatives.",
        ordered: true,
        items: [
          { title: "Créer une analyse à partir d’une évaluation admissible", text: "Ouvrez Simulations → Analyses annuelles, créez une analyse et sélectionnez l’évaluation terminée qui définit le véhicule, les services, la batterie et la recharge." },
          { title: "Vérifier la configuration héritée", text: "Contrôlez l’évaluation sélectionnée, les hypothèses d’exploitation, les températures représentatives et leurs occurrences avant le calcul." },
          { title: "Lire Aperçu et Efficacité", text: "Utilisez les indicateurs annuels, la consommation selon la température, les intervalles d’incertitude et les contributions pondérées pour comprendre l’exploitation annuelle." },
          { title: "Examiner Coûts et Émissions", text: "Examinez les onglets économiques et environnementaux, les hypothèses modifiables et les informations méthodologiques. Les entrées manquantes et les périmètres incomplets sont signalés au lieu d’être traités comme zéro." },
          { title: "Examiner ou télécharger la configuration", text: "Utilisez Afficher les données de configuration pour vérifier la provenance et Télécharger tous les résultats pour enregistrer le résultat JSON complet." },
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
          { title: "Comparer des indicateurs cohérents", text: "Examinez Aperçu, Efficacité, Coûts et Émissions pour les deux analyses. Si les services ou hypothèses diffèrent, interprétez les écarts agrégés avec prudence." },
          { title: "Exporter les éléments probants", text: "Utilisez la zone Détails / Export pour exporter les données en CSV ou JSON. Les pages de résultats annuels proposent également le résultat complet au format JSON." },
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
          { title: "Comparer ce qui est comparable", text: "Maintenez un périmètre de service, une distance annuelle et des limites cohérents. Tenez compte des avertissements de compatibilité de l’application." },
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
      updatedValue: "17 settembre 2026",
      footer:
        "ELETTRA supporta studi di prefattibilità. Le decisioni finali su veicoli, ricarica, rete e infrastrutture devono essere confermate mediante una progettazione tecnica dettagliata.",
      skipLink: "Vai alla guida",
      sidebarAriaLabel: "Indice della guida",
      brandAriaLabel: "Guida utente ELETTRA",
      screenshotNote: "Le schermate mostrano esempi in diverse lingue supportate dall’interfaccia.",
      openImage: "Apri la schermata a dimensione intera",
    },
    sections: [
      {
        id: "start",
        title: "1. Per iniziare",
        intro: "La guida è pubblica, ma i dati della flotta e le analisi richiedono un account ELETTRA.",
        items: [
          { title: "Scegliere la lingua dell’interfaccia", text: "Usare il selettore della lingua nell’intestazione dell’applicazione. Sono disponibili inglese, tedesco, francese e italiano; la preferenza viene memorizzata nel browser." },
          { title: "Accedere o creare un account", text: "Aprire ELETTRA dal collegamento qui sopra. Accedere con un account esistente oppure crearne uno e selezionare l’azienda di trasporto appropriata quando richiesto." },
          { title: "Usare la navigazione principale", text: "Flotta contiene Modelli di autobus, Fermate personalizzate e Turni. Simulazioni contiene Valutazione di fattibilità, Analisi annuali e Confronto analisi." },
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
          { title: "Costruire un turno", text: "Selezionare le corse programmate, definire le località di partenza e ritorno e verificare il servizio ordinato e gli spostamenti ausiliari." },
          { title: "Eseguire una valutazione di fattibilità", text: "Selezionare uno o più turni, scegliere la modalità di ottimizzazione e impostare le ipotesi operative e di ricarica." },
          { title: "Verificare il controllo tecnico", text: "Esaminare il verdetto, la domanda energetica, l’energia utilizzabile, i pacchi richiesti e i risultati di ricarica prima di proseguire." },
          { title: "Creare, confrontare ed esportare le analisi annuali", text: "Riutilizzare il progetto fattibile con temperature rappresentative, esaminare gli indicatori annuali e confrontare le alternative salvate." },
        ],
      },
      {
        id: "fleet",
        title: "3. Modelli di autobus e fermate personalizzate",
        intro: "I dati riutilizzabili di veicoli e località forniscono gli input tecnici per turni e valutazioni.",
        items: [
          { title: "Modelli di autobus", text: "Aprire Flotta → Modelli di autobus e selezionare Aggiungi modello. Scegliere una categoria per inizializzare valori rappresentativi, quindi verificare tutti i campi tecnici ed economici obbligatori. Sostituire i valori predefiniti quando sono disponibili dati dell’operatore o del costruttore." },
          { title: "Limiti della batteria", text: "Numero minimo e massimo di pacchi, capacità e massa definiscono le configurazioni utilizzabili dal calcolo. La potenza massima di ricarica limita la potenza accettata dal veicolo." },
          { title: "Fermate personalizzate", text: "Aprire Flotta → Fermate personalizzate e scegliere il tipo. Inserire indirizzo o coordinate oppure posizionare il punto sulla mappa. Usare nomi chiari per depositi, punti di ricarica e nodi." },
        ],
        figures: getGuideFigures("it", "customStop"),
        note: { title: "Prima di modificare o eliminare", text: "I record riutilizzabili possono essere referenziati da turni o analisi. Verificare i lavori dipendenti prima di modificare un record già utilizzato." },
      },
      {
        id: "shifts",
        title: "4. Costruire un turno",
        intro: "Un turno rappresenta il servizio giornaliero completo e ordinato valutato per un modello di autobus candidato.",
        ordered: true,
        items: [
          { title: "Aprire Flotta → Turni e creare un turno", text: "Assegnare un nome riconoscibile e selezionare il modello di autobus candidato." },
          { title: "Filtrare e aggiungere le corse programmate", text: "Usare i filtri per linea e giorno, quindi aggiungere le corse necessarie nel loro ordine operativo." },
          { title: "Definire i limiti del servizio", text: "Selezionare località e orari di partenza e ritorno. ELETTRA include gli spostamenti ausiliari necessari per rappresentare il servizio completo." },
          { title: "Verificare e salvare", text: "Controllare sequenza, linea temporale, distanza e contesto cartografico e altimetrico. Correggere lacune o tempi non plausibili prima di salvare." },
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
          { title: "Selezionare i turni", text: "Aprire Simulazioni → Valutazione di fattibilità, creare una nuova valutazione e selezionare i turni da analizzare insieme." },
          { title: "Scegliere una modalità di ottimizzazione", text: "Solo batteria varia la configurazione dei pacchi; Ricarica mantiene fissa la batteria e valuta l’infrastruttura; Congiunta valuta insieme batteria e ricarica." },
          { title: "Impostare lo scenario", text: "Verificare temperatura esterna, occupazione, riscaldamento, intervallo utilizzabile dello stato di carica e parametri avanzati. Configurare i punti di ricarica candidati quando necessario." },
          { title: "Eseguire e attendere il completamento", text: "La valutazione viene salvata come esecuzione con nome. L’applicazione mostra avanzamento e stato; un’esecuzione non conclusa non è un risultato." },
          { title: "Leggere prima il verdetto", text: "Un calcolo concluso può essere fisicamente non fattibile se la batteria richiesta supera il limite del veicolo. Verificare prima verdetto e pacchi richiesti rispetto a quelli disponibili." },
        ],
        figures: getGuideFigures("it", "feasibilityForm"),
        note: { title: "Dimensionamento conservativo", text: "Usare uno scenario impegnativo ma plausibile per il controllo tecnico. L’esercizio annuale rappresentativo viene valutato separatamente." },
      },
      {
        id: "results",
        title: "6. Interpretare i risultati di fattibilità",
        intro: "Trattare il risultato come un controllo decisionale supportato da evidenze energetiche e di ricarica.",
        items: [
          { title: "Verdetto di fattibilità", text: "Fattibile — scenario di domanda Q50 significa che la configurazione rispetta i vincoli implementati di energia, stato di carica, tempo e ricarica usando la domanda mediana. Q05 e Q95 restano scenari di confronto per valutare l’incertezza. Non fattibile significa che occorre rivedere ipotesi o scelte progettuali." },
          { title: "Energia e incertezza", text: "Confrontare quantili di previsione, domanda di trazione e ausiliaria ed energia utilizzabile. Un intervallo più ampio indica maggiore incertezza nella domanda prevista." },
          { title: "Batteria e ricarica", text: "Esaminare pacchi ottimizzati e limite fisico, stato di carica minimo e massimo, energia caricata, sessioni e uso delle stazioni quando disponibili." },
          { title: "Iterare", text: "Duplicare o creare valutazioni per provare un altro veicolo, servizio, intervallo SOC, temperatura, occupazione o configurazione di ricarica. Usare un nome distinto per ogni caso." },
        ],
        figures: getGuideFigures("it", "feasibilityEfficiency", "feasibilitySizing"),
      },
      {
        id: "yearly",
        title: "7. Analisi annuale",
        intro: "L’analisi annuale mantiene fisso il progetto tecnico fattibile e lo valuta con condizioni di temperatura annuali rappresentative.",
        ordered: true,
        items: [
          { title: "Creare un’analisi da una valutazione idonea", text: "Aprire Simulazioni → Analisi annuali, creare una nuova analisi e selezionare la valutazione completata che definisce veicolo, turni, batteria e ricarica." },
          { title: "Verificare la configurazione ereditata", text: "Controllare la valutazione selezionata, le ipotesi operative, le temperature rappresentative e le loro occorrenze prima dell’avvio." },
          { title: "Leggere Panoramica ed Efficienza", text: "Usare indicatori annuali, consumo in funzione della temperatura, intervalli d’incertezza e contributi energetici ponderati per comprendere l’esercizio annuale." },
          { title: "Esaminare Costi ed Emissioni", text: "Esaminare le schede economiche e ambientali, le ipotesi modificabili e le informazioni metodologiche. Input mancanti e perimetri incompleti sono segnalati invece di essere trattati come zero." },
          { title: "Esaminare o scaricare la configurazione", text: "Usare Visualizza dati di configurazione per verificare la provenienza e Scarica tutti i risultati per salvare il risultato JSON completo." },
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
          { title: "Confrontare indicatori coerenti", text: "Esaminare Panoramica, Efficienza, Costi ed Emissioni per entrambe le analisi. Se turni o ipotesi differiscono, interpretare con cautela le differenze aggregate." },
          { title: "Esportare le evidenze", text: "Usare Dettagli / Esporta per esportare i dati in CSV o JSON. Le pagine dei risultati annuali permettono inoltre di scaricare il risultato completo in JSON." },
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
