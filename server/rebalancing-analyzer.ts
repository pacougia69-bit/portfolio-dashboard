/**
 * Portfolio Rebalancing Analyzer
 * Berechnet optimale Verteilung einer Einmalsumme basierend auf Untergewichtung
 */

import { getPortfolioPositions, getUserSettings } from './db';

// KONFIGURATION - Hier anpassbar!
const VERFUEGBARES_KAPITAL = 10000; // In Euro - Hier ändern für andere Beträge!
const USER_ID = 1; // Deine User-ID

interface PortfolioGroup {
  category: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  difference: number;
  isUnderweight: boolean;
}

interface RebalancingResult {
  totalPortfolioValue: number;
  groups: PortfolioGroup[];
  underweightGroups: PortfolioGroup[];
  overweightGroups: PortfolioGroup[];
  allocation: {
    category: string;
    amount: number;
    reason: string;
  }[];
  summary: {
    totalInvested: number;
    numberOfGroups: number;
    largestUnderweight: string;
  };
}

async function analyzeRebalancing(): Promise<RebalancingResult> {
  console.log('=== Portfolio Rebalancing Analyse ===\n');
  console.log(`Verfügbares Kapital: ${VERFUEGBARES_KAPITAL.toLocaleString('de-DE')} €\n`);

  // 1. Hole Portfolio-Positionen
  const positions = await getPortfolioPositions(USER_ID);
  console.log(`Gefundene Positionen: ${positions.length}\n`);

  if (positions.length === 0) {
    throw new Error('Keine Portfolio-Positionen gefunden!');
  }

  // 2. Hole Ziel-Allokation
  const settings = await getUserSettings(USER_ID);

  if (!settings || !settings.targetAllocations) {
    throw new Error('Keine Ziel-Allokation in user_settings gefunden!');
  }

  const targetAllocations = settings.targetAllocations as any[];
  console.log(`Ziel-Allokation (${targetAllocations.length} Gruppen):`);
  targetAllocations.forEach(t => {
    console.log(`  - ${t.category}: ${t.target}%`);
  });
  console.log('');

  // 3. Berechne aktuellen Portfolio-Wert
  const totalValue = positions.reduce((sum, pos) => {
    const price = pos.currentPrice || pos.buyPrice;
    return sum + (pos.amount * price);
  }, 0);

  console.log(`Aktueller Portfolio-Wert: ${totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`);

  // 4. Gruppiere Positionen nach Kategorie
  const groupedByCategory = new Map<string, number>();

  positions.forEach(pos => {
    const category = pos.category || 'Ohne Kategorie';
    const price = pos.currentPrice || pos.buyPrice;
    const value = pos.amount * price;

    groupedByCategory.set(
      category,
      (groupedByCategory.get(category) || 0) + value
    );
  });

  // 5. Berechne Ist-Prozente und vergleiche mit Soll
  const groups: PortfolioGroup[] = [];

  targetAllocations.forEach(target => {
    const currentValue = groupedByCategory.get(target.category) || 0;
    const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetPercent = target.target || target.targetPercent || 0;
    const difference = currentPercent - targetPercent;

    groups.push({
      category: target.category,
      currentValue,
      currentPercent,
      targetPercent,
      difference,
      isUnderweight: difference < 0,
    });
  });

  // 6. Sortiere nach Untergewichtung
  const underweightGroups = groups
    .filter(g => g.isUnderweight)
    .sort((a, b) => a.difference - b.difference); // Größte Untergewichtung zuerst

  const overweightGroups = groups
    .filter(g => !g.isUnderweight)
    .sort((a, b) => b.difference - a.difference);

  console.log('=== IST-VERTEILUNG vs SOLL-VERTEILUNG ===\n');

  console.log('UNTERGEWICHTETE GRUPPEN (erhalten Geld):');
  underweightGroups.forEach(g => {
    console.log(`  ${g.category}:`);
    console.log(`    Ist:  ${g.currentPercent.toFixed(2)}%`);
    console.log(`    Soll: ${g.targetPercent.toFixed(2)}%`);
    console.log(`    Diff: ${g.difference.toFixed(2)}% (${Math.abs(g.difference).toFixed(2)}% zu wenig)`);
    console.log('');
  });

  console.log('ÜBERGEWICHTETE GRUPPEN (erhalten KEIN Geld):');
  overweightGroups.forEach(g => {
    console.log(`  ${g.category}:`);
    console.log(`    Ist:  ${g.currentPercent.toFixed(2)}%`);
    console.log(`    Soll: ${g.targetPercent.toFixed(2)}%`);
    console.log(`    Diff: +${g.difference.toFixed(2)}% (${g.difference.toFixed(2)}% zu viel)`);
    console.log('');
  });

  // 7. Berechne Verteilung der Einmalsumme
  console.log('=== INVESTITIONS-VERTEILUNG ===\n');

  if (underweightGroups.length === 0) {
    console.log('⚠️  KEINE untergewichteten Gruppen gefunden!');
    console.log('    Portfolio ist perfekt allokiert oder übergewichtet.\n');

    return {
      totalPortfolioValue: totalValue,
      groups,
      underweightGroups: [],
      overweightGroups,
      allocation: [],
      summary: {
        totalInvested: 0,
        numberOfGroups: 0,
        largestUnderweight: 'Keine',
      },
    };
  }

  // Berechne Gesamt-Untergewichtung (in Prozentpunkten)
  const totalUnderweight = underweightGroups.reduce((sum, g) => sum + Math.abs(g.difference), 0);

  // Verteile proportional zur Untergewichtung
  const allocation = underweightGroups.map(group => {
    const proportion = Math.abs(group.difference) / totalUnderweight;
    const amount = VERFUEGBARES_KAPITAL * proportion;

    return {
      category: group.category,
      amount,
      reason: `${Math.abs(group.difference).toFixed(2)}% untergewichtet`,
    };
  });

  console.log(`Verfügbares Kapital: ${VERFUEGBARES_KAPITAL.toLocaleString('de-DE')} €\n`);
  console.log('Verteilung:');

  allocation.forEach(a => {
    console.log(`  ${a.category}:`);
    console.log(`    Betrag: ${a.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    console.log(`    Grund:  ${a.reason}`);
    console.log('');
  });

  const totalInvested = allocation.reduce((sum, a) => sum + a.amount, 0);
  console.log(`Gesamt investiert: ${totalInvested.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
  console.log(`Rundungsdifferenz: ${(VERFUEGBARES_KAPITAL - totalInvested).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`);

  return {
    totalPortfolioValue: totalValue,
    groups,
    underweightGroups,
    overweightGroups,
    allocation,
    summary: {
      totalInvested,
      numberOfGroups: underweightGroups.length,
      largestUnderweight: underweightGroups[0]?.category || 'Keine',
    },
  };
}

// Hauptfunktion
async function main() {
  try {
    const result = await analyzeRebalancing();

    console.log('=== ZUSAMMENFASSUNG ===\n');
    console.log(`Portfolio-Wert: ${result.totalPortfolioValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    console.log(`Untergewichtete Gruppen: ${result.summary.numberOfGroups}`);
    console.log(`Größte Untergewichtung: ${result.summary.largestUnderweight}`);
    console.log(`Zu investieren: ${VERFUEGBARES_KAPITAL.toLocaleString('de-DE')} €`);
    console.log(`Tatsächlich verteilt: ${result.summary.totalInvested.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €\n`);

    console.log('✅ Analyse abgeschlossen!\n');

    // Optional: JSON-Export für weitere Verarbeitung
    // console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Fehler bei der Analyse:', error);
    process.exit(1);
  }
}

// Script ausführen
if (require.main === module) {
  main();
}

export { analyzeRebalancing, type RebalancingResult };
