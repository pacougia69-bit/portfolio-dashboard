import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
          ? `\n\nAußerdem habe ich folgende ETFs/Wertpapiere in meiner Watchlist, die ich eventuell in meinen Sparplan aufnehmen möchte:\n` +
            watchlistETFs.map(w => `- ${w.name} (${w.ticker}${w.wkn ? `, WKN: ${w.wkn}` : ''})${w.currentPrice ? ` - Aktueller Kurs: ${w.currentPrice}€` : ''}${w.notes ? ` - Notizen: ${w.notes}` : ''}`).join('\n') +
            `\n\nBitte bewerte jeden Watchlist-ETF:\n` +
            `1. Passt er zu meiner Strategie? (Diversifikation, Risiko)\n` +
            `2. Empfehlung: Aufnehmen oder ablehnen? Mit Begründung.\n` +
            `3. Falls empfohlen: Wie viel Euro pro Monat?\n` +
            `4. Erstelle dann eine NEUE Sparplan-Verteilung für alle empfohlenen ETFs.`
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
        pin: z.string().min(4).max(6),
        enabled: z.boolean(),
        autoLockMinutes: z.number().min(1).max(60).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { setUserPin } = await import('./db');
        return setUserPin(ctx.user.id, input.pin, input.enabled, input.autoLockMinutes);
      }),
    
    verifyPin: protectedProcedure
      .input(z.object({
        pin: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { verifyUserPin } = await import('./db');
        return verifyUserPin(ctx.user.id, input.pin);
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
});

export type AppRouter = typeof appRouter;
