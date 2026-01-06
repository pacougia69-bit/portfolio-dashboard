/**
 * Seed AI Question Templates
 * Run with: tsx server/seed-ai-templates.ts
 */

import { db } from './db';
import { aiQuestionTemplates } from '../drizzle/schema';

const defaultTemplates = [
  {
    title: "Portfolio-Analyse",
    prompt: "Analysiere mein gesamtes Portfolio und gib mir eine Einschätzung zu Diversifikation, Risiko und Optimierungspotenzial.",
    category: "Analyse",
    icon: "BarChart3",
    sortOrder: 1,
  },
  {
    title: "Rebalancing-Empfehlung",
    prompt: "Ich habe gerade extra Kapital verfügbar. Wie sollte ich es investieren, um mein Portfolio wieder auszubalancieren?",
    category: "Investition",
    icon: "Scale",
    sortOrder: 2,
  },
  {
    title: "Sparplan optimieren",
    prompt: "Ich möchte meine ETF-Sparpläne optimieren. Was empfiehlst du basierend auf meiner aktuellen Allokation?",
    category: "Sparplan",
    icon: "Calendar",
    sortOrder: 3,
  },
  {
    title: "Dividenden-Strategie",
    prompt: "Wie ist meine Dividenden-Strategie? Sollte ich mehr auf Dividenden-ETFs oder Wachstums-ETFs setzen?",
    category: "Dividenden",
    icon: "Coins",
    sortOrder: 4,
  },
  {
    title: "Risiko-Bewertung",
    prompt: "Bewerte das Risikoprofil meines Portfolios. Ist es zu riskant oder zu konservativ für meine Ziele?",
    category: "Risiko",
    icon: "AlertTriangle",
    sortOrder: 5,
  },
  {
    title: "Wertpapier-Empfehlung",
    prompt: "Welche ETFs oder Aktien aus meiner Watchlist passen am besten zu meiner Strategie?",
    category: "Empfehlung",
    icon: "Target",
    sortOrder: 6,
  },
  {
    title: "Verkaufs-Strategie",
    prompt: "Gibt es Positionen in meinem Portfolio, die ich verkaufen oder reduzieren sollte?",
    category: "Verkauf",
    icon: "TrendingDown",
    sortOrder: 7,
  },
  {
    title: "Langfrist-Strategie",
    prompt: "Bewerte meine Langfrist-Strategie. Bin ich auf dem richtigen Weg für meine finanziellen Ziele?",
    category: "Strategie",
    icon: "TrendingUp",
    sortOrder: 8,
  },
];

async function seedTemplates() {
  console.log('🌱 Seeding AI question templates...');

  try {
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
