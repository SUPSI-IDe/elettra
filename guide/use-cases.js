// Keep the case IDs stable for saved links when a heading is reworded.
export const useCaseSections = {
  en: {
    id: "use-cases",
    title: "Quick start",
    intro: "To assess a line, select the vehicle blocks that cover its service on the chosen day. Choose a feasibility mode based on what you’ve already decided about the battery and charging.",
    firstAccess: "First access",
    diagram: {
      title: "Planning workflow",
      preparation: "Preparation",
      fleet: "Define the bus model, depots and any other custom stops", shifts: "Build the vehicle blocks",
      feasibility: "Select the timetable, service day and blocks",
      modes: "Choose the mode for your planning question", run: "Run the feasibility evaluation",
      decision: "Technically feasible?", no: "No", revise: "Revise the scenario and repeat",
      yes: "Yes — verified feasible", yearly: "Yearly analysis", impacts: "Energy · Costs · Emissions",
      compare: "Compare scenarios",
    },
    items: [
      {
        id: "use-case-fleet", mode: "BATTERY_ONLY", modeLabel: "Battery only",
        title: "I’ve chosen where to charge. What is the smallest battery that can cover these vehicle blocks?",
        summary: "Keep plug counts and power fixed at each site. ELETTRA finds the minimum number of packs.",
        instructions: [
          "Choose the bus model and tick the sites where charging is available or planned.",
          "Enter the fixed number of plugs, power per plug and site power limit for each selected site.",
          "In a feasible result, check the minimum number of battery packs needed to cover the selected blocks.",
        ],
      },
      {
        id: "use-case-charging", mode: "CHARGING", modeLabel: "Charging",
        title: "I’ve chosen the bus and battery. Where do I need charging?",
        summary: "Specify the candidate sites and their power limits. ELETTRA determines which sites need plugs and how many.",
        instructions: [
          "Choose the bus model and enter the fixed number of battery packs.",
          "Tick the sites where charging could be installed. Set the maximum number of plugs, power per plug and site power limit for each.",
          "In a feasible result, check which sites to equip and how many plugs to install at each.",
        ],
      },
      {
        id: "use-case-initial", mode: "JOINT", modeLabel: "Joint",
        title: "Which combination of battery and charging requires the lowest initial investment?",
        summary: "ELETTRA compares battery packs and plugs at the candidate sites using the costs you enter.",
        instructions: [
          "Choose the bus model and tick the candidate sites. Set the maximum plugs, power per plug and power limit for each site.",
          "Check the cost per battery pack in the bus model and review the charging infrastructure costs.",
          "In a feasible result, review the pack counts, charging sites and plug counts for the lowest initial investment.",
        ],
      },
    ],
  },
  de: {
    id: "use-cases",
    title: "Schnellstart",
    intro: "Um eine Linie zu beurteilen, wählen Sie die Fahrzeugumläufe, die den Betrieb am gewählten Tag abdecken. Wählen Sie den Modus danach, was für Batterie und Ladeinfrastruktur bereits feststeht.",
    firstAccess: "Erster Zugang",
    diagram: {
      title: "Planungsablauf",
      preparation: "Vorbereitung",
      fleet: "Busmodell, Depots und bei Bedarf weitere individuelle Haltestellen festlegen", shifts: "Fahrzeugumläufe erstellen",
      feasibility: "Fahrplan, Verkehrstag und Umläufe auswählen",
      modes: "Modus für Ihre Planungsfrage wählen", run: "Machbarkeitsprüfung starten",
      decision: "Technisch machbar?", no: "Nein", revise: "Szenario überarbeiten und erneut prüfen",
      yes: "Ja — Machbarkeit geprüft", yearly: "Jahresanalyse", impacts: "Energie · Kosten · Emissionen",
      compare: "Szenarien vergleichen",
    },
    items: [
      {
        id: "use-case-fleet", mode: "BATTERY_ONLY", modeLabel: "Nur Batterie",
        title: "Die Ladestandorte stehen fest. Wie klein darf die Batterie für diese Fahrzeugumläufe sein?",
        summary: "Anzahl und Leistung der Ladeanschlüsse je Standort sind vorgegeben. ELETTRA ermittelt die kleinste benötigte Anzahl Batteriepacks.",
        instructions: [
          "Wählen Sie das Busmodell und markieren Sie die Standorte, an denen das Laden möglich oder vorgesehen ist.",
          "Geben Sie je Standort die feste Anzahl Ladeanschlüsse, die Leistung pro Anschluss und das Standortlimit ein.",
          "Lesen Sie bei einer machbaren Auslegung ab, wie viele Batteriepacks die gewählten Umläufe mindestens erfordern.",
        ],
      },
      {
        id: "use-case-charging", mode: "CHARGING", modeLabel: "Laden",
        title: "Bus und Batterie stehen fest. Wo brauche ich Ladeanschlüsse?",
        summary: "Sie geben mögliche Standorte und Leistungsgrenzen vor. ELETTRA ermittelt, an welchen Standorten wie viele Anschlüsse nötig sind.",
        instructions: [
          "Wählen Sie das Busmodell und geben Sie die feste Anzahl Batteriepacks ein.",
          "Markieren Sie die Standorte, an denen Ladeanschlüsse möglich wären. Geben Sie je Standort die maximale Anschlusszahl, die Leistung pro Anschluss und das Standortlimit ein.",
          "Lesen Sie bei einer machbaren Auslegung ab, welche Standorte wie viele Anschlüsse brauchen.",
        ],
      },
      {
        id: "use-case-initial", mode: "JOINT", modeLabel: "Gemeinsam",
        title: "Welche Kombination aus Batterie und Ladeinfrastruktur erfordert die geringste Anfangsinvestition?",
        summary: "ELETTRA vergleicht Batteriepacks und Ladeanschlüsse an den möglichen Standorten anhand Ihrer Kostenangaben.",
        instructions: [
          "Wählen Sie das Busmodell und markieren Sie die möglichen Ladestandorte. Geben Sie je Standort die maximale Anschlusszahl, die Leistung pro Anschluss und das Standortlimit ein.",
          "Prüfen Sie im Busmodell die Kosten pro Batteriepack und kontrollieren Sie die Kosten der Ladeinfrastruktur.",
          "Lesen Sie bei einer machbaren Auslegung ab, wie viele Batteriepacks und welche Standorte mit wie vielen Anschlüssen die geringste Anfangsinvestition ergeben.",
        ],
      },
    ],
  },
  fr: {
    id: "use-cases",
    title: "Démarrage rapide",
    intro: "Pour évaluer une ligne, sélectionnez les services voiture qui assurent ses courses le jour choisi. Choisissez le mode en fonction de ce qui est déjà décidé pour la batterie et la recharge.",
    firstAccess: "Premier accès",
    diagram: {
      title: "Étapes de la planification",
      preparation: "Préparation",
      fleet: "Définir le modèle de bus, les dépôts et les éventuels autres arrêts personnalisés", shifts: "Construire les services voiture",
      feasibility: "Sélectionner l’horaire, le jour et les services voiture",
      modes: "Choisir le mode adapté à votre question", run: "Lancer l’évaluation de faisabilité",
      decision: "Techniquement réalisable ?", no: "Non", revise: "Réviser le scénario et réévaluer",
      yes: "Oui — faisabilité vérifiée", yearly: "Analyse annuelle", impacts: "Énergie · Coûts · Émissions",
      compare: "Comparer les scénarios",
    },
    items: [
      {
        id: "use-case-fleet", mode: "BATTERY_ONLY", modeLabel: "Batterie uniquement",
        title: "J’ai choisi où recharger. Quelle est la plus petite batterie qui permet d’assurer ces services voiture ?",
        summary: "Le nombre et la puissance des prises sont fixés pour chaque site. ELETTRA calcule le nombre minimal de packs.",
        instructions: [
          "Choisissez le modèle de bus et cochez les sites où la recharge est disponible ou prévue.",
          "Indiquez pour chaque site le nombre fixe de prises, la puissance par prise et la limite de puissance du site.",
          "Si la configuration est faisable, relevez le nombre minimal de packs de batterie requis pour les services voiture sélectionnés.",
        ],
      },
      {
        id: "use-case-charging", mode: "CHARGING", modeLabel: "Recharge",
        title: "J’ai choisi le bus et la batterie. Où faut-il prévoir la recharge ?",
        summary: "Vous indiquez les sites possibles et les puissances disponibles. ELETTRA détermine quels sites équiper et combien de prises y installer.",
        instructions: [
          "Choisissez le modèle de bus et indiquez le nombre fixe de packs de batterie.",
          "Cochez les sites où des prises pourraient être installées. Pour chacun, indiquez le nombre maximal de prises, la puissance par prise et la limite de puissance du site.",
          "Si la configuration est faisable, vérifiez quels sites équiper et combien de prises y installer.",
        ],
      },
      {
        id: "use-case-initial", mode: "JOINT", modeLabel: "Conjoint",
        title: "Quelle combinaison de batterie et de recharge demande le plus faible investissement initial ?",
        summary: "ELETTRA compare les combinaisons de packs et de prises sur les sites possibles, aux coûts que vous indiquez.",
        instructions: [
          "Choisissez le modèle de bus et cochez les sites envisagés. Pour chacun, indiquez le nombre maximal de prises, la puissance par prise et la limite de puissance du site.",
          "Vérifiez le coût par pack dans le modèle de bus et contrôlez les coûts de l’infrastructure de recharge.",
          "Si la configuration est faisable, relevez les nombres de packs et de prises ainsi que les sites à équiper pour l’investissement initial le plus faible.",
        ],
      },
    ],
  },
  it: {
    id: "use-cases",
    title: "Guida rapida",
    intro: "Per valutare una linea, seleziona i turni macchina che ne coprono il servizio nel giorno scelto. Scegli la modalità di fattibilità in base a ciò che hai già deciso su batteria e ricarica.",
    firstAccess: "Primo accesso",
    diagram: {
      title: "Flusso di lavoro",
      preparation: "Preparazione",
      fleet: "Definisci il modello di bus, i depositi e le eventuali altre fermate personalizzate", shifts: "Costruisci i turni macchina",
      feasibility: "Seleziona l’orario GTFS, il giorno e i turni da valutare",
      modes: "Scegli la modalità in base alla tua domanda", run: "Avvia la valutazione di fattibilità",
      decision: "Tecnicamente fattibile?", no: "No", revise: "Rivedi lo scenario e ripeti",
      yes: "Sì — fattibilità verificata", yearly: "Analisi annuale", impacts: "Energia · Costi · Emissioni",
      compare: "Confronta gli scenari",
    },
    items: [
      {
        id: "use-case-fleet", mode: "BATTERY_ONLY", modeLabel: "Solo batteria",
        title: "Ho scelto dove ricaricare. Qual è la batteria minima per svolgere questi turni?",
        summary: "Fissi il numero di prese e la potenza per sito. ELETTRA calcola il numero minimo di pacchi batteria.",
        instructions: [
          "Scegli il modello di bus e spunta i siti dove la ricarica è disponibile o prevista.",
          "Per ogni sito, inserisci il numero fisso di prese, la potenza per presa e il limite di potenza del sito.",
          "Se la configurazione è fattibile, verifica il numero minimo di pacchi batteria richiesto per i turni selezionati.",
        ],
      },
      {
        id: "use-case-charging", mode: "CHARGING", modeLabel: "Ricarica",
        title: "Ho scelto il bus e la batteria. Dove mi serve la ricarica?",
        summary: "Indichi i siti candidati e le potenze disponibili. ELETTRA determina quali siti attrezzare e quante prese servono.",
        instructions: [
          "Scegli il modello di bus e inserisci il numero fisso di pacchi batteria.",
          "Spunta i siti in cui puoi installare le prese. Per ciascuno indica il numero massimo di prese, la potenza per presa e il limite di potenza del sito.",
          "Se la configurazione è fattibile, verifica quali siti attrezzare e con quante prese.",
        ],
      },
      {
        id: "use-case-initial", mode: "JOINT", modeLabel: "Congiunta",
        title: "Quale combinazione di batteria e ricarica richiede l’investimento iniziale più basso?",
        summary: "ELETTRA confronta le combinazioni di pacchi e prese nei siti candidati usando i costi che hai indicato.",
        instructions: [
          "Scegli il modello di bus e spunta i siti candidati. Per ogni sito indica il numero massimo di prese, la potenza per presa e il limite di potenza del sito.",
          "Verifica il costo per pacco nel modello di bus e controlla i costi dell’infrastruttura di ricarica.",
          "Se la configurazione è fattibile, verifica quanti pacchi servono e quali siti attrezzare, con quante prese, per minimizzare l’investimento iniziale.",
        ],
      },
    ],
  },
};
