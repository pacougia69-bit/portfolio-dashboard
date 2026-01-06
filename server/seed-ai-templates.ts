/**
 * Seed AI Question Templates
 * Run with: tsx server/seed-ai-templates.ts
 */

import { getDb } from './db';
import { aiQuestionTemplates } from '../drizzle/schema';

const defaultTemplates = [
  {
    title: "Klumpenrisiko-Check",
    prompt: "Analysiere den ETF/die Aktie {ASSET_NAME}. Welche 3 Top-Unternehmen dominieren diese Position aktuell? Gibt es ein Klumpenrisiko in Branche oder Region, das ich im Zusammenspiel mit meinem restlichen Portfolio beachten sollte?",
    category: "Risiko",
    icon: "⚠️",
    sortOrder: 1,
  },
  {
    title: "Makro-Einfluss",
    prompt: "Welche makroökonomischen Daten (Inflation, Zinsen, News) hatten in den letzten 7–14 Tagen den größten Einfluss auf {ASSET_NAME}? Ist der Kurs eher gestiegen/gefallen und was waren die 2–3 Hauptgründe?",
    category: "Analyse",
    icon: "📊",
    sortOrder: 2,
  },
  {
    title: "Investment-Story Check",
    prompt: "Erkläre die langfristige Investment-Story von {ASSET_NAME} (WKN: {WKN}). Was sind die Wachstumstreiber, was die 3–4 größten Risiken und hat sich die Story in den letzten 12 Monaten fundamental verbessert oder verschlechtert?",
    category: "Fundament",
    icon: "📈",
    sortOrder: 3,
  },
  {
    title: "Technik- & Trend-Analyse",
    prompt: "Analysiere {ASSET_NAME} (WKN: {WKN}) technisch: Notiert der Kurs über/unter/nahe der 200-Tage-Linie? Befinden wir uns im Aufwärts-, Abwärtstrend oder in einer Seitwärtsphase? Wie ist die Marktstimmung (optimistisch/skeptisch)?",
    category: "Technik",
    icon: "📉",
    sortOrder: 4,
  },
  {
    title: "Sektor- & News-Update",
    prompt: "Welche sektor-spezifischen Entwicklungen und politischen Faktoren haben {ASSET_NAME} in den letzten 30 Tagen am stärksten beeinflusst? Deuten die Bewegungen auf normale Volatilität oder einen Trendwechsel hin?",
    category: "News",
    icon: "📰",
    sortOrder: 5,
  },
  {
    title: "Rebalancing-Impuls",
    prompt: "Gibt es fundamentale Gründe (Sektor-Rotation, Index-Änderung), warum ich {ASSET_NAME} bei einer Abweichung aktuell verstärkt nachkaufen oder Gewinne mitnehmen sollte, anstatt nur stur nach Prozenten zu rebalancen?",
    category: "Strategie",
    icon: "⚖️",
    sortOrder: 6,
  },
  {
    title: "Marktstimmung",
    prompt: "Wie ist das Sentiment gegenüber {ASSET_NAME} in den letzten 7 Tagen? Ist die Nachrichtenlage positiv/neutral/negativ und welche Themen (KI, Regulierung, Zinsen) dominieren gerade?",
    category: "Sentiment",
    icon: "💭",
    sortOrder: 7,
  },
];

async function seedTemplates() {
  console.log('🌱 Seeding AI question templates...');

  const db = await getDb();
  if (!db) {
    console.error('❌ Database not available');
    throw new Error('Database not available');
  }

  try {
    // Delete all existing templates
    console.log('🗑️  Deleting existing templates...');
    await db.delete(aiQuestionTemplates);
    console.log('✓ Existing templates deleted');

    // Insert new templates
    console.log('\n📝 Inserting new templates...');
    for (const template of defaultTemplates) {
      await db.insert(aiQuestionTemplates).values(template);
      console.log(`✓ Created template: ${template.title}`);
    }

    console.log(`\n✅ Successfully seeded ${defaultTemplates.length} templates!`);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  }
}

seedTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
