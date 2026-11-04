# Prova locale: ciclo giornaliero e ricarica in deposito

Status: implemented and tested locally; no staging deployment

## Regole concordate
- Un bus per turno; nessun trasferimento aggiunto. Primo e ultimo trip devono collegarsi al deposito dichiarato; deposito iniziale e finale uguali per ripetere lo stesso turno.
- Ripetizione ogni 24 ore. SOC alla prossima partenza uguale al massimo configurato, con la massa selezionata Mean/Q95.
- Una presa riservata per tutta la permanenza se utilizzata; nessuna rotazione o spostamento notturno.
- Precompilare le prese per **deposito di arrivo** dal numero di turni selezionati che vi terminano (correzione concordata durante la prova). Numero, potenza per presa e limite totale DC del sito modificabili e indipendenti.
- Verificare i limiti condivisi anche attraverso il confine giornaliero, senza nuove previsioni del giorno successivo.
- Peak shaving facoltativo: configurazione, assegnazioni e ricariche durante il servizio fisse; minimizzare il picco di ricarica dei depositi. Risultato esplicitamente simulato, non il picco elettrico dell'intero sito.
- Suddividere energia durante/fuori turno per bus e location; mostrare ripartenza verificata e costi fissi non valutati come tali.

## Sequenza
1. Estendere il modello con finestre cicliche del deposito e vincolo energetico terminale, attivabili per la prova e compatibili con risultati storici.
2. Aggiungere il raffinamento di peak shaving e relativo reporting.
3. Collegare configurazione e risultati al frontend locale.
4. Controlli mirati: tre modalità, prese/potenza insufficienti, sovrapposizioni a mezzanotte, SOC ripristinato, piano diurno e dimensionamento invariati nel peak shaving.
5. Eseguire una coppia Mean/Q95 sui dati TPL locali, controllare via API e browser e registrare tempi/risultati.

Nessun deploy in staging. Nessuna modifica ai turni o ai risultati precedenti.

## Risultati della prova locale (30 ottobre 2026)
- Turno TPL 40502, deposito TPL Rimessa 1, una presa da 100 kW DC e limite di sito 80 kW DC. SOC 40–90%, temperatura 15 °C, occupazione 50%.
- Mean: 12 pacchi, 298,58 kWh fuori turno, picco simulato 30,36 kW DC; ripartenza 05:19 al 90% (540 kWh).
- Q95: 14 pacchi, 340,68 kWh fuori turno, picco simulato 34,65 kW DC; ripartenza 05:19 al 90% (630 kWh).
- Il precedente piano fattibile raggiungeva 80 kW DC in entrambi i casi; non è un benchmark di ricarica non controllata.
- Ultima esecuzione: circa 6,8/7,2 secondi nei solve Mean/Q95, di cui 4,8/4,6 secondi per il raffinamento del picco. Previsioni in cache, caso con un bus: non una stima dei tempi per una flotta.
- 9 controlli backend mirati: tre modalità, carenza di prese/potenza, sovrapposizione ciclica, compatibilità storica, vincoli di deposito/durata, conservazione della ricarica diurna e limite congiunto giorno/notte.
- 35 controlli esistenti di presentazione; 4 controlli browser desktop/mobile per creazione e risultati; build locale riuscita.

Limiti espliciti della prova: stesso deposito di partenza/arrivo per ripetere lo stesso turno senza trasferimenti aggiunti; potenze DC lato bus, carichi esterni al deposito esclusi; intervalli notturni di 15 minuti suddivisi alle partenze/arrivi; margine conservativo di un minuto dopo l'ultimo arrivo; cooldown tra sessioni non supportato nel ciclo giornaliero. Il picco è mostrato nei dettagli della simulazione di ricarica controllata.
