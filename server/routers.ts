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
  createTransaction,
  getTransactions,
  updatePortfolioFromTransaction,
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
        const db = await import('./db').then(m => m.getDb());
        const dbInstance = await db();
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

        // 1. Get portfolio positions
        const positions = await getPortfolioPositions(userId);

        if (positions.length === 0) {
          return {
            success: false,
            error: 'Keine Portfolio-Positionen gefunden',
            totalPortfolioValue: 0,
            groups: [],
            underweightGroups: [],
            overweightGroups: [],
            allocation: [],
          };
        }

        // 2. Get target allocations
        const settings = await getUserSettings(userId);

        if (!settings || !settings.targetAllocations) {
          return {
            success: false,
            error: 'Keine Ziel-Allokation in Einstellungen gefunden. Bitte setzen Sie Ihre Strategie.',
            totalPortfolioValue: 0,
            groups: [],
            underweightGroups: [],
            overweightGroups: [],
            allocation: [],
          };
        }

        const targetAllocations = settings.targetAllocations as any[];

        // 3. Calculate current portfolio value
        const totalValue = positions.reduce((sum, pos) => {
          const price = pos.currentPrice || pos.buyPrice;
          return sum + (pos.amount * price);
        }, 0);

        // 4. Group positions by category
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

        // 5. Calculate IST vs SOLL percentages
        const groups = targetAllocations.map(target => {
          const currentValue = groupedByCategory.get(target.category) || 0;
          const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
          const targetPercent = target.target || target.targetPercent || 0;
          const difference = currentPercent - targetPercent;

          return {
            category: target.category,
            currentValue,
            currentPercent,
            targetPercent,
            difference,
            isUnderweight: difference < 0,
          };
        });

        // 6. Sort into underweight and overweight
        const underweightGroups = groups
          .filter(g => g.isUnderweight)
          .sort((a, b) => a.difference - b.difference);

        const overweightGroups = groups
          .filter(g => !g.isUnderweight)
          .sort((a, b) => b.difference - a.difference);

        // 7. Calculate allocation
        const allocation: any[] = [];

        if (underweightGroups.length > 0 && availableCapital > 0) {
          // Calculate total underweight
          const totalUnderweight = underweightGroups.reduce((sum, g) => sum + Math.abs(g.difference), 0);

          // Distribute proportionally
          underweightGroups.forEach(group => {
            const proportion = Math.abs(group.difference) / totalUnderweight;
            const amount = availableCapital * proportion;

            allocation.push({
              category: group.category,
              amount,
              proportion: proportion * 100,
              reason: `${Math.abs(group.difference).toFixed(2)}% untergewichtet`,
            });
          });
        }

        return {
          success: true,
          totalPortfolioValue: totalValue,
          availableCapital,
          groups,
          underweightGroups,
          overweightGroups,
          allocation,
          summary: {
            totalInvested: allocation.reduce((sum, a) => sum + a.amount, 0),
            numberOfUnderweightGroups: underweightGroups.length,
            numberOfOverweightGroups: overweightGroups.length,
            largestUnderweight: underweightGroups[0]?.category || 'Keine',
          },
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
