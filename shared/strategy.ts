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
    wkn: 'A3D7QX',
    name: 'Invesco FTSE All-World',
    shortLabel: 'Kern',
    targetPercent: 34,
    frozen: false,
    description: 'Invesco FTSE All-World — ganze Welt inkl. EM, Sparplan 750 €',
  },
  {
    wkn: 'A2H6ZT',
    name: 'iShares Core Global Aggregate Bond',
    shortLabel: 'Anleihen',
    targetPercent: 22,
    frozen: false,
    description: 'Weltweite Anleihen EUR-hedged — Krisenpuffer, Sparplan 550 €',
  },
  {
    wkn: 'A2DWBY',
    name: 'iShares MSCI World Small Cap',
    shortLabel: 'Small Caps',
    targetPercent: 13,
    frozen: false,
    description: 'MSCI World Small Cap — echte Ergänzung, Sparplan 100 €',
  },
  {
    wkn: 'A2N6LC',
    name: 'Xtrackers AI & Big Data',
    shortLabel: 'KI-Wette',
    targetPercent: 17,
    frozen: true,
    description: 'Xtrackers AI & Big Data — kein neues Geld, Ampel-Backstop + Kill-Kriterien',
  },
  {
    wkn: 'A3EB9T',
    name: 'HANetf Future of Defence',
    shortLabel: 'Defence-Wette',
    targetPercent: 9,
    frozen: true,
    description: 'Future of Defence — kein neues Geld, Ampel-Backstop',
  },
  {
    wkn: 'A40L9T',
    name: 'iShares AI Infrastructure',
    shortLabel: 'KI-Infra-Wette',
    targetPercent: 5,
    frozen: true,
    description: 'iShares AI Infrastructure — kein neues Geld, Ampel-Backstop, Wiedervorlage Jan 2027',
  },
];
