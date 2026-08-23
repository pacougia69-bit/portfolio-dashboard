/**
 * Depot-Zielstruktur - EINE Quelle der Wahrheit fuer Client UND Server.
 * Vorher an 5 Code-Stellen einzeln gepflegt (Dashboard, Strategie-Seite,
 * Rebalancing-Router, DKB-Kategorisierung, Hilfe-Text) - beim naechsten
 * Depot-Umbau reicht jetzt eine Aenderung hier plus in der Datenbank
 * (Einstellungen > Strategie kann die Werte ueberschreiben, das hier ist
 * nur der Startwert / Fallback, falls noch nichts gespeichert wurde).
 */

export interface TargetAllocation {
  wkn: string;
  name: string;
  shortLabel: string;
  targetPercent: number;
  frozen: boolean;
  description: string;
}

export const DEFAULT_TARGET_ALLOCATIONS: TargetAllocation[] = [
  {
    wkn: 'A2DWBY',
    name: 'iShares MSCI World Small Cap',
    shortLabel: 'Small Caps',
    targetPercent: 37,
    frozen: false,
    description: 'MSCI World Small Cap — echte Ergänzung, Sparplan 500 €',
  },
  {
    wkn: 'A3D7QX',
    name: 'Invesco FTSE All-World',
    shortLabel: 'Kern',
    targetPercent: 22,
    frozen: false,
    description: 'Invesco FTSE All-World — ganze Welt inkl. EM, Sparplan 300 €',
  },
  {
    wkn: 'A2N6LC',
    name: 'Xtrackers AI & Big Data',
    shortLabel: 'KI-Wette',
    targetPercent: 19,
    frozen: false,
    description: 'Xtrackers AI & Big Data — KI-Wette, Sparplan 250 €, Ampel-Backstop + Kill-Kriterien',
  },
  {
    wkn: 'A3EB9T',
    name: 'HANetf Future of Defence',
    shortLabel: 'Defence-Wette',
    targetPercent: 8,
    frozen: false,
    description: 'Future of Defence — Sparplan 100 €, Ampel-Backstop',
  },
  {
    wkn: 'A40L9T',
    name: 'iShares AI Infrastructure',
    shortLabel: 'KI-Infra-Wette',
    targetPercent: 7,
    frozen: false,
    description: 'iShares AI Infrastructure — Sparplan 100 €, Ampel-Backstop, Wiedervorlage Jan 2027',
  },
  {
    wkn: 'A2JMGE',
    name: 'iShares Digital Security',
    shortLabel: 'Digital Security',
    targetPercent: 7,
    frozen: false,
    description: 'iShares Digital Security — neu seit 23.08.2026, Sparplan 100 €',
  },
];
