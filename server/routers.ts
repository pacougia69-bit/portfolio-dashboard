import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  getPortfolioPositions,
  createPortfolioPosition,
  updatePortfolioPosition,
  deletePortfolioPosition,
  getWatchlistItems,
  createWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
  getDividends,
  createDividend,
  deleteDividend,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getSavingsPlans,
  createSavingsPlan,
  updateSavingsPlan,
  deleteSavingsPlan,
  importPortfolioData,
  exportPortfolioData,
  updatePriceCache,
  getPriceCacheForTickers,
  getUserSettings,
  saveUserSettings,
  createTransaction,
  getTransactions,
  updatePortfolioFromTransaction,
  getTaxSources,
  createTaxSource,
  updateTaxSource,
  deleteTaxSource,
  getTaxSettings,
  saveTaxSettings,
  getTotalExemptionOrders,
  getAllowances,
  createAllowance,
  updateAllowance,
  deleteAllowance,
  getLossCarryforwards,
  createLossCarryforward,
  updateLossCarryforward,
  deleteLossCarryforward,
} from "./db";
import { fetchLivePrices, fetchLivePricesTwelveData, analyzePortfolio, generateRecommendation, lookupByWKN, lookupByTicker } from "./services";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Portfolio Management
  portfolio: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPortfolioPositions(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        wkn: z.string().optional(),
        ticker: z.string(),
        name: z.string(),
        type: z.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]),
        category: z.string().optional(),
        amount: z.number(),
        buyPrice: z.number(),
        currentPrice: z.number().optional(),
        status: z.enum(["Kaufen", "Halten", "Verkaufen"]).optional(),
        notes: z.string().optional(),
        autoUpdate: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createPortfolioPosition(ctx.user.id, {
          ...input,
          amount: String(input.amount),
          buyPrice: String(input.buyPrice),
          currentPrice: input.currentPrice !== undefined ? String(input.currentPrice) : null,
          autoUpdate: input.autoUpdate !== false, // Default true
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        wkn: z.string().optional(),
        ticker: z.string().optional(),
        name: z.string().optional(),
        type: z.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]).optional(),
        category: z.string().optional(),
        amount: z.number().optional(),
        buyPrice: z.number().optional(),
        currentPrice: z.number().optional(),
        status: z.enum(["Kaufen", "Halten", "Verkaufen"]).optional(),
        notes: z.string().optional(),
        autoUpdate: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, amount, buyPrice, currentPrice, autoUpdate, ...rest } = input;
        return updatePortfolioPosition(ctx.user.id, id, {
          ...rest,
          amount: amount !== undefined ? String(amount) : undefined,
          buyPrice: buyPrice !== undefined ? String(buyPrice) : undefined,
          currentPrice: currentPrice !== undefined ? String(currentPrice) : undefined,
          autoUpdate: autoUpdate,
        });
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deletePortfolioPosition(ctx.user.id, input.id);
      }),
    
    import: protectedProcedure
      .input(z.object({
        portfolio: z.array(z.any()),
        watchlist: z.array(z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return importPortfolioData(ctx.user.id, input.portfolio, input.watchlist || []);
      }),
    
    export: protectedProcedure.query(async ({ ctx }) => {
      return exportPortfolioData(ctx.user.id);
    }),
  }),

  // Watchlist Management
  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistItems(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        ticker: z.string(),
        wkn: z.string().optional(),
        name: z.string(),
        currentPrice: z.number().optional(),
        targetPrice: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createWatchlistItem(ctx.user.id, {
          ticker: input.ticker,
          wkn: input.wkn,
          name: input.name,
          currentPrice: input.currentPrice !== undefined ? String(input.currentPrice) : null,
          targetPrice: input.targetPrice !== undefined ? String(input.targetPrice) : null,
          notes: input.notes,
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        ticker: z.string().optional(),
        wkn: z.string().optional(),
        name: z.string().optional(),
        currentPrice: z.number().optional(),
        targetPrice: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updateWatchlistItem(ctx.user.id, id, {
          ticker: data.ticker,
          wkn: data.wkn,
          name: data.name,
          currentPrice: data.currentPrice !== undefined ? String(data.currentPrice) : undefined,
          targetPrice: data.targetPrice !== undefined ? String(data.targetPrice) : undefined,
          notes: data.notes,
        });
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteWatchlistItem(ctx.user.id, input.id);
      }),
  }),

  // Dividends Management
  dividends: router({
    list: protectedProcedure
      .input(z.object({ year: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getDividends(ctx.user.id, input?.year);
      }),
    
    create: protectedProcedure
      .input(z.object({
        ticker: z.string(),
        name: z.string(),
        amount: z.number(),
        taxAmount: z.number().optional(),
        paymentDate: z.string(),
        positionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createDividend(ctx.user.id, input);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteDividend(ctx.user.id, input.id);
      }),
  }),

  // Notes Management
  notes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotes(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        content: z.string().optional(),
        category: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createNote(ctx.user.id, input);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateNote(ctx.user.id, input.id, input);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteNote(ctx.user.id, input.id);
      }),
  }),

  // Savings Plans Management
  savingsPlans: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getSavingsPlans(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        ticker: z.string(),
        name: z.string(),
        monthlyAmount: z.number(),
        executionDay: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createSavingsPlan(ctx.user.id, input);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        ticker: z.string().optional(),
        name: z.string().optional(),
        monthlyAmount: z.number().optional(),
        executionDay: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateSavingsPlan(ctx.user.id, input.id, input);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteSavingsPlan(ctx.user.id, input.id);
      }),
  }),

  // Live Prices
  prices: router({
    fetch: protectedProcedure
      .input(z.object({ tickers: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        const prices = await fetchLivePrices(input.tickers);
        
        // Update portfolio positions with new prices (nur wenn autoUpdate = true)
        const positions = await getPortfolioPositions(ctx.user.id);
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const priceData of prices) {
          const position = positions.find(p => p.ticker === priceData.ticker);
          if (position) {
            // Skip positions with manual price (autoUpdate = false)
            if (position.autoUpdate === false) {
              skippedCount++;
              continue;
            }
            // Convert to EUR if needed
            let priceInEur = priceData.price;
            if (priceData.currency === 'USD') {
              priceInEur = priceData.price / 1.08; // Approximate EUR/USD rate
            }
            await updatePortfolioPosition(ctx.user.id, position.id, {
              currentPrice: String(priceInEur),
            });
            updatedCount++;
          }
        }
        
        return { prices, updatedCount, skippedCount };
      }),
    
    fetchTwelveData: protectedProcedure
      .input(z.object({ tickers: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        const apiKey = process.env.TWELVE_DATA_API_KEY;
        if (!apiKey) {
          throw new Error("Twelve Data API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.");
        }
        const prices = await fetchLivePricesTwelveData(input.tickers, apiKey);
        
        // Update portfolio positions with new prices (nur wenn autoUpdate = true)
        const positions = await getPortfolioPositions(ctx.user.id);
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const priceData of prices) {
          const position = positions.find(p => p.ticker === priceData.ticker);
          if (position && priceData.priceEur) {
            // Skip positions with manual price (autoUpdate = false)
            if (position.autoUpdate === false) {
              skippedCount++;
              continue;
            }
            await updatePortfolioPosition(ctx.user.id, position.id, {
              currentPrice: String(priceData.priceEur),
            });
            updatedCount++;
          }
        }
        
        return { prices, updatedCount, skippedCount };
      }),
    
    getCached: protectedProcedure
      .input(z.object({ tickers: z.array(z.string()) }))
      .query(async ({ input }) => {
        return getPriceCacheForTickers(input.tickers);
      }),
    
    hasApiKey: protectedProcedure.query(async () => {
      return { hasKey: !!process.env.TWELVE_DATA_API_KEY };
    }),
  }),

  // AI Assistant
  ai: router({
    analyzePortfolio: protectedProcedure.mutation(async ({ ctx }) => {
      const positions = await getPortfolioPositions(ctx.user.id);
      return analyzePortfolio(ctx.user.id, positions);
    }),
    
    getRecommendation: protectedProcedure
      .input(z.object({ ticker: z.string(), name: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const positions = await getPortfolioPositions(ctx.user.id);
        return generateRecommendation(ctx.user.id, input.ticker, input.name, positions);
      }),
    
    chat: protectedProcedure
      .input(z.object({ message: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const positions = await getPortfolioPositions(ctx.user.id);
        const watchlist = await getWatchlistItems(ctx.user.id);
        return analyzePortfolio(ctx.user.id, positions, input.message, watchlist);
      }),
      
    suggestSparplan: protectedProcedure
      .input(z.object({ monthlyBudget: z.number(), currentAllocations: z.array(z.object({
        category: z.string(),
        currentPercent: z.number(),
        targetPercent: z.number(),
      })) }))
      .mutation(async ({ ctx, input }) => {
        const positions = await getPortfolioPositions(ctx.user.id);
        const watchlist = await getWatchlistItems(ctx.user.id);
        const watchlistETFs = watchlist.filter(w => 
          w.name.toLowerCase().includes('etf') || 
          w.name.toLowerCase().includes('ishares') || 
          w.name.toLowerCase().includes('vanguard') ||
          w.name.toLowerCase().includes('xtrackers') ||
          w.name.toLowerCase().includes('gold') ||
          w.name.toLowerCase().includes('bond') ||
          w.name.toLowerCase().includes('treasury')
        );
        
        const watchlistInfo = watchlistETFs.length > 0
          ? `\n\nHinweis: Ich habe ${watchlistETFs.length} ETF(s) in meiner Watchlist:\n` +
            watchlistETFs.map(w => `- ${w.name} (${w.ticker}${w.wkn ? `, WKN: ${w.wkn}` : ''})${w.currentPrice ? ` - Aktueller Kurs: ${w.currentPrice}€` : ''}${w.notes ? ` - Notizen: ${w.notes}` : ''}`).join('\n') +
            `\n\nFalls sinnvoll, kannst du sie kurz erwähnen, aber konzentriere dich auf meine konkrete Frage.`
          : '';
        
        return analyzePortfolio(ctx.user.id, positions, 
          `Ich habe ein monatliches Budget von ${input.monthlyBudget}€ für ETF-Sparpläne. ` +
          `Meine aktuelle ETF-Allokation ist: ${input.currentAllocations.map(a => `${a.category}: ${a.currentPercent.toFixed(1)}% (Ziel: ${a.targetPercent}%)`).join(', ')}. ` +
          `Bitte schlage mir vor, wie ich die ${input.monthlyBudget}€ auf meine ETFs verteilen soll, um meine Ziel-Allokation zu erreichen. ` +
          `Berücksichtige dabei auch Rebalancing-Bedarf. Gib konkrete Euro-Beträge pro ETF an.` +
          watchlistInfo,
          watchlist
        );
      }),

    // Template Management
    listTemplates: protectedProcedure.query(async () => {
      console.log('📋 listTemplates called');

      try {
        const { aiQuestionTemplates } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const { sql } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) {
          console.error('❌ listTemplates: Database not available');
          return [];
        }

        console.log('✓ Database connection OK');

        // Use raw SQL to avoid type mismatch with TINYINT(1) vs boolean
        console.log('🔍 Executing query: SELECT * FROM ai_question_templates WHERE isActive = 1 ORDER BY sortOrder');

        const result = await db.execute(sql`
          SELECT * FROM ai_question_templates
          WHERE isActive = 1
          ORDER BY sortOrder
        `);

        console.log('✓ Query executed successfully');
        console.log('📊 Raw result type:', typeof result);
        console.log('📊 Result is array:', Array.isArray(result));
        console.log('📊 Result length:', result ? result.length : 'null');
        console.log('📊 Result[0] type:', typeof result[0]);
        console.log('📊 Result[0] is array:', Array.isArray(result[0]));
        console.log('📊 Result[0] length:', result[0] ? (result[0] as any).length : 'null');

        // MySQL2 returns [rows, fields] - we need the first element
        const rows = Array.isArray(result[0]) ? result[0] : [];
        console.log(`✅ Returning ${rows.length} templates`);

        if (rows.length > 0) {
          console.log('📝 First template:', JSON.stringify(rows[0], null, 2));
        }

        return rows;
      } catch (error: any) {
        console.error('❌❌❌ listTemplates ERROR:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error code:', error.code);
        console.error('Error sqlMessage:', error.sqlMessage);

        // Return empty array instead of throwing to prevent 500 error
        return [];
      }
    }),

    createTemplate: protectedProcedure
      .input(z.object({
        title: z.string(),
        prompt: z.string(),
        category: z.string().optional(),
        icon: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { aiQuestionTemplates } = await import('../drizzle/schema');
        const { getDb } = await import('./db');

        const db = await getDb();
        if (!db) {
          throw new Error('Database connection not available. Please try again.');
        }

        return db.insert(aiQuestionTemplates).values(input);
      }),

    updateTemplate: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        prompt: z.string().optional(),
        category: z.string().optional(),
        icon: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { aiQuestionTemplates } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const { eq } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) {
          throw new Error('Database connection not available. Please try again.');
        }

        const { id, ...updates } = input;
        return db.update(aiQuestionTemplates).set(updates).where(eq(aiQuestionTemplates.id, id));
      }),

    deleteTemplate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { aiQuestionTemplates } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const { eq } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) {
          throw new Error('Database connection not available. Please try again.');
        }

        return db.update(aiQuestionTemplates).set({ isActive: false }).where(eq(aiQuestionTemplates.id, input.id));
      }),

    // Chat History
    getChatHistory: protectedProcedure
      .input(z.object({ sessionId: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const { aiChatHistory } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const { eq, and } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) {
          console.error('❌ getChatHistory: Database not available');
          return [];
        }

        const conditions = [eq(aiChatHistory.userId, ctx.user.id)];
        if (input.sessionId) {
          conditions.push(eq(aiChatHistory.sessionId, input.sessionId));
        }
        return db.select().from(aiChatHistory).where(and(...conditions)).orderBy(aiChatHistory.createdAt);
      }),

    saveChatMessage: protectedProcedure
      .input(z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        templateId: z.number().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { aiChatHistory } = await import('../drizzle/schema');
        const { getDb } = await import('./db');

        const db = await getDb();
        if (!db) {
          throw new Error('Database connection not available. Please try again.');
        }

        return db.insert(aiChatHistory).values({
          userId: ctx.user.id,
          ...input,
        });
      }),

    // Reset Templates to Default
    resetTemplates: protectedProcedure
      .mutation(async () => {
        const { aiQuestionTemplates } = await import('../drizzle/schema');
        const { getDb } = await import('./db');
        const { sql } = await import('drizzle-orm');

        const db = await getDb();
        if (!db) throw new Error("Database not available");

        try {
          // Default templates with all required fields
          const defaultTemplates = [
            {
              title: "Klumpenrisiko-Check",
              prompt: "Analysiere den ETF/die Aktie {ASSET_NAME}. Welche 3 Top-Unternehmen dominieren diese Position aktuell? Gibt es ein Klumpenrisiko in Branche oder Region, das ich im Zusammenspiel mit meinem restlichen Portfolio beachten sollte?",
              category: "Risiko",
              icon: "⚠️",
              isActive: true,
              sortOrder: 1,
            },
            {
              title: "Makro-Einfluss",
              prompt: "Welche makroökonomischen Daten (Inflation, Zinsen, News) hatten in den letzten 7–14 Tagen den größten Einfluss auf {ASSET_NAME}? Ist der Kurs eher gestiegen/gefallen und was waren die 2–3 Hauptgründe?",
              category: "Analyse",
              icon: "📊",
              isActive: true,
              sortOrder: 2,
            },
            {
              title: "Investment-Story Check",
              prompt: "Erkläre die langfristige Investment-Story von {ASSET_NAME} (WKN: {WKN}). Was sind die Wachstumstreiber, was die 3–4 größten Risiken und hat sich die Story in den letzten 12 Monaten fundamental verbessert oder verschlechtert?",
              category: "Fundament",
              icon: "📈",
              isActive: true,
              sortOrder: 3,
            },
            {
              title: "Technik- & Trend-Analyse",
              prompt: "Analysiere {ASSET_NAME} (WKN: {WKN}) technisch: Notiert der Kurs über/unter/nahe der 200-Tage-Linie? Befinden wir uns im Aufwärts-, Abwärtstrend oder in einer Seitwärtsphase? Wie ist die Marktstimmung (optimistisch/skeptisch)?",
              category: "Technik",
              icon: "📉",
              isActive: true,
              sortOrder: 4,
            },
            {
              title: "Sektor- & News-Update",
              prompt: "Welche sektor-spezifischen Entwicklungen und politischen Faktoren haben {ASSET_NAME} in den letzten 30 Tagen am stärksten beeinflusst? Deuten die Bewegungen auf normale Volatilität oder einen Trendwechsel hin?",
              category: "News",
              icon: "📰",
              isActive: true,
              sortOrder: 5,
            },
            {
              title: "Rebalancing-Impuls",
              prompt: "Gibt es fundamentale Gründe (Sektor-Rotation, Index-Änderung), warum ich {ASSET_NAME} bei einer Abweichung aktuell verstärkt nachkaufen oder Gewinne mitnehmen sollte, anstatt nur stur nach Prozenten zu rebalancen?",
              category: "Strategie",
              icon: "⚖️",
              isActive: true,
              sortOrder: 6,
            },
            {
              title: "Marktstimmung",
              prompt: "Wie ist das Sentiment gegenüber {ASSET_NAME} in den letzten 7 Tagen? Ist die Nachrichtenlage positiv/neutral/negativ und welche Themen (KI, Regulierung, Zinsen) dominieren gerade?",
              category: "Sentiment",
              icon: "💭",
              isActive: true,
              sortOrder: 7,
            },
          ];

          // Step 1: Drop and recreate table with correct schema
          console.log('');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('!!! RESET NUR DURCH BUTTON !!!');
          console.log('!!! resetTemplates mutation wurde aufgerufen !!!');
          console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
          console.log('');
          console.log('Dropping ai_question_templates table...');
          await db.execute(sql`DROP TABLE IF EXISTS ai_question_templates`);

          console.log('Recreating ai_question_templates table...');
          await db.execute(sql`
            CREATE TABLE ai_question_templates (
              id int AUTO_INCREMENT NOT NULL,
              title varchar(255) NOT NULL,
              prompt text NOT NULL,
              category varchar(50),
              icon varchar(50),
              isActive tinyint(1) DEFAULT 1,
              sortOrder int DEFAULT 0,
              createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          // Step 2: Insert templates with explicit timestamps
          console.log('Inserting templates...');
          for (const template of defaultTemplates) {
            try {
              await db.execute(sql`
                INSERT INTO ai_question_templates
                  (title, prompt, category, icon, isActive, sortOrder, createdAt, updatedAt)
                VALUES
                  (
                    ${template.title},
                    ${template.prompt},
                    ${template.category},
                    ${template.icon},
                    ${template.isActive ? 1 : 0},
                    ${template.sortOrder},
                    NOW(),
                    NOW()
                  )
              `);
              console.log(`Inserted template: ${template.title}`);
            } catch (insertError) {
              console.error(`Failed to insert template: ${template.title}`, insertError);
              throw new Error(`Failed to insert template "${template.title}": ${insertError}`);
            }
          }

          console.log('Templates reset successfully');
          return { success: true, count: defaultTemplates.length };
        } catch (error) {
          console.error('Reset templates error:', error);
          throw new Error(`Failed to reset templates: ${error}`);
        }
      }),
  }),

  // Security Lookup
  lookup: router({
    byWKN: protectedProcedure
      .input(z.object({ wkn: z.string() }))
      .mutation(async ({ input }) => {
        return lookupByWKN(input.wkn);
      }),
    
    byTicker: protectedProcedure
      .input(z.object({ ticker: z.string() }))
      .mutation(async ({ input }) => {
        return lookupByTicker(input.ticker);
      }),
  }),

  // Watchlist to Portfolio Transfer
  transfer: router({
    watchlistToPortfolio: protectedProcedure
      .input(z.object({
        watchlistId: z.number(),
        amount: z.number(),
        buyPrice: z.number(),
        type: z.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]),
        category: z.string().optional(),
        status: z.enum(["Kaufen", "Halten", "Verkaufen"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get watchlist item
        const watchlistItems = await getWatchlistItems(ctx.user.id);
        const item = watchlistItems.find(w => w.id === input.watchlistId);
        
        if (!item) {
          throw new Error('Watchlist-Eintrag nicht gefunden');
        }
        
        // Create portfolio position from watchlist item
        const position = await createPortfolioPosition(ctx.user.id, {
          wkn: item.wkn || undefined,
          ticker: item.ticker,
          name: item.name,
          type: input.type,
          category: input.category,
          amount: String(input.amount),
          buyPrice: String(input.buyPrice),
          currentPrice: item.currentPrice ? String(item.currentPrice) : null,
          status: input.status,
        });
        
        // Optionally delete from watchlist
        await deleteWatchlistItem(ctx.user.id, input.watchlistId);
        
        return { success: true, position };
      }),
  }),

  // Transactions (DKB PDF Import)
  transactions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getTransactions(ctx.user.id);
    }),
    
    uploadDKBPDF: protectedProcedure
      .input(z.object({
        pdfBase64: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Decode base64 PDF
          const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');
          
          // Parse DKB PDF (dynamic import to avoid pdf-parse initialization at server startup)
          const { parseDKBPDF } = await import("./dkb-parser");
          const transactionData = await parseDKBPDF(pdfBuffer);
          
          // Create transaction record (with duplicate check)
          // Ensure orderNumber is ALWAYS a string to prevent type coercion issues
          const result = await createTransaction(ctx.user.id, {
            date: transactionData.date,
            type: transactionData.type,
            isin: transactionData.isin,
            wkn: transactionData.wkn,
            name: transactionData.name,
            quantity: transactionData.quantity,
            price: transactionData.price,
            fees: transactionData.fees,
            totalAmount: transactionData.totalAmount,
            orderNumber: String(transactionData.orderNumber),
            invoiceNumber: transactionData.invoiceNumber,
          });
          
          if (result.duplicate) {
            return {
              success: false,
              duplicate: true,
              message: `Diese DKB-Abrechnung wurde bereits importiert (Auftragsnummer ${result.orderNumber}).\nEs wurden keine neuen Transaktionen hinzugefügt.`,
            };
          }
          
          // Update portfolio position
          await updatePortfolioFromTransaction(
            ctx.user.id,
            transactionData.isin,
            transactionData.wkn,
            transactionData.name,
            transactionData.type,
            transactionData.quantity,
            transactionData.totalAmount
          );
          
          return {
            success: true,
            duplicate: false,
            message: '1 Transaktion erfolgreich importiert.',
            transaction: transactionData,
          };
        } catch (error) {
          // Log detailed error for debugging (server-side only)
          console.error('DKB PDF import error:', error);
          
          // Ensure server doesn't crash - always return a structured response
          const errorMessage = error instanceof Error 
            ? error.message 
            : 'Unerwarteter Fehler beim Importieren der PDF.';
          
          return {
            success: false,
            duplicate: false,
            message: errorMessage,
          };
        }
      }),
  }),

  // User Settings
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),
    
    save: protectedProcedure
      .input(z.object({
        monthlyBudget: z.number().optional(),
        targetAllocations: z.array(z.object({
          category: z.string(),
          targetPercent: z.number(),
          description: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return saveUserSettings(ctx.user.id, input);
      }),
    
    // PIN-Sperre Funktionen
    setPin: protectedProcedure
      .input(z.object({
        pin: z.string()
          .optional()
          .refine((val) => {
            // PIN is optional, but if provided and not empty, must be valid
            if (val && val.length > 0) {
              return val.length >= 4 && val.length <= 6 && /^\d+$/.test(val);
            }
            return true;
          }, {
            message: "Der PIN muss 4-6 Ziffern enthalten"
          }),
        enabled: z.boolean(),
        autoLockMinutes: z.number()
          .min(1, { message: "Auto-Sperre muss mindestens 1 Minute sein" })
          .max(60, { message: "Auto-Sperre darf maximal 60 Minuten sein" })
          .optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { setUserPin, getUserSettings } = await import('./db');

        // If PIN is provided and not empty, update PIN
        if (input.pin && input.pin.length > 0) {
          return setUserPin(ctx.user.id, input.pin, input.enabled, input.autoLockMinutes);
        }

        // Otherwise, just update autoLockMinutes and/or enabled status
        const existing = await getUserSettings(ctx.user.id);

        if (!existing) {
          throw new Error("Bitte setzen Sie zuerst einen PIN");
        }

        // Update only settings, keep existing PIN hash
        const { getDb } = await import('./db');
        const dbInstance = await getDb();
        if (!dbInstance) throw new Error("Database not available");

        const { userSettings } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');

        const updateData: Record<string, unknown> = {};
        if (input.enabled !== undefined) updateData.pinEnabled = input.enabled;
        if (input.autoLockMinutes !== undefined) updateData.autoLockMinutes = input.autoLockMinutes;

        await dbInstance.update(userSettings)
          .set(updateData)
          .where(eq(userSettings.userId, ctx.user.id));

        return { success: true };
      }),
    
    verifyPin: protectedProcedure
      .input(z.object({
        pin: z.string()
          .min(1, { message: "Bitte PIN eingeben" }),
      }))
      .mutation(async ({ ctx, input }) => {
        const { verifyUserPin } = await import('./db');
        const result = await verifyUserPin(ctx.user.id, input.pin);

        if (!result.valid) {
          throw new Error("Der PIN ist falsch");
        }

        return result;
      }),
    
    removePin: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { removeUserPin } = await import('./db');
        return removeUserPin(ctx.user.id);
      }),
    
    getPinStatus: protectedProcedure
      .query(async ({ ctx }) => {
        const { getUserPinStatus } = await import('./db');
        return getUserPinStatus(ctx.user.id);
      }),
  }),

  // Portfolio Rebalancing
  rebalancing: router({
    analyze: protectedProcedure
      .input(z.object({
        amount: z.number().min(0, { message: "Betrag muss mindestens 0 € sein" }),
      }))
      .query(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const availableCapital = input.amount;

        // 1. Get active savings plans (ETFs with savings rate > 0)
        const savingsPlans = await getSavingsPlans(userId);
        const activeETFs = savingsPlans.filter(plan =>
          plan.isActive && Number(plan.monthlyAmount) > 0
        );

        if (activeETFs.length === 0) {
          return {
            success: false,
            error: 'Keine aktiven Sparpläne gefunden. Bitte legen Sie auf der Strategie-Seite ETF-Sparraten fest.',
            totalPortfolioValue: 0,
            groups: [],
            underweightGroups: [],
            overweightGroups: [],
            allocation: [],
            allocationDetails: [],
          };
        }

        // 2. Get portfolio positions to get current values
        const positions = await getPortfolioPositions(userId);

        // Calculate total portfolio value from ALL positions
        const totalValue = positions.reduce((sum, pos) => {
          const price = pos.currentPrice || pos.buyPrice;
          return sum + (pos.amount * price);
        }, 0);

        // 3. Define individual ETF targets (60% World, 20% EM) - FIXED from category-based
        const individualETFTargets = [
          { wkn: 'A0RPWH', name: 'MSCI World', targetPercent: 60 },
          { wkn: 'A111X9', name: 'Emerging Markets', targetPercent: 20 },
        ];

        // 4. Find matching positions by WKN and calculate deficits
        const etfDeficits: any[] = [];

        individualETFTargets.forEach(etfTarget => {
          // Find position by WKN
          const position = positions.find(p => p.wkn === etfTarget.wkn);

          let currentValue = 0;
          if (position) {
            const price = position.currentPrice || position.buyPrice;
            currentValue = position.amount * price;
          }

          const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
          const targetValue = totalValue * (etfTarget.targetPercent / 100);
          const deficit = targetValue - currentValue;
          const difference = currentPercent - etfTarget.targetPercent;

          etfDeficits.push({
            wkn: etfTarget.wkn,
            name: etfTarget.name,
            currentValue,
            currentPercent,
            targetPercent: etfTarget.targetPercent,
            targetValue,
            deficit,
            difference,
            isUnderweight: difference < 0,
            position,
          });
        });

        // 5. Sort into underweight and overweight
        const underweightGroups = etfDeficits
          .filter(g => g.isUnderweight)
          .sort((a, b) => a.difference - b.difference);

        const overweightGroups = etfDeficits
          .filter(g => !g.isUnderweight)
          .sort((a, b) => b.difference - a.difference);

        // 6. Calculate allocation with individual securities
        const allocation: any[] = [];
        const allocationDetails: any[] = [];

        // CRITICAL: Always show allocation if capital > 0 AND any ETF is underweight
        if (underweightGroups.length > 0 && availableCapital > 0) {
          // Calculate total deficit in absolute terms
          const totalDeficit = underweightGroups.reduce((sum, g) => sum + g.deficit, 0);

          // Distribute proportionally to deficits
          underweightGroups.forEach(etf => {
            const proportion = etf.deficit / totalDeficit;
            const allocatedAmount = Math.min(availableCapital * proportion, etf.deficit);

            allocation.push({
              category: etf.name,
              amount: allocatedAmount,
              proportion: proportion * 100,
              reason: `${Math.abs(etf.difference).toFixed(2)}% untergewichtet (Ziel: ${etf.targetPercent}%)`,
            });

            // Find active savings plan for this ETF
            const savingsPlan = activeETFs.find(plan => {
              const pos = positions.find(p => p.ticker === plan.ticker);
              return pos && pos.wkn === etf.wkn;
            });

            const currentPrice = etf.position?.currentPrice || etf.position?.buyPrice || 0;

            allocationDetails.push({
              category: etf.name,
              name: savingsPlan?.name || etf.name,
              ticker: etf.position?.ticker || savingsPlan?.ticker || 'N/A',
              wkn: etf.wkn,
              isin: etf.position?.isin || '',
              amount: allocatedAmount,
              currentPrice,
              shares: currentPrice > 0 ? allocatedAmount / currentPrice : 0,
              monthlySavingsRate: savingsPlan ? Number(savingsPlan.monthlyAmount) : 0,
            });
          });
        }

        // 7. Also include Pillar A summary for legacy compatibility
        const pillarAValue = etfDeficits.reduce((sum, etf) => sum + etf.currentValue, 0);
        const pillarAPercent = totalValue > 0 ? (pillarAValue / totalValue) * 100 : 0;
        const pillarATargetPercent = 80; // CORRECTED from 5% to 80%

        const groups = [
          {
            category: 'Säule A (Aktien ETF)',
            currentValue: pillarAValue,
            currentPercent: pillarAPercent,
            targetPercent: pillarATargetPercent,
            difference: pillarAPercent - pillarATargetPercent,
            isUnderweight: pillarAPercent < pillarATargetPercent,
          },
          ...etfDeficits.map(etf => ({
            category: `${etf.name} (${etf.wkn})`,
            currentValue: etf.currentValue,
            currentPercent: etf.currentPercent,
            targetPercent: etf.targetPercent,
            difference: etf.difference,
            isUnderweight: etf.isUnderweight,
          })),
        ];

        return {
          success: true,
          totalPortfolioValue: totalValue,
          availableCapital,
          groups,
          underweightGroups,
          overweightGroups,
          allocation,
          allocationDetails,
          summary: {
            totalInvested: allocation.reduce((sum, a) => sum + a.amount, 0),
            numberOfUnderweightGroups: underweightGroups.length,
            numberOfOverweightGroups: overweightGroups.length,
            largestUnderweight: underweightGroups[0]?.name || 'Keine',
            activeETFsCount: activeETFs.length,
          },
        };
      }),
  }),

  // Tax Management
  tax: router({
    listSources: protectedProcedure.query(async ({ ctx }) => {
      return getTaxSources(ctx.user.id);
    }),

    createSource: protectedProcedure
      .input(z.object({
        name: z.string().min(1, { message: "Name ist erforderlich" }),
        exemptionOrder: z.number().min(0, { message: "Freistellungsauftrag muss positiv sein" }),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const currentTotal = await getTotalExemptionOrders(ctx.user.id);
        const settings = await getTaxSettings(ctx.user.id);
        const maxLimit = settings?.maxExemptionOrder || 1000;

        if (currentTotal + input.exemptionOrder > maxLimit) {
          throw new Error(`Freistellungsauftrag würde das Limit von ${maxLimit}€ überschreiten (aktuell: ${currentTotal}€)`);
        }

        return createTaxSource(ctx.user.id, input);
      }),

    updateSource: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        exemptionOrder: z.number().min(0).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;

        if (data.exemptionOrder !== undefined) {
          const sources = await getTaxSources(ctx.user.id);
          const currentSource = sources.find(s => s.id === id);
          const otherSourcesTotal = sources
            .filter(s => s.id !== id)
            .reduce((sum, s) => sum + s.exemptionOrder, 0);

          const settings = await getTaxSettings(ctx.user.id);
          const maxLimit = settings?.maxExemptionOrder || 1000;

          if (otherSourcesTotal + data.exemptionOrder > maxLimit) {
            throw new Error(`Freistellungsauftrag würde das Limit von ${maxLimit}€ überschreiten`);
          }
        }

        return updateTaxSource(ctx.user.id, id, data);
      }),

    deleteSource: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return deleteTaxSource(ctx.user.id, input.id);
      }),

    getTotalExemption: protectedProcedure.query(async ({ ctx }) => {
      const total = await getTotalExemptionOrders(ctx.user.id);
      return { total };
    }),

    getSettings: protectedProcedure.query(async ({ ctx }) => {
      return getTaxSettings(ctx.user.id);
    }),

    saveSettings: protectedProcedure
      .input(z.object({
        stockLossPot: z.number().min(0).optional(),
        otherLossPot: z.number().min(0).optional(),
        maxExemptionOrder: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return saveTaxSettings(ctx.user.id, input);
      }),

    // Tax Allowances (Freibeträge)
    getAllowances: protectedProcedure.query(async ({ ctx }) => {
      return getAllowances(ctx.user.id);
    }),

    createAllowance: protectedProcedure
      .input(z.object({
        year: z.number(),
        amount: z.number().min(0),
        used: z.number().min(0).default(0),
        broker: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createAllowance(ctx.user.id, input);
      }),

    updateAllowance: protectedProcedure
      .input(z.object({
        id: z.number(),
        year: z.number().optional(),
        amount: z.number().min(0).optional(),
        used: z.number().min(0).optional(),
        broker: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updateAllowance(ctx.user.id, id, data);
      }),

    deleteAllowance: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteAllowance(ctx.user.id, input.id);
      }),

    // Loss Carryforwards (Verlustvorträge)
    getLossCarryforwards: protectedProcedure.query(async ({ ctx }) => {
      return getLossCarryforwards(ctx.user.id);
    }),

    createLossCarryforward: protectedProcedure
      .input(z.object({
        year: z.number(),
        category: z.enum(["general", "stocks", "other"]),
        amount: z.number(),
        broker: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createLossCarryforward(ctx.user.id, input);
      }),

    updateLossCarryforward: protectedProcedure
      .input(z.object({
        id: z.number(),
        year: z.number().optional(),
        category: z.enum(["general", "stocks", "other"]).optional(),
        amount: z.number().optional(),
        broker: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return updateLossCarryforward(ctx.user.id, id, data);
      }),

    deleteLossCarryforward: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteLossCarryforward(ctx.user.id, input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
