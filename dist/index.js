var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";
var users, portfolioPositions, watchlistItems, dividends, savingsPlans, notes, priceCache, aiAnalyses, userSettings;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      pin: varchar("pin", { length: 8 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    portfolioPositions = mysqlTable("portfolio_positions", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      wkn: varchar("wkn", { length: 20 }),
      ticker: varchar("ticker", { length: 20 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      type: mysqlEnum("type", ["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]).notNull(),
      category: varchar("category", { length: 50 }),
      amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
      buyPrice: decimal("buyPrice", { precision: 18, scale: 4 }).notNull(),
      currentPrice: decimal("currentPrice", { precision: 18, scale: 4 }),
      status: mysqlEnum("status", ["Kaufen", "Halten", "Verkaufen"]).default("Halten"),
      autoUpdate: boolean("autoUpdate").default(true),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    watchlistItems = mysqlTable("watchlist_items", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      ticker: varchar("ticker", { length: 20 }).notNull(),
      wkn: varchar("wkn", { length: 20 }),
      name: varchar("name", { length: 255 }).notNull(),
      currentPrice: decimal("currentPrice", { precision: 18, scale: 4 }),
      targetPrice: decimal("targetPrice", { precision: 18, scale: 4 }),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    dividends = mysqlTable("dividends", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      positionId: int("positionId"),
      ticker: varchar("ticker", { length: 20 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
      taxAmount: decimal("taxAmount", { precision: 18, scale: 4 }).default("0"),
      paymentDate: timestamp("paymentDate").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    savingsPlans = mysqlTable("savings_plans", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      ticker: varchar("ticker", { length: 20 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      monthlyAmount: decimal("monthlyAmount", { precision: 18, scale: 2 }).notNull(),
      executionDay: int("executionDay").default(1),
      isActive: boolean("isActive").default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    notes = mysqlTable("notes", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      title: varchar("title", { length: 255 }).notNull(),
      content: text("content"),
      category: varchar("category", { length: 50 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    priceCache = mysqlTable("price_cache", {
      id: int("id").autoincrement().primaryKey(),
      ticker: varchar("ticker", { length: 20 }).notNull().unique(),
      price: decimal("price", { precision: 18, scale: 4 }).notNull(),
      changePercent: decimal("changePercent", { precision: 10, scale: 4 }),
      currency: varchar("currency", { length: 10 }).default("EUR"),
      lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull()
    });
    aiAnalyses = mysqlTable("ai_analyses", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      type: mysqlEnum("type", ["portfolio", "position", "market", "recommendation"]).notNull(),
      targetTicker: varchar("targetTicker", { length: 20 }),
      analysis: text("analysis").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    userSettings = mysqlTable("user_settings", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().unique(),
      monthlyBudget: decimal("monthlyBudget", { precision: 18, scale: 2 }).default("500"),
      targetAllocations: json("targetAllocations"),
      // PIN-Sperre Einstellungen
      pinEnabled: boolean("pinEnabled").default(false),
      pinHash: varchar("pinHash", { length: 128 }),
      autoLockMinutes: int("autoLockMinutes").default(5),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createDividend: () => createDividend,
  createNote: () => createNote,
  createPortfolioPosition: () => createPortfolioPosition,
  createSavingsPlan: () => createSavingsPlan,
  createWatchlistItem: () => createWatchlistItem,
  deleteDividend: () => deleteDividend,
  deleteNote: () => deleteNote,
  deletePortfolioPosition: () => deletePortfolioPosition,
  deleteSavingsPlan: () => deleteSavingsPlan,
  deleteWatchlistItem: () => deleteWatchlistItem,
  exportPortfolioData: () => exportPortfolioData,
  getDb: () => getDb,
  getDividends: () => getDividends,
  getNotes: () => getNotes,
  getPortfolioPositions: () => getPortfolioPositions,
  getPriceCacheForTickers: () => getPriceCacheForTickers,
  getSavingsPlans: () => getSavingsPlans,
  getUserByOpenId: () => getUserByOpenId,
  getUserPinStatus: () => getUserPinStatus,
  getUserSettings: () => getUserSettings,
  getWatchlistItems: () => getWatchlistItems,
  importPortfolioData: () => importPortfolioData,
  removeUserPin: () => removeUserPin,
  saveAiAnalysis: () => saveAiAnalysis,
  saveUserSettings: () => saveUserSettings,
  setUserPin: () => setUserPin,
  updateNote: () => updateNote,
  updatePortfolioPosition: () => updatePortfolioPosition,
  updatePriceCache: () => updatePriceCache,
  updateSavingsPlan: () => updateSavingsPlan,
  updateWatchlistItem: () => updateWatchlistItem,
  upsertUser: () => upsertUser,
  verifyUserPin: () => verifyUserPin
});
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as crypto from "crypto";
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getPortfolioPositions(userId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  return result.map((p) => ({
    ...p,
    amount: Number(p.amount),
    buyPrice: Number(p.buyPrice),
    currentPrice: p.currentPrice ? Number(p.currentPrice) : null
  }));
}
async function createPortfolioPosition(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portfolioPositions).values({
    ...data,
    userId,
    amount: String(data.amount),
    buyPrice: String(data.buyPrice),
    currentPrice: data.currentPrice ? String(data.currentPrice) : null
  });
  return { id: Number(result[0].insertId) };
}
async function updatePortfolioPosition(userId, id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData = {};
  if (data.wkn !== void 0) updateData.wkn = data.wkn;
  if (data.ticker !== void 0) updateData.ticker = data.ticker;
  if (data.name !== void 0) updateData.name = data.name;
  if (data.type !== void 0) updateData.type = data.type;
  if (data.category !== void 0) updateData.category = data.category;
  if (data.amount !== void 0) updateData.amount = String(data.amount);
  if (data.buyPrice !== void 0) updateData.buyPrice = String(data.buyPrice);
  if (data.currentPrice !== void 0) updateData.currentPrice = String(data.currentPrice);
  if (data.status !== void 0) updateData.status = data.status;
  if (data.notes !== void 0) updateData.notes = data.notes;
  if (data.autoUpdate !== void 0) updateData.autoUpdate = data.autoUpdate;
  await db.update(portfolioPositions).set(updateData).where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  return { success: true };
}
async function deletePortfolioPosition(userId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portfolioPositions).where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  return { success: true };
}
async function getWatchlistItems(userId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(watchlistItems).where(eq(watchlistItems.userId, userId));
  return result.map((w) => ({
    ...w,
    currentPrice: w.currentPrice ? Number(w.currentPrice) : null,
    targetPrice: w.targetPrice ? Number(w.targetPrice) : null
  }));
}
async function createWatchlistItem(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(watchlistItems).values({
    ...data,
    userId,
    currentPrice: data.currentPrice ? String(data.currentPrice) : null,
    targetPrice: data.targetPrice ? String(data.targetPrice) : null
  });
  return { id: Number(result[0].insertId) };
}
async function updateWatchlistItem(userId, id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData = {};
  if (data.ticker !== void 0) updateData.ticker = data.ticker;
  if (data.name !== void 0) updateData.name = data.name;
  if (data.currentPrice !== void 0) updateData.currentPrice = String(data.currentPrice);
  if (data.targetPrice !== void 0) updateData.targetPrice = String(data.targetPrice);
  if (data.notes !== void 0) updateData.notes = data.notes;
  await db.update(watchlistItems).set(updateData).where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)));
  return { success: true };
}
async function deleteWatchlistItem(userId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(watchlistItems).where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, userId)));
  return { success: true };
}
async function getDividends(userId, year) {
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
  return result.map((d) => ({
    ...d,
    amount: Number(d.amount),
    taxAmount: d.taxAmount ? Number(d.taxAmount) : 0
  }));
}
async function createDividend(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(dividends).values({
    userId,
    ticker: data.ticker,
    name: data.name,
    amount: String(data.amount),
    taxAmount: data.taxAmount ? String(data.taxAmount) : "0",
    paymentDate: new Date(data.paymentDate),
    positionId: data.positionId
  });
  return { id: Number(result[0].insertId) };
}
async function deleteDividend(userId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(dividends).where(and(eq(dividends.id, id), eq(dividends.userId, userId)));
  return { success: true };
}
async function getNotes(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notes).where(eq(notes.userId, userId));
}
async function createNote(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notes).values({
    userId,
    title: data.title,
    content: data.content,
    category: data.category
  });
  return { id: Number(result[0].insertId) };
}
async function updateNote(userId, id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData = {};
  if (data.title !== void 0) updateData.title = data.title;
  if (data.content !== void 0) updateData.content = data.content;
  if (data.category !== void 0) updateData.category = data.category;
  await db.update(notes).set(updateData).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return { success: true };
}
async function deleteNote(userId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
  return { success: true };
}
async function getSavingsPlans(userId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(savingsPlans).where(eq(savingsPlans.userId, userId));
  return result.map((s) => ({
    ...s,
    monthlyAmount: Number(s.monthlyAmount)
  }));
}
async function createSavingsPlan(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(savingsPlans).values({
    userId,
    ticker: data.ticker,
    name: data.name,
    monthlyAmount: String(data.monthlyAmount),
    executionDay: data.executionDay || 1,
    isActive: data.isActive ?? true
  });
  return { id: Number(result[0].insertId) };
}
async function updateSavingsPlan(userId, id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData = {};
  if (data.ticker !== void 0) updateData.ticker = data.ticker;
  if (data.name !== void 0) updateData.name = data.name;
  if (data.monthlyAmount !== void 0) updateData.monthlyAmount = String(data.monthlyAmount);
  if (data.executionDay !== void 0) updateData.executionDay = data.executionDay;
  if (data.isActive !== void 0) updateData.isActive = data.isActive;
  await db.update(savingsPlans).set(updateData).where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)));
  return { success: true };
}
async function deleteSavingsPlan(userId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(savingsPlans).where(and(eq(savingsPlans.id, id), eq(savingsPlans.userId, userId)));
  return { success: true };
}
async function getPriceCacheForTickers(tickers) {
  const db = await getDb();
  if (!db) return [];
  if (tickers.length === 0) return [];
  const result = await db.select().from(priceCache).where(inArray(priceCache.ticker, tickers));
  return result.map((p) => ({
    ...p,
    price: Number(p.price),
    changePercent: p.changePercent ? Number(p.changePercent) : null
  }));
}
async function updatePriceCache(ticker, price, changePercent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(priceCache).values({
    ticker,
    price: String(price),
    changePercent: changePercent ? String(changePercent) : null
  }).onDuplicateKeyUpdate({
    set: {
      price: String(price),
      changePercent: changePercent ? String(changePercent) : null
    }
  });
  return { success: true };
}
async function importPortfolioData(userId, portfolio, watchlist) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portfolioPositions).where(eq(portfolioPositions.userId, userId));
  await db.delete(watchlistItems).where(eq(watchlistItems.userId, userId));
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
      currentPrice: item.value ? String(item.value / item.amount) : null,
      status: item.status || "Halten",
      autoUpdate: item.autoUpdate ?? true,
      notes: null
    });
  }
  for (const item of watchlist) {
    await db.insert(watchlistItems).values({
      userId,
      ticker: item.ticker,
      name: item.name || item.ticker,
      currentPrice: item.price ? String(item.price) : null,
      targetPrice: item.targetPrice ? String(item.targetPrice) : null,
      notes: item.notes || null
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
async function exportPortfolioData(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const portfolioData = await getPortfolioPositions(userId);
  const watchlistData = await getWatchlistItems(userId);
  const dividendsData = await getDividends(userId);
  const notesData = await getNotes(userId);
  const savingsPlansData = await getSavingsPlans(userId);
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    portfolio: portfolioData.map((p) => ({
      wkn: p.wkn,
      ticker: p.ticker,
      name: p.name,
      type: p.type,
      category: p.category,
      amount: p.amount,
      buyPrice: p.buyPrice,
      value: p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice,
      status: p.status,
      autoUpdate: p.autoUpdate
    })),
    watchlist: watchlistData.map((w) => ({
      ticker: w.ticker,
      name: w.name,
      price: w.currentPrice,
      targetPrice: w.targetPrice,
      notes: w.notes
    })),
    dividends: dividendsData,
    notes: notesData,
    savingsPlans: savingsPlansData
  };
}
async function saveAiAnalysis(userId, type, analysis, targetTicker) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiAnalyses).values({
    userId,
    type,
    targetTicker,
    analysis
  });
  return { id: Number(result[0].insertId) };
}
async function getUserSettings(userId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return null;
  return {
    ...result[0],
    monthlyBudget: Number(result[0].monthlyBudget),
    targetAllocations: result[0].targetAllocations || null
  };
}
async function saveUserSettings(userId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserSettings(userId);
  if (existing) {
    const updateData = {};
    if (data.monthlyBudget !== void 0) updateData.monthlyBudget = String(data.monthlyBudget);
    if (data.targetAllocations !== void 0) updateData.targetAllocations = data.targetAllocations;
    await db.update(userSettings).set(updateData).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      monthlyBudget: data.monthlyBudget ? String(data.monthlyBudget) : "500",
      targetAllocations: data.targetAllocations || null
    });
  }
  return { success: true };
}
function hashPin(pin) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}
async function setUserPin(userId, pin, enabled, autoLockMinutes) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const pinHash = hashPin(pin);
  const existing = await getUserSettings(userId);
  if (existing) {
    await db.update(userSettings).set({
      pinEnabled: enabled,
      pinHash,
      autoLockMinutes: autoLockMinutes || 5
    }).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({
      userId,
      pinEnabled: enabled,
      pinHash,
      autoLockMinutes: autoLockMinutes || 5
    });
  }
  return { success: true };
}
async function verifyUserPin(userId, pin) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return { valid: false };
  const settings = result[0];
  if (!settings.pinEnabled || !settings.pinHash) return { valid: false };
  const pinHash = hashPin(pin);
  return { valid: pinHash === settings.pinHash };
}
async function removeUserPin(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userSettings).set({
    pinEnabled: false,
    pinHash: null
  }).where(eq(userSettings.userId, userId));
  return { success: true };
}
async function getUserPinStatus(userId) {
  const db = await getDb();
  if (!db) return { enabled: false, autoLockMinutes: 5 };
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (result.length === 0) return { enabled: false, autoLockMinutes: 5 };
  return {
    enabled: result[0].pinEnabled || false,
    autoLockMinutes: result[0].autoLockMinutes || 5
  };
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();
import { z as z2 } from "zod";

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
var assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/services.ts
init_db();
var eurUsdRate = null;
var eurUsdLastFetch = 0;
var RATE_CACHE_DURATION = 60 * 60 * 1e3;
async function getEurUsdRate(apiKey) {
  const now = Date.now();
  if (eurUsdRate && now - eurUsdLastFetch < RATE_CACHE_DURATION) {
    return eurUsdRate;
  }
  try {
    const response = await fetch(
      `https://api.twelvedata.com/exchange_rate?symbol=EUR/USD&apikey=${apiKey}`
    );
    const data = await response.json();
    if (data.rate) {
      eurUsdRate = parseFloat(data.rate);
      eurUsdLastFetch = now;
      return eurUsdRate;
    }
  } catch (error) {
    console.error("Error fetching EUR/USD rate:", error);
  }
  return eurUsdRate || 1.08;
}
var TICKER_MAPPINGS = {
  // Tech stocks (Frankfurt .F to US)
  "AMZ.F": "AMZN",
  // Amazon
  "ABEA.F": "GOOGL",
  // Alphabet
  "AMD.F": "AMD",
  // AMD
  "NVDA.F": "NVDA",
  // NVIDIA
  "MSFT.F": "MSFT",
  // Microsoft
  "AAPL.F": "AAPL",
  // Apple
  "META.F": "META",
  // Meta
  "TSLA.F": "TSLA",
  // Tesla
  // Biotech stocks (Frankfurt .F to US)
  "0OT.F": "OCUL",
  // Ocular Therapeutix
  "A83.F": "APGE",
  // Apogee Therapeutics
  "7CY.F": "CTMX",
  // CytomX Therapeutics
  "IFX.F": "IFRX",
  // InflaRx N.V.
  "1SP1.F": "SPRO",
  // Spero Therapeutics
  "O8V.F": "OVID",
  // Ovid Therapeutics
  "N9C.F": "NXTC",
  // NextCure
  "49B.F": "MYNZ",
  // Mainz Biomed
  "78A.F": "ATHA",
  // Athira Pharma
  "C1M.F": "CRDF",
  // Cardiff Oncology
  // Other US stocks (Frankfurt .F to US)
  "P2S.F": "PSN",
  // Parsons Corporation
  "MIG.F": "MSTR",
  // MicroStrategy
  // German stocks (Xetra .DE)
  "GBF.DE": "GBF.DE",
  // Bilfinger SE - keep as is, not on US exchange
  // Hong Kong
  "1211.HK": "1211.HK",
  // BYD - keep original format
  // Canadian (TSX Venture)
  "TAU.V": "TAU.V",
  // Thesis Gold - keep original
  // Amsterdam
  "GLPG.AS": "GLPG",
  // Galapagos NV (also on NASDAQ)
  // US stocks (already US symbols)
  "ASMB": "ASMB",
  // Assembly Biosciences
  "ORKA": "ORKA",
  // Oruka Therapeutics
  // Crypto ETPs (Swiss Exchange .SW to crypto pairs)
  "CBTC.SW": "BTC/USD",
  // 21Shares Bitcoin
  "ETHC.SW": "ETH/USD",
  // 21Shares Ethereum
  "AXRP.SW": "XRP/USD",
  // 21Shares XRP
  "SOLW.SW": "SOL/USD",
  // WisdomTree Solana
  "HBAR-USD": "HBAR/USD",
  // Valour Hedera
  // ETFs (German to US equivalents or keep)
  "XAIX.DE": "BOTZ",
  // AI & Big Data -> Global X Robotics
  "EXXT.DE": "QQQ",
  // Nasdaq 100 ETF
  "NATO.DE": "ITA",
  // Defence ETF -> iShares US Aerospace
  "IS3N.DE": "EEM",
  // EM ETF -> iShares MSCI EM
  "IUSN.DE": "SCHA",
  // World Small Cap -> Schwab US Small Cap
  "EUNL.DE": "VT",
  // MSCI World -> Vanguard Total World
  "IQQH.DE": "ICLN",
  // Clean Energy -> iShares Global Clean Energy
  "NUCL.DE": "URA"
  // Uranium ETF -> Global X Uranium
};
function convertTickerForTwelveData(ticker) {
  const mapped = TICKER_MAPPINGS[ticker];
  if (mapped) {
    if (mapped.includes("/USD")) {
      return { symbol: mapped, isCrypto: true };
    }
    return { symbol: mapped };
  }
  if (ticker.endsWith(".F")) {
    const base = ticker.replace(".F", "");
    return { symbol: base };
  }
  if (ticker.endsWith(".DE")) {
    const base = ticker.replace(".DE", "");
    return { symbol: base };
  }
  if (ticker.endsWith(".HK")) {
    return { symbol: ticker.replace(".HK", ""), exchange: "HKEX" };
  }
  if (ticker.endsWith(".V")) {
    return { symbol: ticker.replace(".V", ""), exchange: "TSXV" };
  }
  return { symbol: ticker };
}
async function fetchLivePricesTwelveData(tickers, apiKey) {
  const results = [];
  if (!apiKey) {
    console.error("Twelve Data API key not provided");
    return results;
  }
  const eurUsdRate2 = await getEurUsdRate(apiKey);
  const batchSize = 7;
  const batchDelayMs = 62e3;
  console.log(`Starting price update for ${tickers.length} tickers in ${Math.ceil(tickers.length / batchSize)} batches`);
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(tickers.length / batchSize);
    console.log(`Processing batch ${batchNumber}/${totalBatches}...`);
    const symbolsForApi = batch.map((t2) => {
      const converted = convertTickerForTwelveData(t2);
      return converted.exchange ? `${converted.symbol}:${converted.exchange}` : converted.symbol;
    });
    try {
      console.log(`Fetching prices for: ${symbolsForApi.join(", ")}`);
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolsForApi.join(",")}&apikey=${apiKey}`
      );
      if (!response.ok) {
        console.warn(`Twelve Data API error: ${response.status}`);
        continue;
      }
      const data = await response.json();
      console.log("Twelve Data response:", JSON.stringify(data).substring(0, 500));
      const quotes = symbolsForApi.length === 1 ? { [symbolsForApi[0]]: data } : data;
      for (let j = 0; j < batch.length; j++) {
        const originalTicker = batch[j];
        const apiSymbol = symbolsForApi[j];
        const quote = quotes[apiSymbol];
        if (quote && !quote.code && quote.close) {
          const price = parseFloat(quote.close);
          const previousClose = parseFloat(quote.previous_close) || price;
          const changePercent = previousClose ? (price - previousClose) / previousClose * 100 : 0;
          const currency = quote.currency || "USD";
          let priceEur = price;
          if (currency === "USD") {
            priceEur = price / eurUsdRate2;
          } else if (currency !== "EUR") {
            priceEur = price;
          }
          results.push({
            ticker: originalTicker,
            price,
            changePercent,
            currency,
            priceEur
          });
          await updatePriceCache(originalTicker, priceEur, changePercent);
        } else if (quote?.code) {
          console.warn(`Twelve Data error for ${originalTicker}: ${quote.message}`);
        }
      }
      if (i + batchSize < tickers.length) {
        console.log(`Waiting 62 seconds for API rate limit reset before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    } catch (error) {
      console.error(`Error fetching prices from Twelve Data:`, error);
    }
  }
  return results;
}
async function fetchLivePrices(tickers) {
  const results = [];
  for (const ticker of tickers) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        }
      );
      if (!response.ok) {
        console.warn(`Failed to fetch price for ${ticker}: ${response.status}`);
        continue;
      }
      const data = await response.json();
      const quote = data.chart?.result?.[0];
      if (quote) {
        const meta = quote.meta;
        const price = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const changePercent = previousClose ? (price - previousClose) / previousClose * 100 : 0;
        const currency = meta.currency || "USD";
        results.push({
          ticker,
          price,
          changePercent,
          currency
        });
        await updatePriceCache(ticker, price, changePercent);
      }
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error);
    }
  }
  return results;
}
async function analyzePortfolio(userId, positions, customQuestion, watchlist) {
  const totalValue = positions.reduce((sum, p) => sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice), 0);
  const totalInvested = positions.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPercent = totalInvested > 0 ? totalGain / totalInvested * 100 : 0;
  const byType = {};
  positions.forEach((p) => {
    const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
    byType[p.type] = (byType[p.type] || 0) + value;
  });
  const withGain = positions.map((p) => ({
    ...p,
    gain: p.currentPrice ? (p.currentPrice - p.buyPrice) / p.buyPrice * 100 : 0
  })).sort((a, b) => b.gain - a.gain);
  const topPerformers = withGain.slice(0, 5);
  const worstPerformers = withGain.slice(-5).reverse();
  const portfolioSummary = `
Portfolio-\xDCbersicht:
- Gesamtwert: ${totalValue.toFixed(2)} \u20AC
- Investiert: ${totalInvested.toFixed(2)} \u20AC
- Gewinn/Verlust: ${totalGain.toFixed(2)} \u20AC (${totalGainPercent.toFixed(2)}%)
- Anzahl Positionen: ${positions.length}

Allokation nach Typ:
${Object.entries(byType).map(([type, value]) => `- ${type}: ${value.toFixed(2)} \u20AC (${(value / totalValue * 100).toFixed(1)}%)`).join("\n")}

Top 5 Performer:
${topPerformers.map((p) => `- ${p.name}: ${p.gain.toFixed(2)}%`).join("\n")}

Schlechteste 5 Performer:
${worstPerformers.map((p) => `- ${p.name}: ${p.gain.toFixed(2)}%`).join("\n")}

${watchlist && watchlist.length > 0 ? `
Watchlist (${watchlist.length} Positionen):
${watchlist.map((w) => `- ${w.name} (${w.ticker}): Zielpreis ${w.targetPrice || "nicht gesetzt"} \u20AC`).join("\n")}
` : ""}
`;
  const systemPrompt = `Du bist ein erfahrener Finanzberater und Portfolio-Analyst. 
Du analysierst Portfolios und gibst fundierte, aber verst\xE4ndliche Empfehlungen auf Deutsch.
Sei konkret und gib praktische Handlungsempfehlungen.
Beachte Diversifikation, Risiko und langfristige Anlagestrategien.

Wenn der Nutzer ETFs aus der Watchlist erw\xE4hnt, bewerte jeden einzeln:
- Analysiere ob der ETF zur bestehenden Strategie passt
- Pr\xFCfe Diversifikationseffekte und Risiko
- Gib eine klare Empfehlung: EMPFOHLEN oder NICHT EMPFOHLEN mit Begr\xFCndung
- Falls empfohlen: Schlage einen konkreten monatlichen Sparbetrag vor
- Erstelle am Ende eine neue Gesamt-Sparplan-Verteilung

Formatiere deine Antwort \xFCbersichtlich mit \xDCberschriften und Tabellen wo sinnvoll.
Antworte immer auf Deutsch.`;
  const userPrompt = customQuestion ? `${portfolioSummary}

Frage des Nutzers: ${customQuestion}` : `${portfolioSummary}

Bitte analysiere dieses Portfolio und gib mir:
1. Eine Einsch\xE4tzung der aktuellen Diversifikation
2. Potenzielle Risiken
3. Konkrete Handlungsempfehlungen
4. Vorschl\xE4ge f\xFCr Rebalancing falls n\xF6tig`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    const content = response.choices[0]?.message?.content;
    const analysis = typeof content === "string" ? content : "Analyse konnte nicht erstellt werden.";
    await saveAiAnalysis(userId, "portfolio", analysis);
    return { analysis, type: "portfolio" };
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    return {
      analysis: "Die KI-Analyse ist derzeit nicht verf\xFCgbar. Bitte versuchen Sie es sp\xE4ter erneut.",
      type: "error"
    };
  }
}
async function generateRecommendation(userId, ticker, name, currentPositions) {
  const existingPosition = currentPositions.find((p) => p.ticker === ticker);
  const totalPortfolioValue = currentPositions.reduce(
    (sum, p) => sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice),
    0
  );
  const positionInfo = existingPosition ? `Du hast bereits ${existingPosition.amount} Anteile von ${name} (${ticker}) im Portfolio mit einem Kaufpreis von ${existingPosition.buyPrice} \u20AC.` : `Du hast ${name} (${ticker}) noch nicht im Portfolio.`;
  const systemPrompt = `Du bist ein erfahrener Aktienanalyst. 
Gib eine fundierte Einsch\xE4tzung zu der angefragten Aktie.
Ber\xFCcksichtige das bestehende Portfolio des Nutzers.
Antworte immer auf Deutsch und sei konkret.`;
  const userPrompt = `
Portfolio-Gesamtwert: ${totalPortfolioValue.toFixed(2)} \u20AC
${positionInfo}

Bitte gib mir eine Einsch\xE4tzung zu ${name} (${ticker}):
1. Kurze Unternehmensanalyse
2. Chancen und Risiken
3. Empfehlung: Kaufen, Halten oder Verkaufen?
4. Falls Kaufen: Welcher Anteil am Portfolio w\xE4re sinnvoll?`;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    const recContent = response.choices[0]?.message?.content;
    const recommendation = typeof recContent === "string" ? recContent : "Empfehlung konnte nicht erstellt werden.";
    let action = "Halten";
    const lowerRec = recommendation.toLowerCase();
    if (lowerRec.includes("kaufen") && !lowerRec.includes("nicht kaufen")) {
      action = "Kaufen";
    } else if (lowerRec.includes("verkaufen")) {
      action = "Verkaufen";
    }
    await saveAiAnalysis(userId, "recommendation", recommendation, ticker);
    return { recommendation, action };
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return {
      recommendation: "Die KI-Empfehlung ist derzeit nicht verf\xFCgbar. Bitte versuchen Sie es sp\xE4ter erneut.",
      action: "Halten"
    };
  }
}
var WKN_DATABASE = {
  // Tech stocks
  "865985": { ticker: "AAPL", name: "Apple Inc.", type: "Aktie" },
  "906866": { ticker: "AMZN", name: "Amazon.com Inc.", type: "Aktie" },
  "A14Y6F": { ticker: "GOOGL", name: "Alphabet Inc.", type: "Aktie" },
  "A14Y6H": { ticker: "GOOG", name: "Alphabet Inc. Class C", type: "Aktie" },
  "870747": { ticker: "MSFT", name: "Microsoft Corporation", type: "Aktie" },
  "A1CX3T": { ticker: "TSLA", name: "Tesla Inc.", type: "Aktie" },
  "918422": { ticker: "NVDA", name: "NVIDIA Corporation", type: "Aktie" },
  "A1JWVX": { ticker: "META", name: "Meta Platforms Inc.", type: "Aktie" },
  "863186": { ticker: "AMD", name: "Advanced Micro Devices Inc.", type: "Aktie" },
  "A2N4PB": { ticker: "NFLX", name: "Netflix Inc.", type: "Aktie" },
  // ETFs - World
  "A0RPWH": { ticker: "EUNL.DE", name: "iShares Core MSCI World UCITS ETF", type: "ETF" },
  "A2PKXG": { ticker: "VWCE.DE", name: "Vanguard FTSE All-World UCITS ETF", type: "ETF" },
  "A1JMDF": { ticker: "IWDA.AS", name: "iShares Core MSCI World UCITS ETF", type: "ETF" },
  "A2DWBY": { ticker: "IUSN.DE", name: "iShares MSCI World Small Cap UCITS ETF", type: "ETF" },
  // ETFs - Emerging Markets
  "A111X9": { ticker: "IS3N.DE", name: "iShares Core MSCI EM IMI UCITS ETF", type: "ETF" },
  "A12GVR": { ticker: "VFEM.DE", name: "Vanguard FTSE Emerging Markets UCITS ETF", type: "ETF" },
  // ETFs - Tech/Nasdaq
  "A0F5UF": { ticker: "EXXT.DE", name: "iShares Nasdaq 100 UCITS ETF", type: "ETF" },
  "A2N6LC": { ticker: "XAIX.DE", name: "Xtrackers AI & Big Data UCITS ETF", type: "ETF" },
  // ETFs - Themen
  "A0MW0M": { ticker: "IQQH.DE", name: "iShares Global Clean Energy UCITS ETF", type: "ETF" },
  "A3D47K": { ticker: "NUCL.DE", name: "VanEck Uranium and Nuclear Technologies UCITS ETF", type: "ETF" },
  "A3EB9T": { ticker: "NATO.DE", name: "HANetf Future of Defence UCITS ETF", type: "ETF" },
  // Gold/Commodities
  "A0S9GB": { ticker: "4GLD.DE", name: "Xetra-Gold", type: "ETF" },
  "A0N62G": { ticker: "EUWAX.DE", name: "EUWAX Gold II", type: "ETF" },
  // ETFs - Immobilien
  "A0HGV5": { ticker: "IQQ6.DE", name: "iShares European Property Yield UCITS ETF", type: "ETF" },
  // ETFs - Anleihen
  "A0LGP4": { ticker: "IUSM.DE", name: "iShares $ Treasury Bond 7-10yr UCITS ETF", type: "ETF" },
  "A0NECU": { ticker: "IBCI.DE", name: "iShares Euro Inflation Linked Govt Bond UCITS ETF", type: "ETF" },
  "A0LGQH": { ticker: "IUSU.DE", name: "iShares $ Treasury Bond 1-3yr UCITS ETF", type: "ETF" },
  "A0LGQL": { ticker: "IUST.DE", name: "iShares $ Treasury Bond 3-7yr UCITS ETF", type: "ETF" },
  // German stocks
  "590900": { ticker: "GBF.DE", name: "Bilfinger SE", type: "Aktie" },
  "716460": { ticker: "SAP.DE", name: "SAP SE", type: "Aktie" },
  "823212": { ticker: "DTE.DE", name: "Deutsche Telekom AG", type: "Aktie" },
  "555750": { ticker: "DPW.DE", name: "Deutsche Post AG", type: "Aktie" },
  "840400": { ticker: "ALV.DE", name: "Allianz SE", type: "Aktie" },
  "514000": { ticker: "DBK.DE", name: "Deutsche Bank AG", type: "Aktie" },
  "519000": { ticker: "BMW.DE", name: "BMW AG", type: "Aktie" },
  "710000": { ticker: "DAI.DE", name: "Mercedes-Benz Group AG", type: "Aktie" },
  "766403": { ticker: "VOW3.DE", name: "Volkswagen AG", type: "Aktie" },
  // Biotech
  "A402CB": { ticker: "ASMB", name: "Assembly Biosciences Inc.", type: "Aktie" },
  "A2H7A5": { ticker: "IFRX", name: "InflaRx N.V.", type: "Aktie" },
  "A0EAT9": { ticker: "GLPG.AS", name: "Galapagos NV", type: "Aktie" },
  "A14158": { ticker: "CTMX", name: "CytomX Therapeutics Inc.", type: "Aktie" },
  "A1180P": { ticker: "OCUL", name: "Ocular Therapeutix Inc.", type: "Aktie" },
  "A3DPH3": { ticker: "ORKA", name: "Oruka Therapeutics Inc.", type: "Aktie" },
  // Other
  "A0M4W9": { ticker: "1211.HK", name: "BYD Company Limited", type: "Aktie" },
  "A3D69W": { ticker: "MSTR", name: "MicroStrategy Inc.", type: "Aktie" },
  "A2PJFZ": { ticker: "PSN", name: "Parsons Corporation", type: "Aktie" },
  // Crypto ETPs
  "A3GZ2Z": { ticker: "CBTC.SW", name: "21Shares Bitcoin Core ETP", type: "Krypto" },
  "A3G04G": { ticker: "ETHC.SW", name: "21Shares Ethereum Core Staking ETP", type: "Krypto" },
  "A2UBKC": { ticker: "AXRP.SW", name: "21Shares XRP ETP", type: "Krypto" },
  "A3GX35": { ticker: "SOLW.SW", name: "WisdomTree Physical Solana", type: "Krypto" }
};
async function lookupByWKN(wkn) {
  try {
    const searchQuery = wkn.toUpperCase();
    const knownSecurity = WKN_DATABASE[searchQuery];
    if (knownSecurity) {
      try {
        const quoteResponse2 = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${knownSecurity.ticker}?interval=1d&range=1d`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
          }
        );
        if (quoteResponse2.ok) {
          const quoteData2 = await quoteResponse2.json();
          const meta2 = quoteData2.chart?.result?.[0]?.meta;
          if (meta2) {
            let price2 = meta2.regularMarketPrice || meta2.previousClose || 0;
            const currency2 = meta2.currency || "EUR";
            if (currency2 === "USD") {
              price2 = price2 / 1.08;
            }
            return {
              success: true,
              data: {
                name: knownSecurity.name,
                ticker: knownSecurity.ticker,
                wkn: searchQuery,
                currentPrice: price2,
                currency: "EUR",
                type: knownSecurity.type,
                exchange: meta2.exchangeName || "Unknown"
              }
            };
          }
        }
      } catch (priceError) {
        console.error("Error fetching price for known WKN:", priceError);
      }
      return {
        success: true,
        data: {
          name: knownSecurity.name,
          ticker: knownSecurity.ticker,
          wkn: searchQuery,
          currentPrice: 0,
          currency: "EUR",
          type: knownSecurity.type,
          exchange: "Unknown"
        }
      };
    }
    const searchResponse = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${searchQuery}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    );
    if (!searchResponse.ok) {
      return { success: false, error: "Yahoo Finance API nicht erreichbar" };
    }
    const searchData = await searchResponse.json();
    const quotes = searchData.quotes || [];
    let bestMatch = quotes.find(
      (q) => q.symbol?.endsWith(".DE") || q.symbol?.endsWith(".F")
    ) || quotes[0];
    if (!bestMatch) {
      const searchResponseDE = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${searchQuery}.DE&quotesCount=5&newsCount=0`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        }
      );
      if (searchResponseDE.ok) {
        const searchDataDE = await searchResponseDE.json();
        bestMatch = searchDataDE.quotes?.[0];
      }
    }
    if (!bestMatch) {
      return { success: false, error: `Keine Daten f\xFCr WKN ${wkn} gefunden` };
    }
    const ticker = bestMatch.symbol;
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    );
    if (!quoteResponse.ok) {
      return {
        success: true,
        data: {
          name: bestMatch.longname || bestMatch.shortname || ticker,
          ticker,
          wkn: wkn.toUpperCase(),
          currentPrice: 0,
          currency: "EUR",
          type: bestMatch.quoteType === "ETF" ? "ETF" : "Aktie",
          exchange: bestMatch.exchange || "Unknown"
        }
      };
    }
    const quoteData = await quoteResponse.json();
    const meta = quoteData.chart?.result?.[0]?.meta;
    if (!meta) {
      return { success: false, error: "Kursdaten nicht verf\xFCgbar" };
    }
    let type = "Aktie";
    if (bestMatch.quoteType === "ETF") type = "ETF";
    else if (bestMatch.quoteType === "CRYPTOCURRENCY") type = "Krypto";
    else if (bestMatch.quoteType === "MUTUALFUND") type = "Fonds";
    let price = meta.regularMarketPrice || meta.previousClose || 0;
    const currency = meta.currency || "EUR";
    if (currency === "USD") {
      price = price / 1.08;
    }
    return {
      success: true,
      data: {
        name: meta.longName || bestMatch.longname || bestMatch.shortname || ticker,
        ticker,
        wkn: wkn.toUpperCase(),
        currentPrice: price,
        currency: "EUR",
        type,
        exchange: meta.exchangeName || bestMatch.exchange || "Unknown"
      }
    };
  } catch (error) {
    console.error("Error looking up WKN:", error);
    return { success: false, error: "Fehler beim Abrufen der Daten" };
  }
}
async function lookupByTicker(ticker) {
  try {
    const quoteResponse = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      }
    );
    if (!quoteResponse.ok) {
      return { success: false, error: `Ticker ${ticker} nicht gefunden` };
    }
    const quoteData = await quoteResponse.json();
    const meta = quoteData.chart?.result?.[0]?.meta;
    if (!meta) {
      return { success: false, error: "Kursdaten nicht verf\xFCgbar" };
    }
    let type = "Aktie";
    const instrumentType = meta.instrumentType?.toLowerCase() || "";
    if (instrumentType.includes("etf")) type = "ETF";
    else if (instrumentType.includes("crypto")) type = "Krypto";
    else if (instrumentType.includes("fund")) type = "Fonds";
    let price = meta.regularMarketPrice || meta.previousClose || 0;
    const currency = meta.currency || "EUR";
    if (currency === "USD") {
      price = price / 1.08;
    }
    return {
      success: true,
      data: {
        name: meta.longName || meta.shortName || ticker,
        ticker,
        currentPrice: price,
        currency: "EUR",
        type,
        exchange: meta.exchangeName || "Unknown"
      }
    };
  } catch (error) {
    console.error("Error looking up ticker:", error);
    return { success: false, error: "Fehler beim Abrufen der Daten" };
  }
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // Portfolio Management
  portfolio: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPortfolioPositions(ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      wkn: z2.string().optional(),
      ticker: z2.string(),
      name: z2.string(),
      type: z2.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]),
      category: z2.string().optional(),
      amount: z2.number(),
      buyPrice: z2.number(),
      currentPrice: z2.number().optional(),
      status: z2.enum(["Kaufen", "Halten", "Verkaufen"]).optional(),
      notes: z2.string().optional(),
      autoUpdate: z2.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      return createPortfolioPosition(ctx.user.id, {
        ...input,
        amount: String(input.amount),
        buyPrice: String(input.buyPrice),
        currentPrice: input.currentPrice !== void 0 ? String(input.currentPrice) : null,
        autoUpdate: input.autoUpdate !== false
        // Default true
      });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      wkn: z2.string().optional(),
      ticker: z2.string().optional(),
      name: z2.string().optional(),
      type: z2.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]).optional(),
      category: z2.string().optional(),
      amount: z2.number().optional(),
      buyPrice: z2.number().optional(),
      currentPrice: z2.number().optional(),
      status: z2.enum(["Kaufen", "Halten", "Verkaufen"]).optional(),
      notes: z2.string().optional(),
      autoUpdate: z2.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, amount, buyPrice, currentPrice, autoUpdate, ...rest } = input;
      return updatePortfolioPosition(ctx.user.id, id, {
        ...rest,
        amount: amount !== void 0 ? String(amount) : void 0,
        buyPrice: buyPrice !== void 0 ? String(buyPrice) : void 0,
        currentPrice: currentPrice !== void 0 ? String(currentPrice) : void 0,
        autoUpdate
      });
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deletePortfolioPosition(ctx.user.id, input.id);
    }),
    import: protectedProcedure.input(z2.object({
      portfolio: z2.array(z2.any()),
      watchlist: z2.array(z2.any()).optional()
    })).mutation(async ({ ctx, input }) => {
      return importPortfolioData(ctx.user.id, input.portfolio, input.watchlist || []);
    }),
    export: protectedProcedure.query(async ({ ctx }) => {
      return exportPortfolioData(ctx.user.id);
    })
  }),
  // Watchlist Management
  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getWatchlistItems(ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      ticker: z2.string(),
      wkn: z2.string().optional(),
      name: z2.string(),
      currentPrice: z2.number().optional(),
      targetPrice: z2.number().optional(),
      notes: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return createWatchlistItem(ctx.user.id, {
        ticker: input.ticker,
        wkn: input.wkn,
        name: input.name,
        currentPrice: input.currentPrice !== void 0 ? String(input.currentPrice) : null,
        targetPrice: input.targetPrice !== void 0 ? String(input.targetPrice) : null,
        notes: input.notes
      });
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      ticker: z2.string().optional(),
      wkn: z2.string().optional(),
      name: z2.string().optional(),
      currentPrice: z2.number().optional(),
      targetPrice: z2.number().optional(),
      notes: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateWatchlistItem(ctx.user.id, id, {
        ticker: data.ticker,
        wkn: data.wkn,
        name: data.name,
        currentPrice: data.currentPrice !== void 0 ? String(data.currentPrice) : void 0,
        targetPrice: data.targetPrice !== void 0 ? String(data.targetPrice) : void 0,
        notes: data.notes
      });
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteWatchlistItem(ctx.user.id, input.id);
    })
  }),
  // Dividends Management
  dividends: router({
    list: protectedProcedure.input(z2.object({ year: z2.number().optional() }).optional()).query(async ({ ctx, input }) => {
      return getDividends(ctx.user.id, input?.year);
    }),
    create: protectedProcedure.input(z2.object({
      ticker: z2.string(),
      name: z2.string(),
      amount: z2.number(),
      taxAmount: z2.number().optional(),
      paymentDate: z2.string(),
      positionId: z2.number().optional()
    })).mutation(async ({ ctx, input }) => {
      return createDividend(ctx.user.id, input);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteDividend(ctx.user.id, input.id);
    })
  }),
  // Notes Management
  notes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getNotes(ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      title: z2.string(),
      content: z2.string().optional(),
      category: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return createNote(ctx.user.id, input);
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      title: z2.string().optional(),
      content: z2.string().optional(),
      category: z2.string().optional()
    })).mutation(async ({ ctx, input }) => {
      return updateNote(ctx.user.id, input.id, input);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteNote(ctx.user.id, input.id);
    })
  }),
  // Savings Plans Management
  savingsPlans: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getSavingsPlans(ctx.user.id);
    }),
    create: protectedProcedure.input(z2.object({
      ticker: z2.string(),
      name: z2.string(),
      monthlyAmount: z2.number(),
      executionDay: z2.number().optional(),
      isActive: z2.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      return createSavingsPlan(ctx.user.id, input);
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      ticker: z2.string().optional(),
      name: z2.string().optional(),
      monthlyAmount: z2.number().optional(),
      executionDay: z2.number().optional(),
      isActive: z2.boolean().optional()
    })).mutation(async ({ ctx, input }) => {
      return updateSavingsPlan(ctx.user.id, input.id, input);
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      return deleteSavingsPlan(ctx.user.id, input.id);
    })
  }),
  // Live Prices
  prices: router({
    fetch: protectedProcedure.input(z2.object({ tickers: z2.array(z2.string()) })).mutation(async ({ ctx, input }) => {
      const prices = await fetchLivePrices(input.tickers);
      const positions = await getPortfolioPositions(ctx.user.id);
      let updatedCount = 0;
      let skippedCount = 0;
      for (const priceData of prices) {
        const position = positions.find((p) => p.ticker === priceData.ticker);
        if (position) {
          if (position.autoUpdate === false) {
            skippedCount++;
            continue;
          }
          let priceInEur = priceData.price;
          if (priceData.currency === "USD") {
            priceInEur = priceData.price / 1.08;
          }
          await updatePortfolioPosition(ctx.user.id, position.id, {
            currentPrice: String(priceInEur)
          });
          updatedCount++;
        }
      }
      return { prices, updatedCount, skippedCount };
    }),
    fetchTwelveData: protectedProcedure.input(z2.object({ tickers: z2.array(z2.string()) })).mutation(async ({ ctx, input }) => {
      const apiKey = process.env.TWELVE_DATA_API_KEY;
      if (!apiKey) {
        throw new Error("Twelve Data API Key nicht konfiguriert. Bitte in den Einstellungen hinterlegen.");
      }
      const prices = await fetchLivePricesTwelveData(input.tickers, apiKey);
      const positions = await getPortfolioPositions(ctx.user.id);
      let updatedCount = 0;
      let skippedCount = 0;
      for (const priceData of prices) {
        const position = positions.find((p) => p.ticker === priceData.ticker);
        if (position && priceData.priceEur) {
          if (position.autoUpdate === false) {
            skippedCount++;
            continue;
          }
          await updatePortfolioPosition(ctx.user.id, position.id, {
            currentPrice: String(priceData.priceEur)
          });
          updatedCount++;
        }
      }
      return { prices, updatedCount, skippedCount };
    }),
    getCached: protectedProcedure.input(z2.object({ tickers: z2.array(z2.string()) })).query(async ({ input }) => {
      return getPriceCacheForTickers(input.tickers);
    }),
    hasApiKey: protectedProcedure.query(async () => {
      return { hasKey: !!process.env.TWELVE_DATA_API_KEY };
    })
  }),
  // AI Assistant
  ai: router({
    analyzePortfolio: protectedProcedure.mutation(async ({ ctx }) => {
      const positions = await getPortfolioPositions(ctx.user.id);
      return analyzePortfolio(ctx.user.id, positions);
    }),
    getRecommendation: protectedProcedure.input(z2.object({ ticker: z2.string(), name: z2.string() })).mutation(async ({ ctx, input }) => {
      const positions = await getPortfolioPositions(ctx.user.id);
      return generateRecommendation(ctx.user.id, input.ticker, input.name, positions);
    }),
    chat: protectedProcedure.input(z2.object({ message: z2.string() })).mutation(async ({ ctx, input }) => {
      const positions = await getPortfolioPositions(ctx.user.id);
      const watchlist = await getWatchlistItems(ctx.user.id);
      return analyzePortfolio(ctx.user.id, positions, input.message, watchlist);
    }),
    suggestSparplan: protectedProcedure.input(z2.object({ monthlyBudget: z2.number(), currentAllocations: z2.array(z2.object({
      category: z2.string(),
      currentPercent: z2.number(),
      targetPercent: z2.number()
    })) })).mutation(async ({ ctx, input }) => {
      const positions = await getPortfolioPositions(ctx.user.id);
      const watchlist = await getWatchlistItems(ctx.user.id);
      const watchlistETFs = watchlist.filter(
        (w) => w.name.toLowerCase().includes("etf") || w.name.toLowerCase().includes("ishares") || w.name.toLowerCase().includes("vanguard") || w.name.toLowerCase().includes("xtrackers") || w.name.toLowerCase().includes("gold") || w.name.toLowerCase().includes("bond") || w.name.toLowerCase().includes("treasury")
      );
      const watchlistInfo = watchlistETFs.length > 0 ? `

Au\xDFerdem habe ich folgende ETFs/Wertpapiere in meiner Watchlist, die ich eventuell in meinen Sparplan aufnehmen m\xF6chte:
` + watchlistETFs.map((w) => `- ${w.name} (${w.ticker}${w.wkn ? `, WKN: ${w.wkn}` : ""})${w.currentPrice ? ` - Aktueller Kurs: ${w.currentPrice}\u20AC` : ""}${w.notes ? ` - Notizen: ${w.notes}` : ""}`).join("\n") + `

Bitte bewerte jeden Watchlist-ETF:
1. Passt er zu meiner Strategie? (Diversifikation, Risiko)
2. Empfehlung: Aufnehmen oder ablehnen? Mit Begr\xFCndung.
3. Falls empfohlen: Wie viel Euro pro Monat?
4. Erstelle dann eine NEUE Sparplan-Verteilung f\xFCr alle empfohlenen ETFs.` : "";
      return analyzePortfolio(
        ctx.user.id,
        positions,
        `Ich habe ein monatliches Budget von ${input.monthlyBudget}\u20AC f\xFCr ETF-Sparpl\xE4ne. Meine aktuelle ETF-Allokation ist: ${input.currentAllocations.map((a) => `${a.category}: ${a.currentPercent.toFixed(1)}% (Ziel: ${a.targetPercent}%)`).join(", ")}. Bitte schlage mir vor, wie ich die ${input.monthlyBudget}\u20AC auf meine ETFs verteilen soll, um meine Ziel-Allokation zu erreichen. Ber\xFCcksichtige dabei auch Rebalancing-Bedarf. Gib konkrete Euro-Betr\xE4ge pro ETF an.` + watchlistInfo,
        watchlist
      );
    })
  }),
  // Security Lookup
  lookup: router({
    byWKN: protectedProcedure.input(z2.object({ wkn: z2.string() })).mutation(async ({ input }) => {
      return lookupByWKN(input.wkn);
    }),
    byTicker: protectedProcedure.input(z2.object({ ticker: z2.string() })).mutation(async ({ input }) => {
      return lookupByTicker(input.ticker);
    })
  }),
  // Watchlist to Portfolio Transfer
  transfer: router({
    watchlistToPortfolio: protectedProcedure.input(z2.object({
      watchlistId: z2.number(),
      amount: z2.number(),
      buyPrice: z2.number(),
      type: z2.enum(["Aktie", "ETF", "Krypto", "Anleihe", "Fonds"]),
      category: z2.string().optional(),
      status: z2.enum(["Kaufen", "Halten", "Verkaufen"]).optional()
    })).mutation(async ({ ctx, input }) => {
      const watchlistItems2 = await getWatchlistItems(ctx.user.id);
      const item = watchlistItems2.find((w) => w.id === input.watchlistId);
      if (!item) {
        throw new Error("Watchlist-Eintrag nicht gefunden");
      }
      const position = await createPortfolioPosition(ctx.user.id, {
        wkn: item.wkn || void 0,
        ticker: item.ticker,
        name: item.name,
        type: input.type,
        category: input.category,
        amount: String(input.amount),
        buyPrice: String(input.buyPrice),
        currentPrice: item.currentPrice ? String(item.currentPrice) : null,
        status: input.status
      });
      await deleteWatchlistItem(ctx.user.id, input.watchlistId);
      return { success: true, position };
    })
  }),
  // User Settings
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),
    save: protectedProcedure.input(z2.object({
      monthlyBudget: z2.number().optional(),
      targetAllocations: z2.array(z2.object({
        category: z2.string(),
        targetPercent: z2.number(),
        description: z2.string().optional()
      })).optional()
    })).mutation(async ({ ctx, input }) => {
      return saveUserSettings(ctx.user.id, input);
    }),
    // PIN-Sperre Funktionen
    setPin: protectedProcedure.input(z2.object({
      pin: z2.string().min(4).max(6),
      enabled: z2.boolean(),
      autoLockMinutes: z2.number().min(1).max(60).optional()
    })).mutation(async ({ ctx, input }) => {
      const { setUserPin: setUserPin2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return setUserPin2(ctx.user.id, input.pin, input.enabled, input.autoLockMinutes);
    }),
    verifyPin: protectedProcedure.input(z2.object({
      pin: z2.string()
    })).mutation(async ({ ctx, input }) => {
      const { verifyUserPin: verifyUserPin2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return verifyUserPin2(ctx.user.id, input.pin);
    }),
    removePin: protectedProcedure.mutation(async ({ ctx }) => {
      const { removeUserPin: removeUserPin2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return removeUserPin2(ctx.user.id);
    }),
    getPinStatus: protectedProcedure.query(async ({ ctx }) => {
      const { getUserPinStatus: getUserPinStatus2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      return getUserPinStatus2(ctx.user.id);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
