import { eq, and, gte, lte, inArray, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  portfolioPositions, 
  watchlistItems, 
  dividends, 
  notes, 
  savingsPlans,
  priceCache,
  aiAnalyses,
  userSettings,
  transactions,
  InsertPortfolioPosition,
  InsertWatchlistItem,
  InsertDividend,
  InsertNote,
  InsertSavingsPlan,
  InsertPriceCache,
  InsertTransaction,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getEurUsdRate, USD_DENOMINATED_WKNS } from './currency';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User functions
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Portfolio Position functions
export async function getPortfolioPositions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  return result.map(p => ({
    ...p,
    amount: Number(p.amount),
    buyPrice: Number(p.buyPrice),
    currentPrice: p.currentPrice ? Number(p.currentPrice) : null,
  }));
}

export async function createPortfolioPosition(userId: number, data: Omit<InsertPortfolioPosition, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(portfolioPositions).values({
    ...data,
    userId,
    amount: String(data.amount),
    buyPrice: String(data.buyPrice),
    currentPrice: data.currentPrice ? String(data.currentPrice) : null,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function updatePortfolioPosition(userId: number, id: number, data: Partial<InsertPortfolioPosition>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = {};
  if (data.wkn !== undefined) updateData.wkn = data.wkn;
  if (data.ticker !== undefined) updateData.ticker = data.ticker;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.amount !== undefined) updateData.amount = String(data.amount);
  if (data.buyPrice !== undefined) updateData.buyPrice = String(data.buyPrice);
  if (data.currentPrice !== undefined) updateData.currentPrice = String(data.currentPrice);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.autoUpdate !== undefined) updateData.autoUpdate = data.autoUpdate;
  
  await db.update(portfolioPositions)
    .set(updateData)
    .where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  
  return { success: true };
}

export async function deletePortfolioPosition(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(portfolioPositions)
    .where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  
  return { success: true };
}

// Watchlist functions
export async function getWatchlistItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(watchlistItems).where(eq(watchlistItems.userId, userId));
  return result.map(w => ({
    ...w,
    currentPrice: w.currentPrice ? Number(w.currentPrice) : null,
    targetPrice: w.targetPrice ? Number(w.targetPrice) : null,
  }));
}

export async function createWatchlistItem(userId: number, data: Omit<InsertWatchlistItem, 'userId'>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(watchlistItems).values({
    ...data,
    userId,
    currentPrice: data.currentPrice ? String(data.currentPrice) : null,
    targetPrice: data.targetPrice ? String(data.targetPrice) : null,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function updateWatchlistItem(userId: number, id: number, data: Partial<InsertWatchlistItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = {};
  if (data.ticker !== undefined) updateData.ticker = data.ticker;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.currentPrice !== undefined) updateData.currentPrice = String(data.currentPrice);
  if (data.targetPrice !== undefined) updateData.targetPrice = String(data.targetPrice);
  if (data.notes !== undefined) updateData.notes = data.notes;
  
  await db.update(watchlistItems)
    .set(updateData)
    .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)));
  
  return { success: true };
}

export async function deleteWatchlistItem(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(watchlistItems)
    .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)));
  
  return { success: true };
}

export async function removeFromWatchlistByISINOrWKN(userId: number, isin: string, wkn?: string) {
  const db = await getDb();
  if (!db) return { removed: false };

  // Find watchlist item matching by ticker (ISIN) or WKN
  const conditions = [and(eq(watchlistItems.userId, userId), eq(watchlistItems.ticker, isin))];
  if (wkn) {
    conditions.push(and(eq(watchlistItems.userId, userId), eq(watchlistItems.wkn, wkn)));
  }

  for (const condition of conditions) {
    const items = await db.select().from(watchlistItems).where(condition!).limit(1);
    if (items.length > 0) {
      await db.delete(watchlistItems).where(eq(watchlistItems.id, items[0].id));
      console.log(`[Watchlist] Removed "${items[0].name}" (${items[0].ticker}) from watchlist after successful buy import`);
      return { removed: true, name: items[0].name };
    }
  }

  return { removed: false };
}

// Dividends functions
export async function getDividends(userId: number, year?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(dividends).where(eq(dividends.userId, userId));
  
  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    query = db.select().from(dividends).where(
      and(
        eq(dividends.userId, userId),
        gte(dividends.paymentDate, startDate),
        lte(dividends.paymentDate, endDate)
      )
    );
  }
  
  const result = await query;
  return result.map(d => ({
    ...d,
    amount: Number(d.amount),
    taxAmount: d.taxAmount ? Number(d.taxAmount) : 0,
  }));
}

export async function createDividend(userId: number, data: { ticker: string; name: string; amount: number; taxAmount?: number; paymentDate: string; positionId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(dividends).values({
    userId,
    ticker: data.ticker,
    name: data.name,
    amount: String(data.amount),
    taxAmount: data.taxAmount ? String(data.taxAmount) : "0",
    paymentDate: new Date(data.paymentDate),
    positionId: data.positionId,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function deleteDividend(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(dividends)
    .where(and(eq(dividends.id, id), eq(dividends.userId, userId)));
  
  return { success: true };
}

// Notes functions
export async function getNotes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(notes).where(eq(notes.userId, userId));
}

export async function createNote(userId: number, data: { title: string; content?: string; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(notes).values({
    userId,
    title: data.title,
    content: data.content,
    category: data.category,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function updateNote(userId: number, id: number, data: { title?: string; content?: string; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  
  await db.update(notes)
    .set(updateData)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  
  return { success: true };
}

export async function deleteNote(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  
  return { success: true };
}

// Savings Plans functions
export async function getSavingsPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(savingsPlans).where(eq(savingsPlans.userId, userId));
  return result.map(s => ({
    ...s,
    monthlyAmount: Number(s.monthlyAmount),
  }));
}

export async function createSavingsPlan(userId: number, data: { ticker: string; name: string; monthlyAmount: number; executionDay?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(savingsPlans).values({
    userId,
    ticker: data.ticker,
    name: data.name,
    monthlyAmount: String(data.monthlyAmount),
    executionDay: data.executionDay || 1,
    isActive: data.isActive ?? true,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function updateSavingsPlan(userId: number, id: number, data: { ticker?: string; name?: string; monthlyAmount?: number; executionDay?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = {};
  if (data.ticker !== undefined) updateData.ticker = data.ticker;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.monthlyAmount !== undefined) updateData.monthlyAmount = String(data.monthlyAmount);
  if (data.executionDay !== undefined) updateData.executionDay = data.executionDay;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  await db.update(savingsPlans)
    .set(updateData)
    .where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)));
  
  return { success: true };
}

export async function deleteSavingsPlan(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(savingsPlans)
    .where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)));
  
  return { success: true };
}

// Price Cache functions
export async function getPriceCacheForTickers(tickers: string[]) {
  const db = await getDb();
  if (!db) return [];
  
  if (tickers.length === 0) return [];
  
  const result = await db.select().from(priceCache).where(inArray(priceCache.ticker, tickers));
  return result.map(p => ({
    ...p,
    price: Number(p.price),
    changePercent: p.changePercent ? Number(p.changePercent) : null,
  }));
}

export async function updatePriceCache(ticker: string, price: number, changePercent?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(priceCache).values({
    ticker,
    price: String(price),
    changePercent: changePercent ? String(changePercent) : null,
  }).onDuplicateKeyUpdate({
    set: {
      price: String(price),
      changePercent: changePercent ? String(changePercent) : null,
    },
  });
  
  return { success: true };
}

// Import/Export functions
export async function importPortfolioData(userId: number, portfolio: any[], watchlist: any[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Clear existing data
  await db.delete(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  await db.delete(watchlistItems).where(eq(watchlistItems.userId, userId));
  
  // Import portfolio
  for (const item of portfolio) {
    await db.insert(portfolioPositions).values({
      userId,
      wkn: item.wkn || null,
      ticker: item.ticker,
      name: item.name,
      type: item.type || "Aktie",
      category: item.category || null,
      amount: String(item.amount),
      buyPrice: String(item.buyPrice),
      // Support both legacy (item.value/item.amount) and version 2.0 (item.currentPrice) formats
      currentPrice: item.currentPrice !== undefined && item.currentPrice !== null
        ? String(item.currentPrice)
        : item.value ? String(item.value / item.amount) : null,
      status: item.status || "Halten",
      autoUpdate: item.autoUpdate ?? true,
      notes: item.notes || null,
    });
  }
  
  // Import watchlist
  for (const item of watchlist) {
    await db.insert(watchlistItems).values({
      userId,
      ticker: item.ticker,
      wkn: item.wkn || null,
      name: item.name || item.ticker,
      // Support both legacy (item.price) and version 2.0 (item.currentPrice) formats
      currentPrice: item.currentPrice !== undefined && item.currentPrice !== null
        ? String(item.currentPrice)
        : item.price ? String(item.price) : null,
      targetPrice: item.targetPrice ? String(item.targetPrice) : null,
      notes: item.notes || null,
    });
  }
  
  return { 
    success: true, 
    imported: { 
      portfolio: portfolio.length, 
      watchlist: watchlist.length 
    } 
  };
}

export async function exportPortfolioData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const portfolioData = await getPortfolioPositions(userId);
  const watchlistData = await getWatchlistItems(userId);
  const dividendsData = await getDividends(userId);
  const notesData = await getNotes(userId);
  const savingsPlansData = await getSavingsPlans(userId);
  const transactionsData = await getTransactions(userId);
  const settingsData = await getUserSettings(userId);

  return {
    timestamp: new Date().toISOString(),
    version: "2.0",
    portfolio: portfolioData.map(p => ({
      wkn: p.wkn,
      ticker: p.ticker,
      name: p.name,
      type: p.type,
      category: p.category,
      amount: p.amount,
      buyPrice: p.buyPrice,
      currentPrice: p.currentPrice,
      value: p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice,
      status: p.status,
      autoUpdate: p.autoUpdate,
    })),
    watchlist: watchlistData.map(w => ({
      ticker: w.ticker,
      name: w.name,
      price: w.currentPrice,
      targetPrice: w.targetPrice,
      notes: w.notes,
    })),
    dividends: dividendsData,
    notes: notesData,
    savingsPlans: savingsPlansData,
    transactions: transactionsData,
    settings: settingsData,
  };
}

// AI Analysis functions
export async function saveAiAnalysis(userId: number, type: "portfolio" | "position" | "market" | "recommendation", analysis: string, targetTicker?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(aiAnalyses).values({
    userId,
    type,
    targetTicker,
    analysis,
  });
  
  return { id: Number(result[0].insertId) };
}

// User Settings functions
export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return null;
  
  return {
    ...result[0],
    monthlyBudget: Number(result[0].monthlyBudget),
    targetAllocations: result[0].targetAllocations as any[] || null,
  };
}

export async function saveUserSettings(userId: number, data: { monthlyBudget?: number; targetAllocations?: any[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserSettings(userId);
  
  if (existing) {
    const updateData: Record<string, unknown> = {};
    if (data.monthlyBudget !== undefined) updateData.monthlyBudget = String(data.monthlyBudget);
    if (data.targetAllocations !== undefined) updateData.targetAllocations = data.targetAllocations;
    
    await db.update(userSettings)
      .set(updateData)
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      monthlyBudget: data.monthlyBudget ? String(data.monthlyBudget) : "500",
      targetAllocations: data.targetAllocations || null,
    });
  }
  
  return { success: true };
}


// PIN-Sperre Funktionen
import * as crypto from 'crypto';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export async function setUserPin(userId: number, pin: string, enabled: boolean, autoLockMinutes?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const pinHash = hashPin(pin);
  const existing = await getUserSettings(userId);
  
  if (existing) {
    await db.update(userSettings)
      .set({
        pinEnabled: enabled,
        pinHash: pinHash,
        autoLockMinutes: autoLockMinutes || 5,
      })
      .where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      pinEnabled: enabled,
      pinHash: pinHash,
      autoLockMinutes: autoLockMinutes || 5,
    });
  }
  
  return { success: true };
}

export async function verifyUserPin(userId: number, pin: string): Promise<{ valid: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return { valid: false };
  
  const settings = result[0];
  if (!settings.pinEnabled || !settings.pinHash) return { valid: false };
  
  const pinHash = hashPin(pin);
  return { valid: pinHash === settings.pinHash };
}

export async function removeUserPin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userSettings)
    .set({
      pinEnabled: false,
      pinHash: null,
    })
    .where(eq(userSettings.userId, userId));
  
  return { success: true };
}

export async function getUserPinStatus(userId: number): Promise<{ enabled: boolean; autoLockMinutes: number }> {
  const db = await getDb();
  if (!db) return { enabled: false, autoLockMinutes: 5 };
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return { enabled: false, autoLockMinutes: 5 };
  
  return {
    enabled: result[0].pinEnabled || false,
    autoLockMinutes: result[0].autoLockMinutes || 5,
  };
}

// Transaction functions for DKB PDF import
export async function createTransaction(
  userId: number, 
  data: Omit<InsertTransaction, 'userId' | 'quantity' | 'price' | 'fees' | 'totalAmount'> & {
    quantity: number;
    price: number;
    fees: number;
    totalAmount: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    // Check for duplicate by invoiceNumber per user (unique per DKB PDF)
    const orderNumberString = String(data.orderNumber);
    if (data.invoiceNumber) {
      const existing = await db.select().from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.invoiceNumber, data.invoiceNumber)
        ))
        .limit(1);

      if (existing.length > 0) {
        return {
          duplicate: true,
          id: existing[0].id,
          orderNumber: data.orderNumber
        };
      }
    }
    
    // Insert new transaction
    const result = await db.insert(transactions).values({
      userId,
      date: data.date,
      type: data.type,
      isin: data.isin,
      wkn: data.wkn,
      name: data.name,
      quantity: String(data.quantity),
      price: String(data.price),
      fees: String(data.fees),
      totalAmount: String(data.totalAmount),
      orderNumber: orderNumberString,
      invoiceNumber: data.invoiceNumber,
    });
    
    return { 
      duplicate: false, 
      id: Number(result[0].insertId),
      orderNumber: data.orderNumber
    };
  } catch (error) {
    // Catch any database errors (including unique constraint violations)
    console.error('Database error in createTransaction:', error);
    
    // Check if it's a unique constraint violation on invoiceNumber
    if (error instanceof Error && (error.message.includes('invoiceNumber') || error.message.includes('Duplicate'))) {
      return {
        duplicate: true,
        id: null,
        orderNumber: data.orderNumber
      };
    }
    
    // Re-throw other errors
    throw error;
  }
}

export async function getTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date));
  
  return result.map(t => ({
    ...t,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fees: Number(t.fees),
    totalAmount: Number(t.totalAmount),
  }));
}

export async function getTransactionsByISIN(userId: number, isin: string) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.isin, isin)))
    .orderBy(desc(transactions.date));
  
  return result.map(t => ({
    ...t,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fees: Number(t.fees),
    totalAmount: Number(t.totalAmount),
  }));
}

/**
 * Update portfolio position based on transaction
 * Calculates total quantity, invested capital, and average price
 */
export async function updatePortfolioFromTransaction(
  userId: number,
  isin: string,
  wkn: string | undefined,
  name: string,
  transactionType: 'Kauf' | 'Verkauf' | 'Sparplan',
  quantity: number,
  totalAmount: number,
  category?: string | null,
  currency?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Determine if this is a USD-denominated position and convert to EUR if needed
  let totalAmountEur = totalAmount;
  const isUsd = currency === 'USD' || (!currency && wkn && USD_DENOMINATED_WKNS.has(wkn));

  if (isUsd) {
    const eurUsdRate = await getEurUsdRate();
    totalAmountEur = totalAmount / eurUsdRate;
    console.log(
      `[Portfolio] USD→EUR Umrechnung für ${name} (WKN: ${wkn}): ` +
      `${totalAmount.toFixed(2)} USD / ${eurUsdRate.toFixed(4)} = ${totalAmountEur.toFixed(2)} EUR`
    );
  }

  // Find existing position by ISIN or WKN
  let existingPosition = null;
  if (isin) {
    // We need to search by ISIN - but we don't have ISIN in portfolioPositions
    // Let's search by WKN if available
    if (wkn) {
      const positions = await db.select().from(portfolioPositions)
        .where(and(eq(portfolioPositions.userId, userId), eq(portfolioPositions.wkn, wkn)))
        .limit(1);
      if (positions.length > 0) {
        existingPosition = positions[0];
      }
    }
  }

  if (existingPosition) {
    // Update existing position
    const oldQuantity = Number(existingPosition.amount);
    const oldBuyPrice = Number(existingPosition.buyPrice);
    const oldInvestedCapital = oldQuantity * oldBuyPrice;

    let newQuantity: number;
    let newInvestedCapital: number;

    if (transactionType === 'Verkauf') {
      // Selling - reduce quantity and invested capital proportionally
      newQuantity = oldQuantity - quantity;
      if (newQuantity < 0) newQuantity = 0;
      newInvestedCapital = newQuantity > 0 ? oldInvestedCapital * (newQuantity / oldQuantity) : 0;
    } else {
      // Buying - add quantity and invested capital (always in EUR)
      newQuantity = oldQuantity + quantity;
      newInvestedCapital = oldInvestedCapital + totalAmountEur;
    }

    const newAvgPrice = newQuantity > 0 ? newInvestedCapital / newQuantity : 0;

    const updateFields: Record<string, unknown> = {
      amount: String(newQuantity),
      buyPrice: String(newAvgPrice),
    };
    if (category && !existingPosition.category) {
      updateFields.category = category;
    }
    await db.update(portfolioPositions)
      .set(updateFields)
      .where(eq(portfolioPositions.id, existingPosition.id));

    return { updated: true, positionId: existingPosition.id };
  } else {
    // Create new position
    const result = await db.insert(portfolioPositions).values({
      userId,
      wkn: wkn || null,
      ticker: isin, // Use ISIN as ticker for now
      name,
      type: 'ETF', // Default to ETF, can be changed by user
      category: category || null,
      amount: String(quantity),
      buyPrice: String(totalAmountEur / quantity),
      currentPrice: null,
      status: 'Halten',
      autoUpdate: true,
      notes: `Importiert aus DKB-Abrechnung am ${new Date().toLocaleDateString('de-DE')}`,
    });

    return { updated: false, positionId: Number(result[0].insertId) };
  }
}

// ============================================
// TAX MANAGEMENT FUNCTIONS
// ============================================

/**
 * Get all tax sources for a user
 */
export async function getTaxSources(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const { taxSources } = await import('../drizzle/schema');

  const result = await db.select().from(taxSources)
    .where(eq(taxSources.userId, userId));

  return result.map(source => ({
    ...source,
    exemptionOrder: parseFloat(source.exemptionOrder),
  }));
}

/**
 * Create a tax source
 */
export async function createTaxSource(userId: number, data: { name: string; exemptionOrder: number; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxSources } = await import('../drizzle/schema');

  const result = await db.insert(taxSources).values({
    userId,
    name: data.name,
    exemptionOrder: String(data.exemptionOrder),
    notes: data.notes,
  });

  return { id: Number(result[0].insertId) };
}

/**
 * Update a tax source
 */
export async function updateTaxSource(userId: number, id: number, data: Partial<{ name: string; exemptionOrder: number; notes: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxSources } = await import('../drizzle/schema');

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.exemptionOrder !== undefined) updateData.exemptionOrder = String(data.exemptionOrder);
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(taxSources)
    .set(updateData)
    .where(and(eq(taxSources.id, id), eq(taxSources.userId, userId)));

  return { success: true };
}

/**
 * Delete a tax source
 */
export async function deleteTaxSource(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxSources } = await import('../drizzle/schema');

  await db.delete(taxSources)
    .where(and(eq(taxSources.id, id), eq(taxSources.userId, userId)));

  return { success: true };
}

/**
 * Get tax settings for a user
 */
export async function getTaxSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const { taxSettings } = await import('../drizzle/schema');

  const result = await db.select().from(taxSettings)
    .where(eq(taxSettings.userId, userId));

  if (result.length === 0) {
    return {
      userId,
      stockLossPot: 0,
      otherLossPot: 0,
      maxExemptionOrder: 1000,
    };
  }

  return {
    ...result[0],
    stockLossPot: parseFloat(result[0].stockLossPot),
    otherLossPot: parseFloat(result[0].otherLossPot),
    maxExemptionOrder: parseFloat(result[0].maxExemptionOrder),
  };
}

/**
 * Update or create tax settings
 */
export async function saveTaxSettings(userId: number, data: { stockLossPot?: number; otherLossPot?: number; maxExemptionOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxSettings } = await import('../drizzle/schema');

  const existing = await getTaxSettings(userId);

  const updateData: Record<string, unknown> = {};
  if (data.stockLossPot !== undefined) updateData.stockLossPot = String(data.stockLossPot);
  if (data.otherLossPot !== undefined) updateData.otherLossPot = String(data.otherLossPot);
  if (data.maxExemptionOrder !== undefined) updateData.maxExemptionOrder = String(data.maxExemptionOrder);

  if (existing && 'id' in existing && existing.id) {
    // Update existing
    await db.update(taxSettings)
      .set(updateData)
      .where(eq(taxSettings.userId, userId));
  } else {
    // Create new
    await db.insert(taxSettings).values({
      userId,
      stockLossPot: String(data.stockLossPot || 0),
      otherLossPot: String(data.otherLossPot || 0),
      maxExemptionOrder: String(data.maxExemptionOrder || 1000),
    });
  }

  return { success: true };
}

/**
 * Calculate total exemption orders across all sources
 */
export async function getTotalExemptionOrders(userId: number): Promise<number> {
  const sources = await getTaxSources(userId);
  return sources.reduce((sum, source) => sum + source.exemptionOrder, 0);
}

/**
 * Tax Allowances (Freibeträge) Functions
 */

export async function getAllowances(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const { taxAllowances } = await import('../drizzle/schema');

  const result = await db.select().from(taxAllowances)
    .where(eq(taxAllowances.userId, userId))
    .orderBy(desc(taxAllowances.year));

  return result.map(row => ({
    ...row,
    amount: parseFloat(row.amount),
    used: parseFloat(row.used),
  }));
}

export async function createAllowance(userId: number, data: {
  year: number;
  amount: number;
  used: number;
  broker?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxAllowances } = await import('../drizzle/schema');

  const result = await db.insert(taxAllowances).values({
    userId,
    year: data.year,
    amount: String(data.amount),
    used: String(data.used),
    broker: data.broker,
    notes: data.notes,
  });

  return { success: true, id: result[0].insertId };
}

export async function updateAllowance(userId: number, id: number, data: {
  year?: number;
  amount?: number;
  used?: number;
  broker?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxAllowances } = await import('../drizzle/schema');

  const updateData: Record<string, unknown> = {};
  if (data.year !== undefined) updateData.year = data.year;
  if (data.amount !== undefined) updateData.amount = String(data.amount);
  if (data.used !== undefined) updateData.used = String(data.used);
  if (data.broker !== undefined) updateData.broker = data.broker;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(taxAllowances)
    .set(updateData)
    .where(and(eq(taxAllowances.id, id), eq(taxAllowances.userId, userId)));

  return { success: true };
}

export async function deleteAllowance(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { taxAllowances } = await import('../drizzle/schema');

  await db.delete(taxAllowances)
    .where(and(eq(taxAllowances.id, id), eq(taxAllowances.userId, userId)));

  return { success: true };
}

/**
 * Loss Carryforwards (Verlustvorträge) Functions
 */

export async function getLossCarryforwards(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const { lossCarryforwards } = await import('../drizzle/schema');

  const result = await db.select().from(lossCarryforwards)
    .where(eq(lossCarryforwards.userId, userId))
    .orderBy(desc(lossCarryforwards.year));

  return result.map(row => ({
    ...row,
    amount: parseFloat(row.amount),
  }));
}

export async function createLossCarryforward(userId: number, data: {
  year: number;
  category: "general" | "stocks" | "other";
  amount: number;
  broker?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { lossCarryforwards } = await import('../drizzle/schema');

  const result = await db.insert(lossCarryforwards).values({
    userId,
    year: data.year,
    category: data.category,
    amount: String(data.amount),
    broker: data.broker,
    notes: data.notes,
  });

  return { success: true, id: result[0].insertId };
}

export async function updateLossCarryforward(userId: number, id: number, data: {
  year?: number;
  category?: "general" | "stocks" | "other";
  amount?: number;
  broker?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { lossCarryforwards } = await import('../drizzle/schema');

  const updateData: Record<string, unknown> = {};
  if (data.year !== undefined) updateData.year = data.year;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.amount !== undefined) updateData.amount = String(data.amount);
  if (data.broker !== undefined) updateData.broker = data.broker;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(lossCarryforwards)
    .set(updateData)
    .where(and(eq(lossCarryforwards.id, id), eq(lossCarryforwards.userId, userId)));

  return { success: true };
}

export async function deleteLossCarryforward(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { lossCarryforwards } = await import('../drizzle/schema');

  await db.delete(lossCarryforwards)
    .where(and(eq(lossCarryforwards.id, id), eq(lossCarryforwards.userId, userId)));

  return { success: true };
}
