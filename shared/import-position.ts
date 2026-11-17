/**
 * Welche Depot-Position bekommt eine importierte Abrechnung (DKB-PDF, manuelle Transaktion)?
 *
 * Hintergrund: Manche WKNs stehen absichtlich zweimal im Depot (z. B. A2N6LC = XAIX:
 * Altbestand und Neukäufe getrennt geführt, Neukäufe werden zuerst verkauft).
 * Früher nahm der Import bei gleicher WKN die erste Fundstelle (Altbestand, id 92).
 * Jetzt gilt: Es zählt die NEUESTE Position (höchste id).
 *
 * - Kauf / Sparplan: neueste Position.
 * - Verkauf: neueste Position, die die verkaufte Stückzahl noch hergibt
 *   (sonst würde ein großer Verkauf die Neukäufe löschen und der Rest ginge verloren);
 *   passt keine, bleibt es bei der neuesten.
 */
export interface ImportKandidat {
  id: number;
  amount: number | string;
}

export function waehleImportPosition<T extends ImportKandidat>(
  kandidaten: readonly T[],
  transactionType: 'Kauf' | 'Verkauf' | 'Sparplan',
  quantity: number,
): T | null {
  if (kandidaten.length === 0) return null;
  const neuesteZuerst = [...kandidaten].sort((a, b) => b.id - a.id);
  if (transactionType === 'Verkauf') {
    // kleine Toleranz gegen Rundungsreste bei Bruchstücken
    const passend = neuesteZuerst.find(k => Number(k.amount) + 1e-9 >= quantity);
    if (passend) return passend;
  }
  return neuesteZuerst[0];
}
