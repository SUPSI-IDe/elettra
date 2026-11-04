import { getCurrentLang, t } from '../../../i18n';
import { escapeHtml } from '../../../utils/html.js';
import { formatNumber as n, formatChf as chf } from '../../../utils/number-format.js';
import { buildAnnualFleet, computeFleetTco, computeDieselTco, cumulativeCostComparison, scopeFleetLca, scaleAnnualFleet, yearlyTcoDefaults } from '../../../utils/yearly-fleet-tco.js';
import { renderParameterizedLca } from './parameterized-lca';
import { renderAnnualCostCharts } from './yearly-fleet-charts';
import { createAssumptionAutosave } from '../../../utils/assumption-autosave.js';
import './yearly-fleet-dashboard.css';

// Kept with this first local iteration so the financial vocabulary is identical
// in its controls, tables and explanatory notes.
const vocabulary = {
  assignedDuties: ['Assigned vehicle blocks', 'Turni assegnati', 'Zugewiesene Fahrzeugumläufe', 'Roulements affectés'],
  costsTab: ['Costs', 'Costi', 'Kosten', 'Coûts'],
  emissionsTab: ['Emissions', 'Emissioni', 'Emissionen', 'Émissions'],
  electric: ['Electric bus', 'Bus elettrico', 'Elektrobus', 'Bus électrique'],
  diesel: ['Diesel comparator', 'Confronto diesel', 'Dieselvergleich', 'Comparateur diesel'],
  fuel: ['Diesel fuel', 'Carburante diesel', 'Dieselkraftstoff', 'Carburant diesel'],
  energy: ['Energy / fuel', 'Energia / carburante', 'Energie / Kraftstoff', 'Énergie / carburant'],
  dieselCapex: ['Diesel purchase price per bus (CHF)', 'Acquisto bus diesel (CHF/bus)', 'Dieselbus-Kaufpreis (CHF/Bus)', 'Prix du bus diesel (CHF/bus)'],
  dieselLife: ['Diesel bus lifetime (years)', 'Vita utile bus diesel (anni)', 'Dieselbus-Lebensdauer (Jahre)', 'Durée de vie du bus diesel (années)'],
  dieselConsumption: ['Diesel consumption (l/km)', 'Consumo diesel (l/km)', 'Dieselverbrauch (l/km)', 'Consommation diesel (l/km)'],
  dieselMaintenance: ['Diesel maintenance (CHF/km)', 'Manutenzione diesel (CHF/km)', 'Dieselwartung (CHF/km)', 'Entretien diesel (CHF/km)'],
  infrastructureMaintenanceRate: ['Charging infrastructure maintenance (%/year)', 'Manutenzione infrastruttura di ricarica (%/anno)', 'Wartung der Ladeinfrastruktur (%/Jahr)', 'Entretien de la recharge (%/an)'],
  maintenanceMode: ['Infrastructure maintenance estimate', 'Stima manutenzione infrastruttura', 'Schätzung der Infrastrukturwartung', 'Estimation de l’entretien de l’infrastructure'],
  percentMode: ['Percentage of infrastructure investment', 'Percentuale dell’investimento infrastrutturale', 'Anteil der Infrastrukturinvestition', 'Pourcentage de l’investissement infrastructurel'],
  fixedMode: ['Custom annual amount', 'Importo annuo personalizzato', 'Eigener Jahresbetrag', 'Montant annuel personnalisé'],
  maintenanceSource: ['Default: 2%/year. INFRAS 2026, p. 51, gives a 2–5% range. Applying the rate to the full charging infrastructure CAPEX (points, shared works and connection) is our modelling assumption; counted once per fleet, excluding buses and batteries.', 'Default: 2%/anno. INFRAS 2026, p. 51, indica un intervallo del 2–5%. Applicare la percentuale al CAPEX completo della ricarica (punti, opere comuni e allacciamento) è una nostra ipotesi di modello; contato una sola volta per flotta, esclusi bus e batterie.', 'Standard: 2%/Jahr. INFRAS 2026, S. 51, nennt 2–5%. Der Satz auf die gesamten Ladeinfrastrukturkosten (Ladepunkte, gemeinsame Arbeiten und Anschluss) ist unsere Modellannahme; einmal pro Flotte, ohne Busse und Batterien.', 'Valeur initiale : 2%/an. INFRAS 2026, p. 51, indique 2–5%. Appliquer ce taux au CAPEX complet de recharge (bornes, travaux communs et raccordement) est notre hypothèse ; compté une fois par flotte, hors bus et batteries.'],
  mileagePerBus: ['Annual distance per bus (km)', 'Km annui per bus', 'Jahreskilometer je Bus', 'Kilométrage annuel par bus'],
  mileageNote: ['One mileage control per bus model and battery size. All duties in that group scale proportionally, preserving their distance-weighted consumption. Fleet kilometres are the sum of group totals. Changing mileage does not rerun feasibility.', 'Un controllo per modello e taglia della batteria. I turni del gruppo sono scalati proporzionalmente, conservando il consumo ponderato per i km. I km della flotta sono la somma dei gruppi. Cambiare i km non ricalcola la fattibilità.', 'Ein Kilometerregler je Busmodell und Batteriegrösse. Umläufe werden proportional skaliert; der kilometergewichtete Verbrauch bleibt erhalten. Flottenkilometer sind die Summe der Gruppen. Die Machbarkeit wird nicht neu berechnet.', 'Un réglage par modèle de bus et taille de batterie. Les roulements du groupe sont ajustés proportionnellement, en conservant la consommation pondérée par les kilomètres. Le total de flotte est la somme des groupes. La faisabilité n’est pas recalculée.'],
  reset: ['Reset all parameters', 'Ripristina tutti i parametri', 'Alle Parameter zurücksetzen', 'Réinitialiser tous les paramètres'],
  opexComparison: ['Annual operating costs: electric vs diesel', 'Costi operativi annui: elettrico e diesel', 'Jährliche Betriebskosten: Elektro und Diesel', 'Coûts annuels : électrique et diesel'],
  cumulative: ['Cumulative discounted costs and break-even', 'Costi cumulati attualizzati e pareggio', 'Kumulierte diskontierte Kosten und Kostengleichheit', 'Coûts cumulés actualisés et seuil de rentabilité'],
  year: ['year', 'anno', 'Jahr', 'an'],
  breakEven: ['Break-even', 'Pareggio', 'Kostengleichheit', 'Seuil de rentabilité'],
  noBreakEven: ['Not reached within the analysis horizon', 'Non raggiunto nell’orizzonte di analisi', 'Im Analysezeitraum nicht erreicht', 'Non atteint sur la période analysée'],
  residualBreakEven: ['Reached only when including the terminal residual value', 'Raggiunto solo includendo il valore residuo finale', 'Nur mit dem Endrestwert erreicht', 'Atteint uniquement avec la valeur résiduelle finale'],
  cumulativeNote: ['Year-end operating costs; jumps show replacements and the terminal residual credit. Final values equal the discounted TCO numerator. Break-even is the first year after which electric costs stay below diesel through the selected horizon.', 'Costi operativi a fine anno; i salti rappresentano sostituzioni e credito del residuo finale. I valori finali coincidono con il numeratore del TCO attualizzato. Il pareggio è il primo anno dopo il quale i costi elettrici restano inferiori al diesel fino alla fine dell’orizzonte.', 'Betriebskosten am Jahresende; Sprünge zeigen Ersatzinvestitionen und Endrestwert. Endwerte entsprechen dem diskontierten TCO-Zähler. Kostengleichheit wird ab dem ersten Jahr ausgewiesen, nach dem Elektro bis zum Horizont günstiger bleibt.', 'Coûts d’exploitation en fin d’année ; les sauts représentent les remplacements et le crédit de valeur résiduelle. Les valeurs finales correspondent au numérateur du TCO actualisé. Le seuil est la première année après laquelle l’électrique reste moins cher jusqu’à la fin de la période.'],
  comparisonBoundary: ['Same mileage, horizon and discount rate for both designs. Diesel purchase price, consumption, maintenance and lifetime are editable assumptions. Driver costs and fuel-station infrastructure are excluded from this comparison.', 'Stessi km, orizzonte e tasso per entrambe le tecnologie. Prezzo di acquisto, consumo, manutenzione e vita del diesel sono ipotesi modificabili. Costi degli autisti e infrastruttura di rifornimento diesel sono esclusi da questo confronto.', 'Gleiche Kilometer, gleicher Horizont und Diskontsatz. Dieselkaufpreis, Verbrauch, Wartung und Lebensdauer sind veränderbare Annahmen. Fahrer- und Dieseltankstellenkosten sind ausgeschlossen.', 'Même kilométrage, horizon et taux pour les deux technologies. Le prix, la consommation, l’entretien et la durée de vie du diesel sont modifiables. Les coûts de conduite et d’infrastructure de ravitaillement diesel sont exclus.'],
  saving: ['Electric saving / premium', 'Risparmio / sovraccosto elettrico', 'Einsparung / Mehrkosten Elektro', 'Économie / surcoût électrique'],
  annualMaintenanceEstimate: ['Annual infrastructure maintenance, whole fleet', 'Manutenzione annua infrastruttura, intera flotta', 'Jährliche Infrastrukturwartung, gesamte Flotte', 'Entretien annuel de l’infrastructure, flotte entière'],
  years: ['years', 'anni', 'Jahre', 'années'],
  annualImpact: ['Annual impact', 'Impatto annuale', 'Jährliche Wirkung', 'Impact annuel'],
  primaryEnergy: ['Primary energy', 'Energia primaria', 'Primärenergie', 'Énergie primaire'],
  title: ['Annual fleet assessment', 'Analisi annuale della flotta', 'Jährliche Flottenanalyse', 'Analyse annuelle de la flotte'],
  representative: ['Representative bus', 'Bus rappresentativo', 'Repräsentativer Bus', 'Bus représentatif'],
  fleet: ['Fleet', 'Flotta', 'Flotte', 'Flotte'],
  bus: ['bus', 'bus', 'Bus', 'bus'],
  buses: ['buses', 'bus', 'Busse', 'bus'], packs: ['packs', 'pacchi', 'Pakete', 'packs'],
  groupNote: ['Groups keep the vehicle blocks assigned to each battery size by the feasibility evaluation. Only buses within the same group share those duties. Representative consumption is group energy divided by group kilometres; a larger battery does not inherit other groups’ duties.', 'I gruppi mantengono i turni assegnati a ciascuna taglia dalla fattibilità. Solo i bus dello stesso gruppo si ripartiscono quei turni. Il consumo rappresentativo è energia del gruppo divisa per km del gruppo; la batteria più grande non eredita i turni degli altri gruppi.', 'Die Gruppen behalten die in der Machbarkeitsprüfung zugewiesenen Umläufe. Nur Busse derselben Gruppe teilen diese Umläufe. Der repräsentative Verbrauch ist Gruppenenergie geteilt durch Gruppenkilometer; grössere Batterien übernehmen keine anderen Umläufe.', 'Les groupes conservent les roulements affectés à chaque taille de batterie par l’évaluation de faisabilité. Seuls les bus du même groupe se partagent ces roulements. La consommation est l’énergie du groupe divisée par ses kilomètres ; une batterie plus grande ne reprend pas les autres roulements.'],
  distance: ['Annual distance', 'Distanza annuale', 'Jahresfahrleistung', 'Distance annuelle'],
  dc: ['Energy used by the buses', 'Energia consumata dai bus', 'Energieverbrauch der Busse', 'Énergie consommée par les bus'],
  grid: ['Electricity purchased', 'Energia elettrica acquistata', 'Strombezug', 'Électricité achetée'],
  consumption: ['Consumption', 'Consumo', 'Verbrauch', 'Consommation'],
  initial: ['Initial investment', 'Investimento iniziale', 'Anfangsinvestition', 'Investissement initial'],
  equivalent: ['Equivalent annual cost', 'Costo annuo equivalente', 'Äquivalente Jahreskosten', 'Coût annuel équivalent'],
  costs: ['Ownership and charging costs', 'Costi di possesso e ricarica', 'Besitz- und Ladekosten', 'Coûts de possession et de recharge'],
  body: ['Bus without battery', 'Bus senza batteria', 'Bus ohne Batterie', 'Bus sans batterie'],
  battery: ['Battery packs', 'Pacchi batteria', 'Batteriepakete', 'Packs batterie'],
  points: ['Charging points', 'Punti di ricarica', 'Ladepunkte', 'Points de recharge'],
  site: ['Shared site infrastructure', 'Infrastruttura comune del sito', 'Gemeinsame Standortinfrastruktur', 'Infrastructure commune du site'],
  connection: ['Power connection component', 'Componente di allacciamento', 'Leistungsabhängiger Anschluss', 'Composante de raccordement'],
  electricity: ['Electricity', 'Energia elettrica', 'Strom', 'Électricité'],
  maintenance: ['Bus maintenance', 'Manutenzione bus', 'Buswartung', 'Entretien des bus'],
  infraMaintenance: ['Charging infrastructure maintenance', 'Manutenzione infrastruttura di ricarica', 'Wartung der Ladeinfrastruktur', 'Entretien de l’infrastructure de recharge'],
  heater: ['Diesel heating, fuel and maintenance', 'Riscaldamento diesel, carburante e manutenzione', 'Dieselheizung, Kraftstoff und Wartung', 'Chauffage diesel, carburant et entretien'],
  total: ['Total', 'Totale', 'Total', 'Total'],
  annual: ['Annual operating cost', 'Costo operativo annuo', 'Jährliche Betriebskosten', 'Coût d’exploitation annuel'],
  breakdown: ['Investment breakdown', 'Dettaglio investimento', 'Investitionsaufteilung', 'Détail de l’investissement'],
  location: ['Location', 'Fermata / deposito', 'Standort', 'Emplacement'],
  infrastructure: ['Charging infrastructure by location', 'Infrastruttura di ricarica per sito', 'Ladeinfrastruktur nach Standort', 'Infrastructure de recharge par site'],
  allocation: ['Shared infrastructure is counted once for the fleet. The representative bus receives an equal share per bus.', 'L’infrastruttura comune è contata una sola volta nella flotta. Al bus rappresentativo è attribuita una quota uguale per bus.', 'Gemeinsame Infrastruktur wird einmal pro Flotte gezählt. Jeder repräsentative Bus erhält den gleichen Anteil pro Bus.', 'L’infrastructure commune est comptée une seule fois pour la flotte. Une part égale par bus est attribuée au bus représentatif.'],
  assumptions: ['Economic assumptions', 'Ipotesi economiche', 'Wirtschaftliche Annahmen', 'Hypothèses économiques'],
  emissionsAssumptions: ['Activity and diesel consumption', 'Chilometraggi e consumo diesel', 'Fahrleistung und Dieselverbrauch', 'Kilométrage et consommation diesel'],
  emissionsControlsNote: ['These values are shared with Costs. Diesel consumption changes the diesel comparator; mileage changes the annual activity of both technologies, keeping each group’s assigned vehicle blocks.', 'Questi valori sono condivisi con Costi. Il consumo diesel modifica il confronto diesel; i km modificano l’attività annuale di entrambe le tecnologie, mantenendo i turni assegnati a ogni gruppo.', 'Diese Werte gelten auch für Kosten. Der Dieselverbrauch verändert den Dieselvergleich; die Fahrleistung verändert die Jahresaktivität beider Technologien. Die zugewiesenen Umläufe jeder Gruppe bleiben erhalten.', 'Ces valeurs sont partagées avec Coûts. La consommation diesel modifie le comparateur diesel ; le kilométrage modifie l’activité annuelle des deux technologies, en conservant les roulements affectés à chaque groupe.'],
  resetEmissions: ['Reset mileage and diesel consumption', 'Ripristina km e consumo diesel', 'Fahrleistung und Dieselverbrauch zurücksetzen', 'Réinitialiser le kilométrage et la consommation diesel'],
  horizon: ['Analysis horizon (years)', 'Orizzonte di analisi (anni)', 'Analysezeitraum (Jahre)', 'Horizon d’analyse (années)'],
  rate: ['Discount rate (%)', 'Tasso di attualizzazione (%)', 'Diskontsatz (%)', 'Taux d’actualisation (%)'],
  bodyLife: ['Bus lifetime (years)', 'Vita utile bus (anni)', 'Buslebensdauer (Jahre)', 'Durée de vie du bus (années)'],
  batteryLife: ['Battery lifetime (years)', 'Vita utile batteria (anni)', 'Batterielebensdauer (Jahre)', 'Durée de vie de la batterie (années)'],
  pointLife: ['Charging point lifetime (years)', 'Vita utile caricatori (anni)', 'Ladepunktlebensdauer (Jahre)', 'Durée de vie des bornes (années)'],
  siteLife: ['Site / connection lifetime (years)', 'Vita utile sito / allacciamento (anni)', 'Standort- / Anschlusslebensdauer (Jahre)', 'Durée de vie du site / raccordement (années)'],
  energyPrice: ['Electricity price (CHF/kWh grid)', 'Prezzo elettricità (CHF/kWh rete)', 'Strompreis (CHF/kWh Netz)', 'Prix de l’électricité (CHF/kWh réseau)'],
  maintenancePerKm: ['Electric bus maintenance (CHF/km)', 'Manutenzione bus elettrico (CHF/km)', 'Elektrobuswartung (CHF/km)', 'Entretien du bus électrique (CHF/km)'],
  infrastructureMaintenance: ['Infrastructure maintenance, whole fleet (CHF/year)', 'Manutenzione infrastruttura, intera flotta (CHF/anno)', 'Infrastrukturwartung, gesamte Flotte (CHF/Jahr)', 'Entretien de l’infrastructure, flotte entière (CHF/an)'],
  fuelPrice: ['Diesel price (CHF/l)', 'Prezzo diesel (CHF/l)', 'Dieselpreis (CHF/l)', 'Prix du diesel (CHF/l)'],
  autosave_idle: ['Automatic saving', 'Salvataggio automatico', 'Automatisches Speichern', 'Enregistrement automatique'],
  autosave_pending: ['Changes pending', 'Modifiche da salvare', 'Änderungen ausstehend', 'Modifications en attente'],
  autosave_saving: ['Saving…', 'Salvataggio…', 'Wird gespeichert…', 'Enregistrement…'],
  autosave_saved: ['Changes saved', 'Modifiche salvate', 'Änderungen gespeichert', 'Modifications enregistrées'],
  autosave_error: ['Could not save changes', 'Salvataggio non riuscito', 'Speichern fehlgeschlagen', 'Échec de l’enregistrement'],
  autosave_invalid: ['Check the entered values', 'Controlla i valori inseriti', 'Eingaben prüfen', 'Vérifiez les valeurs saisies'],
  autosave_help: ['Changes are saved automatically in this annual analysis after you finish editing. Costs and Emissions share the same values, which are restored when you reopen the analysis. Reset values are saved too. This does not rerun feasibility or change the selected design.', 'Le modifiche vengono salvate automaticamente in questa analisi annuale al termine della modifica. Costi ed Emissioni condividono gli stessi valori, che ritrovi alla riapertura. Anche il ripristino dei valori viene salvato. Non viene rilanciata la fattibilità né modificato il dimensionamento scelto.', 'Änderungen werden nach der Eingabe automatisch in dieser Jahresanalyse gespeichert. Kosten und Emissionen verwenden dieselben Werte; beim erneuten Öffnen werden sie wiederhergestellt. Auch zurückgesetzte Werte werden gespeichert. Die Machbarkeit wird nicht neu berechnet und die gewählte Auslegung bleibt erhalten.', 'Les modifications sont enregistrées automatiquement dans cette analyse annuelle à la fin de la saisie. Coûts et Émissions partagent les mêmes valeurs, retrouvées à la réouverture. Les valeurs réinitialisées sont aussi enregistrées. La faisabilité et le dimensionnement choisi ne sont pas recalculés.'],
  retry: ['Retry', 'Riprova', 'Erneut versuchen', 'Réessayer'],
  noInfraMaintenance: ['Infrastructure maintenance is currently excluded (CHF 0/year); enter an annual fleet estimate above.', 'La manutenzione dell’infrastruttura è al momento esclusa (CHF 0/anno); inserisci sopra una stima annuale per la flotta.', 'Infrastrukturwartung ist derzeit ausgeschlossen (CHF 0/Jahr); oben einen Jahreswert für die Flotte eingeben.', 'L’entretien de l’infrastructure est actuellement exclu (CHF 0/an) ; indiquez ci-dessus une estimation annuelle pour la flotte.'],
  method: ['Calculation and boundaries', 'Calcolo e perimetro', 'Berechnung und Abgrenzung', 'Calcul et périmètre'],
  methodNote: ['TCO = discounted purchase, replacement and operating costs minus terminal residual value, divided by discounted fleet kilometres. Operating costs occur at year-end; residual values use straight-line remaining life. Battery replacements are counted once. Charging losses use 94% grid-to-bus efficiency. Drivers, taxes, financing fees and depot buildings are excluded. Constant real prices; the discount rate is real.', 'TCO = acquisti, sostituzioni e costi operativi attualizzati meno valore residuo finale, divisi per i km attualizzati della flotta. I costi operativi cadono a fine anno; il residuo è proporzionale alla vita utile rimanente. Le sostituzioni batteria sono contate una sola volta. Rendimento rete-bus 94%. Sono esclusi autisti, imposte, spese di finanziamento ed edifici del deposito. Prezzi reali costanti e tasso reale.', 'TCO = diskontierte Anschaffungs-, Ersatz- und Betriebskosten abzüglich Endrestwert, geteilt durch diskontierte Flottenkilometer. Betriebskosten fallen am Jahresende an; Restwerte entsprechen der verbleibenden Nutzungsdauer. Batterieersatz wird einmal gezählt. Wirkungsgrad Netz–Bus 94%. Fahrer, Steuern, Finanzierungsgebühren und Depotgebäude sind ausgeschlossen. Konstante reale Preise und realer Diskontsatz.', 'TCO = achats, remplacements et coûts d’exploitation actualisés moins valeur résiduelle finale, divisés par les kilomètres actualisés. Les coûts d’exploitation sont en fin d’année ; la valeur résiduelle est proportionnelle à la durée de vie restante. Les remplacements de batteries sont comptés une seule fois. Rendement réseau–bus 94 %. Conducteurs, impôts, frais de financement et bâtiments du dépôt exclus. Prix et taux réels constants.'],
  replacements: ['Discounted replacements', 'Sostituzioni attualizzate', 'Diskontierte Ersatzinvestitionen', 'Remplacements actualisés'],
  residual: ['Discounted terminal residual', 'Valore residuo finale attualizzato', 'Diskontierter Endrestwert', 'Valeur résiduelle finale actualisée'],
  npv: ['Net discounted lifetime cost', 'Costo netto attualizzato sul periodo', 'Diskontierte Nettokosten im Zeitraum', 'Coût net actualisé sur la période'],
  emissions: ['Annual environmental impact', 'Impatto ambientale annuale', 'Jährliche Umweltwirkung', 'Impact environnemental annuel'],
  emissionsNote: ['One lifecycle assessment per homogeneous group, using its representative annual mileage and consumption; fleet impacts multiply by the number of buses. Charging infrastructure uses the generic LCA inventory, not the site-specific investment breakdown.', 'Una valutazione del ciclo di vita per gruppo omogeneo, con km e consumi annuali rappresentativi; gli impatti di flotta sono moltiplicati per il numero di bus. L’infrastruttura usa l’inventario LCA generico, non il dettaglio degli investimenti per sito.', 'Eine Lebenszyklusanalyse je homogener Gruppe mit repräsentativer Fahrleistung und Verbrauch; Flottenwirkungen werden mit der Busanzahl multipliziert. Ladeinfrastruktur nutzt das generische Ökobilanzinventar, nicht die standortspezifischen Investitionen.', 'Une analyse du cycle de vie par groupe homogène, avec kilométrage et consommation représentatifs ; les impacts sont multipliés par le nombre de bus. L’infrastructure utilise l’inventaire ACV générique, pas les investissements détaillés par site.'],
  loading: ['Calculating environmental impacts…', 'Calcolo degli impatti ambientali…', 'Umweltwirkungen werden berechnet…', 'Calcul des impacts environnementaux…'],
  unavailable: ['Unavailable: incomplete data or invalid assumptions.', 'Non disponibile: dati incompleti o ipotesi non valide.', 'Nicht verfügbar: unvollständige Daten oder ungültige Annahmen.', 'Indisponible : données incomplètes ou hypothèses invalides.'],
  missing_prices: ['Purchase prices are missing from this historical evaluation.', 'Mancano i prezzi di acquisto in questa valutazione storica.', 'Anschaffungspreise fehlen in dieser historischen Bewertung.', 'Les prix d’achat manquent dans cette évaluation historique.'],
  missing_fleet: ['The saved fleet configuration is incomplete.', 'La configurazione salvata della flotta è incompleta.', 'Die gespeicherte Flottenkonfiguration ist unvollständig.', 'La configuration de flotte enregistrée est incomplète.'],
  incomplete_activity: ['Annual predictions are incomplete or their totals do not reconcile.', 'Le previsioni annuali sono incomplete o i totali non coincidono.', 'Jahresprognosen sind unvollständig oder Summen stimmen nicht überein.', 'Les prévisions annuelles sont incomplètes ou les totaux ne concordent pas.'],
  missing_infrastructure: ['The saved infrastructure cost breakdown is incomplete.', 'Il dettaglio salvato dei costi infrastrutturali è incompleto.', 'Die gespeicherte Infrastrukturkostenaufteilung ist unvollständig.', 'Le détail enregistré des coûts d’infrastructure est incomplet.'],
  battery_mismatch: ['This historical analysis used a different battery size for some duties. Create a new annual analysis to obtain consistent consumption and TCO.', 'Questa analisi storica ha usato una batteria diversa per alcuni turni. Crea una nuova analisi annuale per ottenere consumi e TCO coerenti.', 'Diese historische Analyse verwendete für einige Umläufe eine andere Batteriegrösse. Eine neue Jahresanalyse liefert konsistenten Verbrauch und TCO.', 'Cette analyse historique utilisait une batterie différente pour certains roulements. Créez une nouvelle analyse annuelle pour obtenir consommation et TCO cohérents.'],
  configurations: ['Fleet configurations', 'Configurazioni della flotta', 'Flottenkonfigurationen', 'Configurations de la flotte'],
  perBus: ['per bus', 'per bus', 'je Bus', 'par bus'],
};
export const fleetLabel = key => vocabulary[key]?.[['en', 'it', 'de', 'fr'].indexOf(getCurrentLang())] ?? vocabulary[key]?.[0] ?? key;
const e = escapeHtml;
const scaled = (value, factor) => value == null ? null : value * factor;
const ratio = (value, denominator) => value == null || !(denominator > 0) ? null : value / denominator;
const label = key => e(fleetLabel(key));
const table = (headers, rows, footer = '') => `<div class="annual-fleet-table"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody>${footer ? `<tfoot>${footer}</tfoot>` : ''}</table></div>`;
const row = cells => `<tr>${cells.map((c, i) => `<${i ? 'td' : 'th'}>${c}</${i ? 'td' : 'th'}>`).join('')}</tr>`;
const metric = (key, value, hint = '') => `<div class="annual-fleet-metric"><span>${label(key)}</span><strong>${value}</strong>${hint ? `<small>${hint}</small>` : ''}</div>`;

const percentFields = new Set(['rate', 'infrastructureMaintenanceRate']);
const maintenanceReport = 'https://www.infras.ch/media/filer_public/79/e5/79e599d9-0dae-491e-ac2b-19f07385834a/4166a_technologiestudie_elektrobusse_vov_schlussbericht.pdf#page=51';

export function createYearlyFleetDashboard({ features, model, predictionRuns, onSave, onPreviewLca }) {
  const baseline = buildAnnualFleet(features, predictionRuns);
  let assumptions = yearlyTcoDefaults(features, model);
  let scope = baseline.groups.length === 1 ? baseline.groups[0].id : 'fleet';
  let activeTab = 'costs';
  let root = null, emissions = { status: 'idle' }, preview = null, previewTimer, requestId = 0;
  const paintSaveStatus = () => {
    const status = root?.querySelector('[data-save-status]');
    if (!status) return;
    status.textContent = fleetLabel(`autosave_${autosave.state.status}`);
    status.dataset.status = autosave.state.status;
    root.querySelector('[data-autosave-retry]').hidden = autosave.state.status !== 'error';
  };
  const autosave = createAssumptionAutosave({ save: onSave, onState: paintSaveStatus });
  const fleet = () => scaleAnnualFleet(baseline, assumptions.annualKmByGroup);
  const payload = () => ({ ...assumptions, annualKmByGroup: { ...assumptions.annualKmByGroup },
    annualKmByShift: Object.fromEntries(fleet().rows.map(r => [r.id, r.km])) });
  const lcaKey = () => JSON.stringify([assumptions.bodyLife, assumptions.batteryLife, assumptions.dieselLife,
    assumptions.dieselConsumption, assumptions.annualKmByGroup]);
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  const matchesLca = (raw, current) => raw?.status === 'complete' &&
    raw.vehicles.every(v => close(v.lifetime_bus, assumptions.bodyLife) && close(v.lifetime_battery, assumptions.batteryLife) &&
      close(v.lifetime_diesel_bus, assumptions.dieselLife) && close(v.diesel_consumption_l_per_km, assumptions.dieselConsumption)) &&
    current.groups.every(g => close(raw.vehicles.filter(v => (v.shift_ids ?? [v.shift_id]).some(id => g.members.some(m => m.id === id)))
      .reduce((s, v) => s + v.annual_km * (v.vehicle_count ?? 1), 0), g.km));
  const queueLca = () => {
    clearTimeout(previewTimer); const id = ++requestId;
    if (!onPreviewLca) return;
    const key = lcaKey();
    preview = { key, status: 'loading', rawLca: preview?.rawLca ?? emissions.rawLca };
    previewTimer = setTimeout(async () => {
      try {
        const rawLca = await onPreviewLca(payload());
        if (id !== requestId || key !== lcaKey() || !root) return;
        preview = { key, status: 'done', rawLca };
      } catch (error) {
        if (id !== requestId || !root) return;
        preview = { key, status: 'error', error: error.message };
      }
      paint(true);
    }, 500);
  };
  const controls = current => {
    const sliders = [
      ['fuelPrice', 1, 3, .01], ['dieselMaintenance', .1, .8, .005], ['energyPrice', .05, .6, .01],
      ['maintenancePerKm', .1, .8, .005], ['dieselConsumption', .15, .8, .001],
      ...(assumptions.infrastructureMaintenanceMode === 'rate' ? [['infrastructureMaintenanceRate', 0, 5, .1]] : []),
    ];
    const slider = (key, min, max, step, group = null) => {
      const value = group ? assumptions.annualKmByGroup[group.id] : assumptions[key] * (percentFields.has(key) ? 100 : 1);
      const name = group ? `km:${group.id}` : key;
      const title = group ? `${label('mileagePerBus')} · ${e(group.modelName ?? '')} · ${group.packs} ${label('packs')} (${group.count} ${label(group.count === 1 ? 'bus' : 'buses')})` : label(key);
      return `<label class="annual-slider"${!group && key !== 'dieselConsumption' ? ' data-cost-only' : ''}>${title}<input type="number" aria-label="${e(group ? fleetLabel('mileagePerBus') + ' · ' + group.packs : fleetLabel(key))}" data-tco-input="${e(name)}" name="${e(name)}" value="${value == null ? '' : Number(value.toFixed(group ? 2 : 4))}" min="${group ? 1 : min}" step="any" required>
        <input type="range" aria-label="${e(group ? fleetLabel('mileagePerBus') + ' · ' + group.packs + ' slider' : fleetLabel(key) + ' slider')}" data-tco-input="${e(name)}" min="${Math.min(min, value ?? min)}" max="${Math.max(max, value ?? max)}" step="${step}" value="${value ?? min}"><small>${n(Math.min(min, value ?? min), group ? 0 : 2)} — ${n(Math.max(max, value ?? max), group ? 0 : 2)}</small>${group ? `<small>${label('assignedDuties')}: ${e(group.members.map(m => m.name ?? m.id).join(', '))}</small>` : ''}</label>`;
    };
    const fields = ['horizon', 'rate', 'bodyLife', 'batteryLife', 'dieselCapex', 'dieselLife', 'pointLife', 'siteLife',
      ...(assumptions.infrastructureMaintenanceMode === 'fixed' ? ['infrastructureMaintenance'] : [])];
    const settingsOpen = root.querySelector('[data-tco-settings]')?.open;
    return `<form data-tco-form><div class="annual-fleet-heading"><h3 data-assumptions-title></h3><button type="button" class="result-header-action" data-tco-reset></button></div>
      <p class="helper-text" data-emissions-controls-note>${label('emissionsControlsNote')}</p>
      <div class="annual-fleet-inputs">${sliders.map(args => slider(...args)).join('')}</div>
      <p class="helper-text" data-cost-only><span data-maintenance-estimate></span> · <a href="${maintenanceReport}" target="_blank" rel="noopener" title="${e(fleetLabel('maintenanceSource'))}">INFRAS 2026 · p. 51 ⓘ</a></p>
      <div class="annual-fleet-inputs">${baseline.groups.map(g => slider('km', 1000, Math.max(180000, Math.round(g.km / g.count * 2)), 100, g)).join('')}</div>
      <p class="helper-text">${label('mileageNote')}</p>
      <details data-tco-settings data-cost-only${settingsOpen ? ' open' : ''}><summary>${label('method')}</summary><div class="annual-fleet-inputs">
        <label>${label('maintenanceMode')}<select name="infrastructureMaintenanceMode" data-tco-input="infrastructureMaintenanceMode"><option value="rate"${assumptions.infrastructureMaintenanceMode === 'rate' ? ' selected' : ''}>${label('percentMode')}</option><option value="fixed"${assumptions.infrastructureMaintenanceMode === 'fixed' ? ' selected' : ''}>${label('fixedMode')}</option></select></label>
        ${fields.map(key => `<label>${label(key)}<input type="number" name="${key}" data-tco-input="${key}" min="${['horizon', 'bodyLife', 'batteryLife', 'dieselLife', 'pointLife', 'siteLife'].includes(key) ? 1 : 0}" ${key === 'horizon' ? 'max="60"' : key === 'rate' ? 'max="100"' : ''} step="${key === 'rate' ? '.01' : '1'}" value="${assumptions[key] == null ? '' : assumptions[key] * (percentFields.has(key) ? 100 : 1)}" required></label>`).join('')}</div><p class="helper-text">${label('maintenanceSource')}</p></details>
      <div class="annual-fleet-autosave"><span role="status" aria-live="polite" data-save-status></span><span class="annual-autosave-info"><button type="button" aria-label="${label('autosave_idle')}" aria-describedby="annual-autosave-help">i</button><span role="tooltip" id="annual-autosave-help">${label('autosave_help')}</span></span><button type="button" data-autosave-retry hidden>${label('retry')}</button></div></form>`;
  };
  const paint = (keepControls = false) => {
    if (!root) return;
    const current = fleet(), group = current.groups.find(g => g.id === scope);
    const divisor = group ? group.count : 1, share = group ? group.count / current.count : 1;
    const local = group ? { ...current, count: group.count, rows: group.members,
      totals: Object.fromEntries(['km', 'dc', 'grid', 'busCost', 'batteryCost'].map(k => [k, group.members.every(r => Number.isFinite(r[k])) ? group.members.reduce((s, r) => s + r[k], 0) : null])),
      infrastructure: Object.fromEntries(Object.entries(current.infrastructure).map(([key, value]) => [key, scaled(value, share)])),
    } : current;
    const state = preview?.key === lcaKey() ? preview : emissions;
    const raw = state.rawLca;
    const lcaRows = (raw?.vehicles ?? []).filter(v => !group || (v.shift_ids ?? [v.shift_id]).some(id => group.members.some(m => m.id === id)));
    const lcaKm = lcaRows.reduce((s, v) => s + v.annual_km * (v.vehicle_count ?? 1), 0);
    const heater = features.config?.auxiliary_heating_type === 'diesel'
      ? lcaKm > 0 ? lcaRows.reduce((s, v) => s + v.diesel_heating_liters * (v.vehicle_count ?? 1), 0) * local.totals.km / lcaKm : null : 0;
    const result = computeFleetTco(local, { ...assumptions, infrastructureMaintenance: assumptions.infrastructureMaintenance * share }, { dieselHeatingLiters: heater });
    const diesel = computeDieselTco(local, assumptions), comparison = cumulativeCostComparison(result, diesel, assumptions);
    if (!root.querySelector('[data-annual-header]')) root.innerHTML = `<section class="result-card annual-fleet-card" data-role="annual-fleet-dashboard" data-annual-header></section>
      <div class="annual-result-tabs" role="tablist" aria-label="${label('title')}"><button type="button" role="tab" id="annual-cost-tab" aria-controls="annual-cost-panel" data-annual-tab="costs">${label('costsTab')}</button><button type="button" role="tab" id="annual-emissions-tab" aria-controls="annual-emissions-panel" data-annual-tab="emissions">${label('emissionsTab')}</button></div>
      <section id="annual-cost-panel" role="tabpanel" aria-labelledby="annual-cost-tab" class="result-card annual-fleet-card"><h2>${label('costs')}</h2><div data-annual-controls></div><div data-annual-financial></div></section>
      <section id="annual-emissions-panel" role="tabpanel" aria-labelledby="annual-emissions-tab" class="annual-emissions-panel"><div class="result-card annual-fleet-card" data-emissions-controls></div><p class="helper-text">${label('emissionsNote')}</p><div data-annual-lca></div></section>`;
    const options = [`<option value="fleet"${scope === 'fleet' ? ' selected' : ''}>${label('fleet')} · ${current.count} ${label('buses')}</option>`, ...current.groups.map(g => `<option value="${e(g.id)}"${scope === g.id ? ' selected' : ''}>${label('representative')} · ${e(g.modelName ?? '')} · ${g.packs} ${label('packs')} (${g.count} ${label(g.count === 1 ? 'bus' : 'buses')})</option>`)].join('');
    root.querySelector('[data-annual-header]').innerHTML = `<div class="annual-fleet-heading"><h2>${label('title')}</h2><label class="annual-fleet-scope">${label('representative')} / ${label('fleet')}<select data-tco-scope>${options}</select></label></div>
      <p class="helper-text">${label('groupNote')}</p>${group ? `<p class="helper-text"><strong>${e(group.modelName ?? '')} · ${group.packs} ${label('packs')} · ${n(group.capacity)} kWh</strong> · ${group.count} ${label(group.count === 1 ? 'bus' : 'buses')}</p>` : ''}
      ${current.issues.map(issue => `<p class="annual-fleet-warning">${label(issue)}</p>`).join('')}
      <div class="annual-fleet-metrics">${metric('distance', `${n(scaled(local.totals.km, 1 / divisor), 0)} km`)}${metric('dc', `${n(scaled(local.totals.dc, 1 / divisor), 0)} kWh`, `${n(ratio(local.totals.dc, local.totals.km), 3)} kWh/km DC`)}${metric('grid', `${n(scaled(local.totals.grid, 1 / divisor), 0)} kWh`, `${n(ratio(local.totals.grid, local.totals.km), 3)} kWh/km AC`)}</div>
      ${!group && current.groups.length > 1 ? table([label('representative'), label('buses'), `${label('distance')} / ${label('perBus')}`, label('consumption')], current.groups.map(g => row([`${e(g.modelName ?? '')} · ${g.packs} ${label('packs')}`, g.count, `${n(g.km / g.count, 0)} km`, `${n(g.dc / g.km, 3)} kWh/km DC`]))) : ''}`;
    root.querySelectorAll('[data-annual-tab]').forEach(button => { const selected = activeTab === button.dataset.annualTab; button.setAttribute('aria-selected', String(selected)); });
    root.querySelector('#annual-cost-panel').hidden = activeTab !== 'costs';
    root.querySelector('#annual-emissions-panel').hidden = activeTab !== 'emissions';
    const controlsHost = root.querySelector(activeTab === 'emissions' ? '[data-emissions-controls]' : '[data-annual-controls]');
    let form = root.querySelector('[data-tco-form]');
    if (!keepControls || !form) {
      const markup = controls(current);
      form?.remove(); controlsHost.innerHTML = markup;
      form = controlsHost.querySelector('[data-tco-form]');
    } else if (form.parentElement !== controlsHost) controlsHost.append(form);
    // Share one form and one set of assumptions across the two views, retaining
    // the actual input nodes while a slider is being dragged.
    form.querySelectorAll('[data-cost-only]').forEach(el => { el.hidden = activeTab === 'emissions'; });
    form.querySelector('[data-emissions-controls-note]').hidden = activeTab !== 'emissions';
    form.querySelector('[data-assumptions-title]').textContent = fleetLabel(activeTab === 'emissions' ? 'emissionsAssumptions' : 'assumptions');
    form.querySelector('[data-tco-reset]').textContent = fleetLabel(activeTab === 'emissions' ? 'resetEmissions' : 'reset');
    const maintenance = assumptions.infrastructureMaintenanceMode === 'rate' ? current.infrastructure.total * assumptions.infrastructureMaintenanceRate : assumptions.infrastructureMaintenance;
    root.querySelector('[data-maintenance-estimate]').textContent = `${fleetLabel('annualMaintenanceEstimate')}: ${chf(maintenance)}`;
    paintSaveStatus();
    const financial = root.querySelector('[data-annual-financial]');
    const openDetails = [...financial.querySelectorAll('details[open]')].map(el => el.dataset.detail);
    const comparisonRows = result && diesel ? table(['', label('electric'), label('diesel')], [
      row([label('initial'), chf(result.initial / divisor), chf(diesel.initial / divisor)]),
      row([label('annual'), chf(result.annualOpex / divisor), chf(diesel.annualOpex / divisor)]),
      row([label('equivalent'), chf(result.annualEquivalent / divisor), chf(diesel.annualEquivalent / divisor)]),
      row([label('npv'), chf(result.presentValue / divisor), chf(diesel.presentValue / divisor)]),
    ]) : '';
    financial.innerHTML = `${result ? `<div class="annual-fleet-metrics annual-fleet-metrics--tco"><div class="annual-fleet-metric"><span>${label('electric')} · TCO · ${assumptions.horizon} ${label('years')}</span><strong data-role="fleet-tco">${n(result.perKm, 3)} CHF/km</strong></div><div class="annual-fleet-metric"><span>${label('diesel')} · TCO</span><strong data-role="diesel-tco">${diesel ? n(diesel.perKm, 3) + ' CHF/km' : '—'}</strong></div><div class="annual-fleet-metric"><span>${label('saving')}</span><strong data-role="tco-difference">${diesel ? n(diesel.perKm - result.perKm, 3) + ' CHF/km' : '—'}</strong></div></div>${comparisonRows}<p class="helper-text">${label('comparisonBoundary')}</p>` : `<p class="annual-fleet-warning">${label('unavailable')}</p>`}
      ${comparison ? `<div class="annual-cost-charts"><figure><figcaption>${label('opexComparison')}</figcaption><div class="annual-chart-scroll" data-cost-opex></div></figure><figure><figcaption>${label('cumulative')}</figcaption><div class="annual-chart-scroll" data-cost-cumulative></div></figure></div>
      <p data-cost-break-even><strong>${label('breakEven')}:</strong> ${comparison.breakEven === null ? label('noBreakEven') : comparison.residualOnly ? label('residualBreakEven') : `${label('year')} ${comparison.breakEven}`}</p><p class="helper-text">${label('cumulativeNote')}</p>` : ''}
      ${result ? `<h3>${label('breakdown')} · ${label('electric')}</h3>${table(['', label('initial'), label('equivalent'), 'CHF/km'], result.components.map(c => row([label(c.key), chf(c.initial / divisor), chf(c.presentValue / result.annuityFactor / divisor), `${n(c.presentValue / result.annuityFactor / local.totals.km, 3)} CHF/km`])), row([label('total'), chf(result.initial / divisor), chf(result.components.reduce((s, c) => s + c.presentValue, 0) / result.annuityFactor / divisor), `${n(result.components.reduce((s, c) => s + c.presentValue, 0) / result.annuityFactor / local.totals.km, 3)} CHF/km`]))}
      <h3>${label('annual')} · ${label('electric')}</h3>${table(['', 'CHF', 'CHF/km'], result.operating.filter(c => c.key !== 'heater' || heater > 0).map(c => row([label(c.key), chf(c.annual / divisor), `${n(c.annual / local.totals.km, 3)} CHF/km`])), row([label('total'), chf(result.annualOpex / divisor), `${n(result.annualOpex / local.totals.km, 3)} CHF/km`]))}` : ''}
      ${diesel ? `<h3>${label('annual')} · ${label('diesel')}</h3>${table(['', 'CHF', 'CHF/km'], diesel.operating.map(c => row([label(c.key), chf(c.annual / divisor), `${n(c.annual / local.totals.km, 3)} CHF/km`])), row([label('total'), chf(diesel.annualOpex / divisor), `${n(diesel.annualOpex / local.totals.km, 3)} CHF/km`]))}` : ''}
      <details data-detail="infrastructure"><summary>${label('infrastructure')}</summary><p class="helper-text">${label('allocation')}</p>${table([label('location'), label('points'), label('site'), label('connection'), label('total')], current.stations.map(site => row([e(site.stopName), chf(scaled(site.points, share / divisor)), chf(scaled(site.fixed, share / divisor)), chf(scaled(site.power, share / divisor)), chf(scaled(site.total, share / divisor))])), row([label('total'), ...['points', 'fixed', 'power', 'total'].map(key => chf(scaled(local.infrastructure[key], 1 / divisor)))]))}</details>
      <details data-detail="method"><summary>${label('method')}</summary><p class="helper-text">${label('methodNote')}</p>${result && diesel ? table(['', label('electric'), label('diesel')], [row([label('replacements'), chf(result.discountedReplacements / divisor), chf(diesel.discountedReplacements / divisor)]), row([label('residual'), chf(result.discountedResidual / divisor), chf(diesel.discountedResidual / divisor)])]) : ''}</details>`;
    financial.querySelectorAll('details').forEach(el => { el.open = openDetails.includes(el.dataset.detail); });
    if (comparison) renderAnnualCostCharts({ opexHost: financial.querySelector('[data-cost-opex]'), cumulativeHost: financial.querySelector('[data-cost-cumulative]'), electric: result, diesel, comparison, divisor, assumptions, label: fleetLabel });
    const lcaHost = root.querySelector('[data-annual-lca]');
    const scopedLca = matchesLca(raw, current) ? scopeFleetLca(raw, group) : null;
    if (scopedLca && !current.issues.some(issue => ['missing_fleet', 'incomplete_activity', 'battery_mismatch'].includes(issue))) renderParameterizedLca(lcaHost, scopedLca, t);
    else lcaHost.innerHTML = `<p role="status">${e(state.status === 'error' ? state.error || fleetLabel('unavailable') : current.issues.length ? fleetLabel(current.issues[0]) : fleetLabel('loading'))}</p>`;
  };
  const applyValue = (key, value) => {
    if (key.startsWith('km:')) assumptions.annualKmByGroup[key.slice(3)] = Number(value);
    else assumptions[key] = key === 'infrastructureMaintenanceMode' ? value : Number(value) / (percentFields.has(key) ? 100 : 1);
  };
  const onInput = event => {
    const key = event.target.dataset.tcoInput;
    if (!key) return;
    if (!event.target.validity.valid) { autosave.queue(null); return; }
    const previousPayload = JSON.stringify(payload());
    const previousKey = lcaKey();
    applyValue(key, event.target.value);
    // Keep the input DOM stable while dragging; update paired numeric/range values.
    root.querySelectorAll('[data-tco-input]').forEach(input => { if (input !== event.target && input.dataset.tcoInput === key) input.value = event.target.value; });
    const changed = JSON.stringify(payload()) !== previousPayload;
    if (lcaKey() !== previousKey) queueLca();
    if (!root.querySelector('[data-tco-form]').checkValidity()) autosave.queue(null);
    else if (changed || autosave.state.status === 'invalid') autosave.queue(payload());
    // A blur/change after input must not replace the button the user is clicking.
    if (changed) paint(key !== 'infrastructureMaintenanceMode');
  };
  const onChange = event => {
    if (event.target.matches('[data-tco-scope]')) { scope = event.target.value; paint(true); }
    else if (event.target.matches('[data-tco-input]')) { onInput(event); void autosave.flush(); }
  };
  const onClick = event => {
    const tab = event.target.closest('[data-annual-tab]');
    if (tab) { activeTab = tab.dataset.annualTab; paint(true); }
    if (event.target.closest('[data-tco-reset]')) {
      const defaults = yearlyTcoDefaults({ ...features, assessment_assumptions: {} }, model);
      assumptions = activeTab === 'emissions'
        ? { ...assumptions, dieselConsumption: defaults.dieselConsumption, annualKmByGroup: defaults.annualKmByGroup }
        : defaults;
      queueLca(); paint(); autosave.queue(payload());
    }
    if (event.target.closest('[data-autosave-retry]')) void autosave.flush();
  };
  const onSubmit = event => {
    if (!event.target.matches('[data-tco-form]')) return;
    event.preventDefault();
    const previousKey = lcaKey();
    for (const [key, value] of new FormData(event.target)) applyValue(key, value);
    if (lcaKey() !== previousKey) queueLca();
    paint(true);
    autosave.queue(payload()); void autosave.flush();
  };
  const beforeUnload = event => {
    if (!autosave.unsaved) return;
    void autosave.flush();
    event.preventDefault(); event.returnValue = '';
  };
  const unbind = () => { root?.removeEventListener('input', onInput); root?.removeEventListener('change', onChange); root?.removeEventListener('click', onClick); root?.removeEventListener('submit', onSubmit); };
  return {
    mount(el, state) {
      if (root !== el) { unbind(); root = el; root.addEventListener('input', onInput); root.addEventListener('change', onChange); root.addEventListener('click', onClick); root.addEventListener('submit', onSubmit); window.addEventListener('beforeunload', beforeUnload); }
      emissions = state; paint(true);
    },
    update(state) { emissions = state; paint(true); },
    dispose() { clearTimeout(previewTimer); requestId++; unbind(); root = null; window.removeEventListener('beforeunload', beforeUnload); void autosave.dispose(); },
  };
}
