/**
 * "Meine Regeln" - Rafaels persoenliche Anlage-Regeln auf einen Blick (Startseiten-Karte).
 * Reine Daten, keine Logik. Quelle: Gespraech 26.09.2026, Ablage PROJEKTE/Anlage-Regeln/.
 * Regeln sind eine Erinnerung an eigene Vorsaetze, keine Kauf-/Verkaufsanweisung.
 */

export interface AnlageRegel {
  id: string;
  text: string;
}

export const ANLAGE_REGELN: readonly AnlageRegel[] = [
  { id: 'sparplan', text: 'Sparplan 1.350 € im Monat. Neues Geld geht zuerst dorthin, wo ein ETF am weitesten unter seinem Ziel liegt.' },
  { id: 'pruefmarke', text: 'Prüfmarke: Fällt das Depot 20 % unter sein Hoch, gibt es einen ruhigen Prüfgang, keinen Schnellverkauf.' },
  { id: 'zockerecke', text: 'Zockerecke höchstens 5 % des Depots.' },
  { id: 'laufen', text: 'Das Depot laufen lassen, in 5 bis 6 Jahren (bis ca. 2031) Bilanz ziehen.' },
  { id: 'keine-hebel', text: 'Vorerst keine Hebelprodukte.' },
  { id: '24-stunden', text: '24 Stunden zwischen Idee und Kauf. Kein Kauf im Hype.' },
  { id: 'ausstieg-vorher', text: 'Vor dem Kauf aufschreiben, wann die These gebrochen ist (Kaufkarte).' },
  { id: 'nicht-zurueckholen', text: 'Verluste nicht zurückholen wollen. Nie in eine gebrochene These nachkaufen.' },
] as const;
