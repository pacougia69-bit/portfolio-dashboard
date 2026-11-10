/**
 * Eingezahlt / Gewinn: Rechnung ueber Depotwert am Zeitraum-Anfang, Netto-Einzahlungen und Ertraege.
 *
 * Datenquelle (Stand 10.11.2026):
 * - Startwerte: DKB-Jahresdepotauszuege per 31.12.2024 (77.813,25 EUR) und 31.12.2025 (143.264,90 EUR).
 * - Kaeufe/Verkaeufe/Ertraege: DKB-Umsatzliste (Girokonto, Zeitraum 01.01.2025 bis 10.11.2026), Zeilen
 *   "Depot 0502934789 Wertp.Abrechn." (260 Stueck, Kaeufe inkl. Sparplan, Verkaeufe, Gebuehren und
 *   Steuern sind in den Abrechnungen schon enthalten) und "Wertpapierertrag" (22 Stueck).
 * - Nicht enthalten: Zeit vor 2025, das VL-Depot bei Oskar (Baader Bank).
 *
 * Neue Umsatzliste (PDF) -> Zahlen hier fortschreiben. Rein rechnerisch, keine Datenbank noetig.
 */

export interface EinzahlungsZeitraum {
  label: string;
  /** Anzeige, z. B. "01.01.2025" */
  von: string;
  bis: string;
  /** Depotwert zum Zeitraum-Anfang (Jahresdepotauszug). */
  startWert: number;
  /** Depotwert am Zeitraum-Ende; null = heutiger Wert aus dem Dashboard. */
  endWert: number | null;
  /** Summe aller Kaeufe inkl. Sparplan und Gebuehren (positiver Betrag). */
  kaeufe: number;
  /** Summe aller Verkaeufe nach Steuer und Gebuehren (positiver Betrag). */
  verkaeufe: number;
  /** Ausgezahlte Wertpapiertraege (Dividenden, Fondsertraege). */
  ertraege: number;
}

/** Stand der ausgewerteten Umsatzliste. */
export const UMSATZLISTE_STAND = '10.11.2026';

export const EINZAHLUNGS_ZEITRAEUME: EinzahlungsZeitraum[] = [
  {
    label: '2025',
    von: '01.01.2025',
    bis: '31.12.2025',
    startWert: 77813.25,
    endWert: 143264.9,
    kaeufe: 51515.43,
    verkaeufe: 21492.03,
    ertraege: 87.07,
  },
  {
    label: '2026 bis heute',
    von: '01.01.2026',
    bis: UMSATZLISTE_STAND,
    startWert: 143264.9,
    endWert: null,
    kaeufe: 152515.92,
    verkaeufe: 100986.04,
    ertraege: 90.99,
  },
];

export interface ZeitraumErgebnis {
  label: string;
  von: string;
  bis: string;
  startWert: number;
  endWert: number;
  kaeufe: number;
  verkaeufe: number;
  /** Kaeufe minus Verkaeufe = Geld, das netto ins Depot geflossen ist. */
  nettoEingezahlt: number;
  ertraege: number;
  /** Endwert - Startwert - netto eingezahlt + Ertraege. */
  ergebnis: number;
}

/** Rechnet einen Zeitraum aus. heutigerDepotwert wird nur fuer offene Zeitraeume (endWert null) gebraucht. */
export function berechneZeitraum(z: EinzahlungsZeitraum, heutigerDepotwert: number): ZeitraumErgebnis {
  const endWert = z.endWert ?? heutigerDepotwert;
  const nettoEingezahlt = z.kaeufe - z.verkaeufe;
  return {
    label: z.label,
    von: z.von,
    bis: z.bis,
    startWert: z.startWert,
    endWert,
    kaeufe: z.kaeufe,
    verkaeufe: z.verkaeufe,
    nettoEingezahlt,
    ertraege: z.ertraege,
    ergebnis: endWert - z.startWert - nettoEingezahlt + z.ertraege,
  };
}

/** Alle Zeitraeume zusammen: Start des ersten bis heute. */
export function berechneGesamt(
  zeitraeume: EinzahlungsZeitraum[],
  heutigerDepotwert: number,
): ZeitraumErgebnis | null {
  if (zeitraeume.length === 0) return null;
  const teile = zeitraeume.map((z) => berechneZeitraum(z, heutigerDepotwert));
  const erster = teile[0];
  const letzter = teile[teile.length - 1];
  const kaeufe = teile.reduce((s, t) => s + t.kaeufe, 0);
  const verkaeufe = teile.reduce((s, t) => s + t.verkaeufe, 0);
  const ertraege = teile.reduce((s, t) => s + t.ertraege, 0);
  const nettoEingezahlt = kaeufe - verkaeufe;
  return {
    label: 'Zusammen',
    von: erster.von,
    bis: letzter.bis,
    startWert: erster.startWert,
    endWert: letzter.endWert,
    kaeufe,
    verkaeufe,
    nettoEingezahlt,
    ertraege,
    ergebnis: letzter.endWert - erster.startWert - nettoEingezahlt + ertraege,
  };
}
