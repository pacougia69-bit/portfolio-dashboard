import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  pin: varchar("pin", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Portfolio positions table
 */
export const portfolioPositions = mysqlTable("portfolio_positions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioPosition = typeof portfolioPositions.$inferSelect;
export type InsertPortfolioPosition = typeof portfolioPositions.$inferInsert;

/**
 * Watchlist table
 */
export const watchlistItems = mysqlTable("watchlist_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  wkn: varchar("wkn", { length: 20 }),
  name: varchar("name", { length: 255 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 18, scale: 4 }),
  targetPrice: decimal("targetPrice", { precision: 18, scale: 4 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WatchlistItem = typeof watchlistItems.$inferSelect;
export type InsertWatchlistItem = typeof watchlistItems.$inferInsert;

/**
 * Dividends table
 */
export const dividends = mysqlTable("dividends", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  positionId: int("positionId"),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 4 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 18, scale: 4 }).default("0"),
  paymentDate: timestamp("paymentDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Dividend = typeof dividends.$inferSelect;
export type InsertDividend = typeof dividends.$inferInsert;

/**
 * ETF Savings Plans
 */
export const savingsPlans = mysqlTable("savings_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  monthlyAmount: decimal("monthlyAmount", { precision: 18, scale: 2 }).notNull(),
  executionDay: int("executionDay").default(1),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SavingsPlan = typeof savingsPlans.$inferSelect;
export type InsertSavingsPlan = typeof savingsPlans.$inferInsert;

/**
 * Notes table
 */
export const notes = mysqlTable("notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

/**
 * Price cache for storing fetched prices
 */
export const priceCache = mysqlTable("price_cache", {
  id: int("id").autoincrement().primaryKey(),
  ticker: varchar("ticker", { length: 20 }).notNull().unique(),
  price: decimal("price", { precision: 18, scale: 4 }).notNull(),
  changePercent: decimal("changePercent", { precision: 10, scale: 4 }),
  currency: varchar("currency", { length: 10 }).default("EUR"),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
});

export type PriceCache = typeof priceCache.$inferSelect;
export type InsertPriceCache = typeof priceCache.$inferInsert;

/**
 * AI Analysis history
 */
export const aiAnalyses = mysqlTable("ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["portfolio", "position", "market", "recommendation"]).notNull(),
  targetTicker: varchar("targetTicker", { length: 20 }),
  analysis: text("analysis").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type InsertAiAnalysis = typeof aiAnalyses.$inferInsert;

/**
 * User Settings for strategy and preferences
 */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  monthlyBudget: decimal("monthlyBudget", { precision: 18, scale: 2 }).default("500"),
  targetAllocations: json("targetAllocations"),
  // PIN-Sperre Einstellungen
  pinEnabled: boolean("pinEnabled").default(false),
  pinHash: varchar("pinHash", { length: 128 }),
  autoLockMinutes: int("autoLockMinutes").default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
