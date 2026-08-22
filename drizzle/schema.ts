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
  // Rentenziel (Dashboard) - vorher nur in localStorage, dadurch pro Geraet unterschiedlich
  retirementTargetSum: decimal("retirementTargetSum", { precision: 18, scale: 2 }),
  desiredPension: decimal("desiredPension", { precision: 18, scale: 2 }),
  // PIN-Sperre Einstellungen
  pinEnabled: boolean("pinEnabled").default(false),
  pinHash: varchar("pinHash", { length: 128 }),
  autoLockMinutes: int("autoLockMinutes").default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Transactions table for tracking buys/sells from DKB PDF imports
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: timestamp("date").notNull(),
  type: mysqlEnum("type", ["Kauf", "Verkauf", "Sparplan"]).notNull(),
  isin: varchar("isin", { length: 20 }).notNull(),
  wkn: varchar("wkn", { length: 20 }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 18, scale: 8 }).notNull(),
  price: decimal("price", { precision: 18, scale: 4 }).notNull(),
  fees: decimal("fees", { precision: 18, scale: 4 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 18, scale: 4 }).notNull(),
  orderNumber: varchar("orderNumber", { length: 100 }).notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * AI Question Templates for quick access
 */
export const aiQuestionTemplates = mysqlTable("ai_question_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  prompt: text("prompt").notNull(),
  category: varchar("category", { length: 50 }),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiQuestionTemplate = typeof aiQuestionTemplates.$inferSelect;
export type InsertAiQuestionTemplate = typeof aiQuestionTemplates.$inferInsert;

/**
 * AI Chat History
 */
export const aiChatHistory = mysqlTable("ai_chat_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  templateId: int("templateId"),
  sessionId: varchar("sessionId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiChatHistory = typeof aiChatHistory.$inferSelect;
export type InsertAiChatHistory = typeof aiChatHistory.$inferInsert;

/**
 * Tax sources (banks/brokers) with exemption orders
 */
export const taxSources = mysqlTable("tax_sources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  exemptionOrder: decimal("exemptionOrder", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxSource = typeof taxSources.$inferSelect;
export type InsertTaxSource = typeof taxSources.$inferInsert;

/**
 * Tax settings (loss pots and exemption limit)
 */
export const taxSettings = mysqlTable("tax_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stockLossPot: decimal("stockLossPot", { precision: 10, scale: 2 }).notNull().default("0"),
  otherLossPot: decimal("otherLossPot", { precision: 10, scale: 2 }).notNull().default("0"),
  maxExemptionOrder: decimal("maxExemptionOrder", { precision: 10, scale: 2 }).notNull().default("1000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxSettings = typeof taxSettings.$inferSelect;
export type InsertTaxSettings = typeof taxSettings.$inferInsert;

/**
 * Stock traffic light (Aktien-Ampel) entries
 */
export const stockTrafficLight = mysqlTable("stock_traffic_light", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  wkn: varchar("wkn", { length: 20 }),
  name: varchar("name", { length: 255 }).notNull(),
  currentPrice: decimal("currentPrice", { precision: 18, scale: 4 }),
  sma50: decimal("sma50", { precision: 18, scale: 4 }),
  sma200: decimal("sma200", { precision: 18, scale: 4 }),
  signal: mysqlEnum("signal", ["GRUEN", "GELB", "ROT"]),
  signalDetail: varchar("signalDetail", { length: 255 }),
  lastUpdated: timestamp("lastUpdated"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockTrafficLight = typeof stockTrafficLight.$inferSelect;
export type InsertStockTrafficLight = typeof stockTrafficLight.$inferInsert;

/**
 * Tax Allowances (Freibeträge) - Yearly tax exemptions per broker
 */
export const taxAllowances = mysqlTable("tax_allowances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  used: decimal("used", { precision: 10, scale: 2 }).notNull().default("0"),
  broker: varchar("broker", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TaxAllowance = typeof taxAllowances.$inferSelect;
export type InsertTaxAllowance = typeof taxAllowances.$inferInsert;

/**
 * Loss Carryforwards (Verlustvorträge) - Tax loss pots from previous years
 */
export const lossCarryforwards = mysqlTable("loss_carryforwards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  year: int("year").notNull(),
  category: mysqlEnum("category", ["general", "stocks", "other"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  broker: varchar("broker", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LossCarryforward = typeof lossCarryforwards.$inferSelect;
export type InsertLossCarryforward = typeof lossCarryforwards.$inferInsert;

/**
 * Tech-Frühwarnsystem - Snapshots der 5 Indikatoren
 * Eine Zeile = ein vollständiger Knopfdruck-Snapshot
 */
export const techWarningSignals = mysqlTable("tech_warning_signals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  overallSignal: mysqlEnum("overallSignal", ["gruen", "gelb", "rot"]).notNull(),
  indicators: json("indicators").notNull(),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TechWarningSignal = typeof techWarningSignals.$inferSelect;
export type InsertTechWarningSignal = typeof techWarningSignals.$inferInsert;

/**
 * Vermoegensverlauf - ein Eintrag pro Tag, an dem das Dashboard geoeffnet wurde
 * (kein Cron noetig: wird beim Laden des Dashboards automatisch nachgetragen,
 * hoechstens ein Eintrag pro Kalendertag)
 */
export const portfolioSnapshots = mysqlTable("portfolio_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotDate: varchar("snapshotDate", { length: 10 }).notNull(), // 'YYYY-MM-DD'
  totalValue: decimal("totalValue", { precision: 18, scale: 2 }).notNull(),
  totalInvested: decimal("totalInvested", { precision: 18, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

/**
 * Einstiegsanalyse - Historie abgeschlossener Kauf-Entscheidungsprozesse
 * (5-Kriterien-Checkliste + Kurssprung-Filter, siehe PROJEKTE/Aktien-Einstiegsanalyse)
 */
export const einstiegsanalysen = mysqlTable("einstiegsanalysen", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  ticker: varchar("ticker", { length: 20 }).notNull(),
  wkn: varchar("wkn", { length: 20 }),
  name: varchar("name", { length: 255 }).notNull(),
  preisBeiAnalyse: decimal("preisBeiAnalyse", { precision: 18, scale: 4 }),

  kurssprungAusgeloest: boolean("kurssprungAusgeloest").notNull().default(false),
  kurssprungWochenperf: decimal("kurssprungWochenperf", { precision: 6, scale: 2 }),
  kurssprungGrund: mysqlEnum("kurssprungGrund", ["ja", "nein"]),
  kurssprungSpezifisch: mysqlEnum("kurssprungSpezifisch", ["firmenspezifisch", "sektor"]),
  kurssprungVorlauf: mysqlEnum("kurssprungVorlauf", ["einklang", "vorlauf"]),
  kurssprungKonsequenz: varchar("kurssprungKonsequenz", { length: 500 }),
  coolDown: boolean("coolDown").notNull().default(false),

  kriterium1Signal: mysqlEnum("kriterium1Signal", ["GRUEN", "GELB", "ROT"]).notNull(),
  kriterium1Detail: varchar("kriterium1Detail", { length: 500 }),
  kriterium2Signal: mysqlEnum("kriterium2Signal", ["GRUEN", "GELB", "ROT"]).notNull(),
  kriterium2Detail: varchar("kriterium2Detail", { length: 500 }),
  kriterium3Signal: mysqlEnum("kriterium3Signal", ["GRUEN", "GELB", "ROT"]).notNull(),
  kriterium3Detail: varchar("kriterium3Detail", { length: 500 }),
  kriterium4Signal: mysqlEnum("kriterium4Signal", ["GRUEN", "GELB", "ROT"]).notNull(),
  kriterium4Detail: varchar("kriterium4Detail", { length: 500 }),

  these: text("these").notNull(),
  exitThese: text("exitThese").notNull(),

  ergebnis: mysqlEnum("ergebnis", ["KAUF_MOEGLICH", "ABGELEHNT", "COOLDOWN"]).notNull(),
  gruenCount: int("gruenCount").notNull(),
  gelbCount: int("gelbCount").notNull(),
  rotCount: int("rotCount").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Einstiegsanalyse = typeof einstiegsanalysen.$inferSelect;
export type InsertEinstiegsanalyse = typeof einstiegsanalysen.$inferInsert;

/**
 * Morning Note - On-Demand Zusammenfassung ueber Nacht/heute relevanter News
 * zu den eigenen Portfolio-Positionen. Ein Eintrag = ein Knopfdruck.
 */
export const morningNotes = mysqlTable("morning_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  headline: varchar("headline", { length: 500 }).notNull(),
  bodyMarkdown: text("bodyMarkdown").notNull(),
  positionsCovered: json("positionsCovered").notNull(), // Array<{ticker,name,hasNews}>
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MorningNote = typeof morningNotes.$inferSelect;
export type InsertMorningNote = typeof morningNotes.$inferInsert;

/**
 * KI-Pick-Experiment - zwei KIs (OpenAI/Claude) picken je eine Mid-Cap-Aktie mit
 * hoechstem 30-Tage-Renditepotenzial, rein virtuell (5.000 EUR), kein Investmentrat.
 * Ein "runId" gruppiert die zwei Picks (openai+claude) EINES Knopfdrucks.
 */
export const kiExperimentPicks = mysqlTable("ki_experiment_picks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  runId: varchar("runId", { length: 36 }).notNull(),
  model: mysqlEnum("model", ["openai", "claude"]).notNull(),
  ticker: varchar("ticker", { length: 20 }),
  name: varchar("name", { length: 255 }),
  bodyMarkdown: text("bodyMarkdown"),
  virtualAmount: decimal("virtualAmount", { precision: 18, scale: 2 }).notNull().default("5000.00"),
  entryPrice: decimal("entryPrice", { precision: 18, scale: 4 }),
  entryCurrency: varchar("entryCurrency", { length: 10 }),
  entryDate: varchar("entryDate", { length: 10 }), // 'YYYY-MM-DD'
  currentPrice: decimal("currentPrice", { precision: 18, scale: 4 }),
  lastPriceCheckAt: timestamp("lastPriceCheckAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KiExperimentPick = typeof kiExperimentPicks.$inferSelect;
export type InsertKiExperimentPick = typeof kiExperimentPicks.$inferInsert;

/**
 * Innovationsbudget - Jahresziel (manuell gepflegt, nicht automatisch aus Depotwert,
 * weil das Geld dafuer nicht immer aus dem eigenen Depot kommt)
 */
export const innovationsbudgetJahresziel = mysqlTable("innovationsbudget_jahresziel", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jahr: int("jahr").notNull(),
  zielbetrag: decimal("zielbetrag", { precision: 18, scale: 2 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InnovationsbudgetJahresziel = typeof innovationsbudgetJahresziel.$inferSelect;
export type InsertInnovationsbudgetJahresziel = typeof innovationsbudgetJahresziel.$inferInsert;

/**
 * Innovationsbudget - einzelne Verbrauchs-Eintraege gegen das Jahresziel
 */
export const innovationsbudgetNutzung = mysqlTable("innovationsbudget_nutzung", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jahr: int("jahr").notNull(),
  ticker: varchar("ticker", { length: 20 }),
  name: varchar("name", { length: 255 }),
  betrag: decimal("betrag", { precision: 18, scale: 2 }).notNull(),
  beschreibung: varchar("beschreibung", { length: 500 }),
  einstiegsanalyseId: int("einstiegsanalyseId"),
  datum: varchar("datum", { length: 10 }).notNull(), // 'YYYY-MM-DD'
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InnovationsbudgetNutzung = typeof innovationsbudgetNutzung.$inferSelect;
export type InsertInnovationsbudgetNutzung = typeof innovationsbudgetNutzung.$inferInsert;

