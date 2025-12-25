/**
 * Finanzplaner Context - Vollständiges Datenmodell
 * Speichert alle Daten im LocalStorage
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ============= TYPE DEFINITIONS =============

export interface Asset {
  id: string;
  wkn: string;
  ticker: string;
  name: string;
  type: 'Aktie' | 'ETF' | 'Krypto' | 'Anleihe' | 'Rohstoff' | 'Sonstiges';
  category: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  value: number;
  performance: number;
  status: 'Kaufen' | 'Halten' | 'Verkaufen';
  autoUpdate: boolean;
  notes: string;
  purchaseDate: string;
}

export interface CashPosition {
  id: string;
  name: string;
  type: 'Tagesgeld' | 'Festgeld' | 'Girokonto' | 'Sonstiges';
  amount: number;
  interestRate: number;
  maturityDate?: string;
  bank: string;
  notes: string;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  currentPrice: number;
  targetPrice: number;
  changePercent: number;
  notes: string;
  addedDate: string;
}

export interface Dividend {
  id: string;
  assetId: string;
  assetName: string;
  amount: number;
  date: string;
  taxAmount: number;
  notes: string;
}

export interface ETFSparplan {
  id: string;
  etfName: string;
  ticker: string;
  targetAllocation: number;
  currentAllocation: number;
  monthlyAmount: number;
  isActive: boolean;
}

export interface StrategyPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  goals: string[];
  isActive: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  links: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  pin: string;
  pinEnabled: boolean;
  darkMode: boolean;
  currency: string;
  autoLockMinutes: number;
  showPerformancePercent: boolean;
  riskWarningThreshold: number;
}

export interface FinanzplanerData {
  assets: Asset[];
  cashPositions: CashPosition[];
  watchlist: WatchlistItem[];
  dividends: Dividend[];
  sparplaene: ETFSparplan[];
  strategyPhases: StrategyPhase[];
  notes: Note[];
  settings: AppSettings;
}

// ============= DEFAULT VALUES =============

const defaultSettings: AppSettings = {
  pin: '',
  pinEnabled: false,
  darkMode: true,
  currency: 'EUR',
  autoLockMinutes: 5,
  showPerformancePercent: true,
  riskWarningThreshold: 30,
};

const defaultData: FinanzplanerData = {
  assets: [],
  cashPositions: [],
  watchlist: [],
  dividends: [],
  sparplaene: [],
  strategyPhases: [
    {
      id: '1',
      name: 'Phase 1: Aufbau',
      startDate: '2024-01-01',
      endDate: '2025-06-30',
      description: 'Grundlagen schaffen, ETF-Sparplan starten',
      goals: ['Notgroschen aufbauen', 'ETF-Sparplan starten', 'Erste Einzelaktien'],
      isActive: true,
    },
    {
      id: '2',
      name: 'Phase 2: Wachstum',
      startDate: '2025-07-01',
      endDate: '2026-12-31',
      description: 'Portfolio ausbauen, Diversifikation erhöhen',
      goals: ['Sparrate erhöhen', 'Sektoren diversifizieren', 'Dividenden-Strategie'],
      isActive: false,
    },
    {
      id: '3',
      name: 'Phase 3: Konsolidierung',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      description: 'Portfolio optimieren, Risiko reduzieren',
      goals: ['Rebalancing', 'Risiko reduzieren', 'Langfrist-Positionen stärken'],
      isActive: false,
    },
  ],
  notes: [],
  settings: defaultSettings,
};

// ============= CONTEXT =============

interface FinanzplanerContextType {
  data: FinanzplanerData;
  isAuthenticated: boolean;
  isPinSet: boolean;
  
  // Auth
  login: (pin: string) => boolean;
  logout: () => void;
  setPin: (pin: string) => void;
  
  // Assets
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  updateAsset: (id: string, asset: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  
  // Cash
  addCashPosition: (position: Omit<CashPosition, 'id'>) => void;
  updateCashPosition: (id: string, position: Partial<CashPosition>) => void;
  deleteCashPosition: (id: string) => void;
  
  // Watchlist
  addToWatchlist: (item: Omit<WatchlistItem, 'id'>) => void;
  updateWatchlistItem: (id: string, item: Partial<WatchlistItem>) => void;
  removeFromWatchlist: (id: string) => void;
  moveToPortfolio: (watchlistId: string, amount: number, buyPrice: number) => void;
  
  // Dividends
  addDividend: (dividend: Omit<Dividend, 'id'>) => void;
  updateDividend: (id: string, dividend: Partial<Dividend>) => void;
  deleteDividend: (id: string) => void;
  
  // Sparplan
  addSparplan: (sparplan: Omit<ETFSparplan, 'id'>) => void;
  updateSparplan: (id: string, sparplan: Partial<ETFSparplan>) => void;
  deleteSparplan: (id: string) => void;
  
  // Strategy
  updateStrategyPhase: (id: string, phase: Partial<StrategyPhase>) => void;
  
  // Notes
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, note: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<AppSettings>) => void;
  
  // Import/Export
  exportData: () => string;
  importData: (jsonString: string) => { success: boolean; message: string };
  importLegacyBackup: (jsonString: string) => { success: number; errors: string[] };
  resetAllData: () => void;
  
  // Stats
  getPortfolioStats: () => {
    totalValue: number;
    totalInvested: number;
    totalGain: number;
    totalGainPercent: number;
    cashTotal: number;
    totalWealth: number;
    assetsByType: Record<string, number>;
    assetsByCategory: Record<string, number>;
    riskLevel: number;
  };
  
  getDividendStats: () => {
    totalReceived: number;
    thisYear: number;
    lastYear: number;
    byMonth: Record<string, number>;
    expectedAnnual: number;
  };
}

const FinanzplanerContext = createContext<FinanzplanerContextType | null>(null);

const STORAGE_KEY = 'finanzplaner_data';
const AUTH_KEY = 'finanzplaner_auth';

// ============= PROVIDER =============

export function FinanzplanerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FinanzplanerData>(defaultData);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData({ ...defaultData, ...parsed });
      } catch (e) {
        console.error('Failed to parse stored data:', e);
      }
    }
    
    // Check auth state
    const authState = sessionStorage.getItem(AUTH_KEY);
    if (authState === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Save data to localStorage
  const saveData = (newData: FinanzplanerData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  };

  const isPinSet = data.settings.pin.length >= 4;

  // ============= AUTH =============
  
  const login = (pin: string): boolean => {
    if (pin === data.settings.pin) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(AUTH_KEY);
  };

  const setPin = (pin: string) => {
    const newData = {
      ...data,
      settings: { ...data.settings, pin, pinEnabled: true },
    };
    saveData(newData);
    setIsAuthenticated(true);
    sessionStorage.setItem(AUTH_KEY, 'true');
  };

  // ============= ASSETS =============

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const addAsset = (asset: Omit<Asset, 'id'>) => {
    const newAsset: Asset = { ...asset, id: generateId() };
    saveData({ ...data, assets: [...data.assets, newAsset] });
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    const newAssets = data.assets.map(a => 
      a.id === id ? { ...a, ...updates } : a
    );
    saveData({ ...data, assets: newAssets });
  };

  const deleteAsset = (id: string) => {
    saveData({ ...data, assets: data.assets.filter(a => a.id !== id) });
  };

  // ============= CASH =============

  const addCashPosition = (position: Omit<CashPosition, 'id'>) => {
    const newPosition: CashPosition = { ...position, id: generateId() };
    saveData({ ...data, cashPositions: [...data.cashPositions, newPosition] });
  };

  const updateCashPosition = (id: string, updates: Partial<CashPosition>) => {
    const newPositions = data.cashPositions.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    saveData({ ...data, cashPositions: newPositions });
  };

  const deleteCashPosition = (id: string) => {
    saveData({ ...data, cashPositions: data.cashPositions.filter(p => p.id !== id) });
  };

  // ============= WATCHLIST =============

  const addToWatchlist = (item: Omit<WatchlistItem, 'id'>) => {
    const newItem: WatchlistItem = { ...item, id: generateId() };
    saveData({ ...data, watchlist: [...data.watchlist, newItem] });
  };

  const updateWatchlistItem = (id: string, updates: Partial<WatchlistItem>) => {
    const newWatchlist = data.watchlist.map(w => 
      w.id === id ? { ...w, ...updates } : w
    );
    saveData({ ...data, watchlist: newWatchlist });
  };

  const removeFromWatchlist = (id: string) => {
    saveData({ ...data, watchlist: data.watchlist.filter(w => w.id !== id) });
  };

  const moveToPortfolio = (watchlistId: string, amount: number, buyPrice: number) => {
    const item = data.watchlist.find(w => w.id === watchlistId);
    if (!item) return;

    const newAsset: Asset = {
      id: generateId(),
      wkn: '',
      ticker: item.ticker,
      name: item.name,
      type: 'Aktie',
      category: 'Sonstiges',
      amount,
      buyPrice,
      currentPrice: item.currentPrice,
      value: amount * item.currentPrice,
      performance: ((item.currentPrice - buyPrice) / buyPrice) * 100,
      status: 'Halten',
      autoUpdate: false,
      notes: item.notes,
      purchaseDate: new Date().toISOString().split('T')[0],
    };

    saveData({
      ...data,
      assets: [...data.assets, newAsset],
      watchlist: data.watchlist.filter(w => w.id !== watchlistId),
    });
  };

  // ============= DIVIDENDS =============

  const addDividend = (dividend: Omit<Dividend, 'id'>) => {
    const newDividend: Dividend = { ...dividend, id: generateId() };
    saveData({ ...data, dividends: [...data.dividends, newDividend] });
  };

  const updateDividend = (id: string, updates: Partial<Dividend>) => {
    const newDividends = data.dividends.map(d => 
      d.id === id ? { ...d, ...updates } : d
    );
    saveData({ ...data, dividends: newDividends });
  };

  const deleteDividend = (id: string) => {
    saveData({ ...data, dividends: data.dividends.filter(d => d.id !== id) });
  };

  // ============= SPARPLAN =============

  const addSparplan = (sparplan: Omit<ETFSparplan, 'id'>) => {
    const newSparplan: ETFSparplan = { ...sparplan, id: generateId() };
    saveData({ ...data, sparplaene: [...data.sparplaene, newSparplan] });
  };

  const updateSparplan = (id: string, updates: Partial<ETFSparplan>) => {
    const newSparplaene = data.sparplaene.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    saveData({ ...data, sparplaene: newSparplaene });
  };

  const deleteSparplan = (id: string) => {
    saveData({ ...data, sparplaene: data.sparplaene.filter(s => s.id !== id) });
  };

  // ============= STRATEGY =============

  const updateStrategyPhase = (id: string, updates: Partial<StrategyPhase>) => {
    const newPhases = data.strategyPhases.map(p => 
      p.id === id ? { ...p, ...updates } : p
    );
    saveData({ ...data, strategyPhases: newPhases });
  };

  // ============= NOTES =============

  const addNote = (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newNote: Note = { 
      ...note, 
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    saveData({ ...data, notes: [...data.notes, newNote] });
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    const newNotes = data.notes.map(n => 
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );
    saveData({ ...data, notes: newNotes });
  };

  const deleteNote = (id: string) => {
    saveData({ ...data, notes: data.notes.filter(n => n.id !== id) });
  };

  // ============= SETTINGS =============

  const updateSettings = (updates: Partial<AppSettings>) => {
    saveData({ ...data, settings: { ...data.settings, ...updates } });
  };

  // ============= IMPORT/EXPORT =============

  const exportData = (): string => {
    return JSON.stringify({
      ...data,
      exportDate: new Date().toISOString(),
      version: '2.0',
    }, null, 2);
  };

  const importData = (jsonString: string): { success: boolean; message: string } => {
    try {
      const imported = JSON.parse(jsonString);
      saveData({ ...defaultData, ...imported });
      return { success: true, message: 'Daten erfolgreich importiert' };
    } catch (e) {
      return { success: false, message: 'Ungültiges JSON-Format' };
    }
  };

  // Import from legacy backup format
  const importLegacyBackup = (jsonString: string): { success: number; errors: string[] } => {
    const errors: string[] = [];
    let success = 0;

    try {
      const backup = JSON.parse(jsonString);
      const newAssets: Asset[] = [];
      const newWatchlist: WatchlistItem[] = [];

      // Import portfolio
      if (backup.portfolio && Array.isArray(backup.portfolio)) {
        for (const item of backup.portfolio) {
          try {
            const asset: Asset = {
              id: generateId(),
              wkn: item.wkn || '',
              ticker: item.ticker || '',
              name: item.name || 'Unbekannt',
              type: mapLegacyType(item.type),
              category: item.category || 'Sonstiges',
              amount: Number(item.amount) || 0,
              buyPrice: Number(item.buyPrice) || 0,
              currentPrice: Number(item.value) / Number(item.amount) || Number(item.buyPrice) || 0,
              value: Number(item.value) || 0,
              performance: Number(item.performance) || 0,
              status: mapLegacyStatus(item.status),
              autoUpdate: item.autoUpdate ?? false,
              notes: item.notes || '',
              purchaseDate: item.purchaseDate || new Date().toISOString().split('T')[0],
            };
            newAssets.push(asset);
            success++;
          } catch (e) {
            errors.push(`Fehler bei ${item.name}: ${e}`);
          }
        }
      }

      // Import watchlist
      if (backup.watchlist && Array.isArray(backup.watchlist)) {
        for (const item of backup.watchlist) {
          try {
            const watchItem: WatchlistItem = {
              id: generateId(),
              ticker: item.ticker || '',
              name: item.name || item.ticker || 'Unbekannt',
              currentPrice: Number(item.price) || 0,
              targetPrice: Number(item.targetPrice) || 0,
              changePercent: Number(item.changePercent) || 0,
              notes: item.notes || '',
              addedDate: new Date().toISOString().split('T')[0],
            };
            newWatchlist.push(watchItem);
          } catch (e) {
            errors.push(`Watchlist-Fehler bei ${item.ticker}: ${e}`);
          }
        }
      }

      // Save imported data
      saveData({
        ...data,
        assets: [...data.assets, ...newAssets],
        watchlist: [...data.watchlist, ...newWatchlist],
      });

      return { success, errors };
    } catch (e) {
      return { success: 0, errors: [`JSON-Parse-Fehler: ${e}`] };
    }
  };

  const mapLegacyType = (type: string): Asset['type'] => {
    const typeMap: Record<string, Asset['type']> = {
      'Aktie': 'Aktie',
      'ETF': 'ETF',
      'Krypto': 'Krypto',
      'Anleihe': 'Anleihe',
      'Rohstoff': 'Rohstoff',
    };
    return typeMap[type] || 'Sonstiges';
  };

  const mapLegacyStatus = (status: string): Asset['status'] => {
    const statusMap: Record<string, Asset['status']> = {
      'Kaufen': 'Kaufen',
      'Halten': 'Halten',
      'Verkaufen': 'Verkaufen',
    };
    return statusMap[status] || 'Halten';
  };

  const resetAllData = () => {
    saveData(defaultData);
    logout();
  };

  // ============= STATS =============

  const getPortfolioStats = () => {
    const totalValue = data.assets.reduce((sum, a) => sum + a.value, 0);
    const totalInvested = data.assets.reduce((sum, a) => sum + (a.amount * a.buyPrice), 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    const cashTotal = data.cashPositions.reduce((sum, c) => sum + c.amount, 0);
    const totalWealth = totalValue + cashTotal;

    const assetsByType: Record<string, number> = {};
    const assetsByCategory: Record<string, number> = {};

    for (const asset of data.assets) {
      assetsByType[asset.type] = (assetsByType[asset.type] || 0) + asset.value;
      assetsByCategory[asset.category] = (assetsByCategory[asset.category] || 0) + asset.value;
    }

    // Calculate risk level (based on Biotech/Krypto percentage)
    const riskyCategories = ['Biotech', 'Krypto'];
    const riskyValue = data.assets
      .filter(a => riskyCategories.includes(a.category) || a.type === 'Krypto')
      .reduce((sum, a) => sum + a.value, 0);
    const riskLevel = totalValue > 0 ? (riskyValue / totalValue) * 100 : 0;

    return {
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      cashTotal,
      totalWealth,
      assetsByType,
      assetsByCategory,
      riskLevel,
    };
  };

  const getDividendStats = () => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const totalReceived = data.dividends.reduce((sum, d) => sum + d.amount, 0);
    
    const thisYearDividends = data.dividends
      .filter(d => new Date(d.date).getFullYear() === thisYear)
      .reduce((sum, d) => sum + d.amount, 0);
    
    const lastYearDividends = data.dividends
      .filter(d => new Date(d.date).getFullYear() === lastYear)
      .reduce((sum, d) => sum + d.amount, 0);

    const byMonth: Record<string, number> = {};
    for (const d of data.dividends) {
      const month = d.date.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + d.amount;
    }

    // Estimate annual dividends based on last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const expectedAnnual = data.dividends
      .filter(d => new Date(d.date) >= twelveMonthsAgo)
      .reduce((sum, d) => sum + d.amount, 0);

    return {
      totalReceived,
      thisYear: thisYearDividends,
      lastYear: lastYearDividends,
      byMonth,
      expectedAnnual,
    };
  };

  return (
    <FinanzplanerContext.Provider value={{
      data,
      isAuthenticated,
      isPinSet,
      login,
      logout,
      setPin,
      addAsset,
      updateAsset,
      deleteAsset,
      addCashPosition,
      updateCashPosition,
      deleteCashPosition,
      addToWatchlist,
      updateWatchlistItem,
      removeFromWatchlist,
      moveToPortfolio,
      addDividend,
      updateDividend,
      deleteDividend,
      addSparplan,
      updateSparplan,
      deleteSparplan,
      updateStrategyPhase,
      addNote,
      updateNote,
      deleteNote,
      updateSettings,
      exportData,
      importData,
      importLegacyBackup,
      resetAllData,
      getPortfolioStats,
      getDividendStats,
    }}>
      {children}
    </FinanzplanerContext.Provider>
  );
}

export function useFinanzplaner() {
  const context = useContext(FinanzplanerContext);
  if (!context) {
    throw new Error('useFinanzplaner must be used within a FinanzplanerProvider');
  }
  return context;
}
