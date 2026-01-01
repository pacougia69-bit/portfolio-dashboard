import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types - Extended to match backup format
export interface Asset {
  id: string;
  name: string;
  symbol: string;
  wkn?: string;
  ticker?: string;
  type: 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity' | 'other';
  category?: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  notes?: string;
  status?: 'Kaufen' | 'Halten' | 'Verkaufen';
  autoUpdate?: boolean;
}

export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  currency: string;
  targetPrice?: number;
  notes?: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  totalGainPercent: number;
  assetCount: number;
  bestPerformer: Asset | null;
  worstPerformer: Asset | null;
}

// Backup format interface
interface BackupFormat {
  timestamp?: string;
  dashboard?: { title: string | null };
  portfolio: Array<{
    wkn?: string;
    ticker?: string;
    name: string;
    type: string;
    category?: string;
    amount: number;
    buyPrice: number;
    value: number;
    performance?: number;
    status?: string;
    autoUpdate?: boolean;
  }>;
  watchlist?: Array<{
    ticker: string;
    name: string;
    price: number;
    changePercent: number;
    currency: string;
    targetPrice?: number;
    notes?: string;
  }>;
  notes?: { text: string | null; links: string[] };
  report?: string | null;
  settings?: { manualPriceMode?: string };
}

interface PortfolioContextType {
  assets: Asset[];
  watchlist: WatchlistItem[];
  stats: PortfolioStats;
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  updateAsset: (id: string, asset: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  addWatchlistItem: (item: Omit<WatchlistItem, 'id'>) => void;
  removeWatchlistItem: (id: string) => void;
  importFromCSV: (csvData: string) => { success: number; errors: string[] };
  importFromJSON: (jsonData: string) => { success: number; errors: string[] };
  exportToCSV: () => string;
  exportToJSON: () => string;
  clearAllData: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const STORAGE_KEY = 'portfolio_assets';
const WATCHLIST_KEY = 'portfolio_watchlist';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function mapTypeFromBackup(type: string): Asset['type'] {
  const typeMap: Record<string, Asset['type']> = {
    'Aktie': 'stock',
    'aktie': 'stock',
    'stock': 'stock',
    'ETF': 'etf',
    'etf': 'etf',
    'Krypto': 'crypto',
    'krypto': 'crypto',
    'crypto': 'crypto',
    'Anleihe': 'bond',
    'bond': 'bond',
    'Rohstoff': 'commodity',
    'commodity': 'commodity',
  };
  return typeMap[type] || 'other';
}

function mapTypeToGerman(type: Asset['type']): string {
  const typeMap: Record<Asset['type'], string> = {
    'stock': 'Aktie',
    'etf': 'ETF',
    'crypto': 'Krypto',
    'bond': 'Anleihe',
    'commodity': 'Rohstoff',
    'other': 'Sonstige',
  };
  return typeMap[type] || 'Sonstige';
}

function calculateStats(assets: Asset[]): PortfolioStats {
  if (assets.length === 0) {
    return {
      totalValue: 0,
      totalInvested: 0,
      totalGain: 0,
      totalGainPercent: 0,
      assetCount: 0,
      bestPerformer: null,
      worstPerformer: null,
    };
  }

  let totalValue = 0;
  let totalInvested = 0;
  let bestPerformer: Asset | null = null;
  let worstPerformer: Asset | null = null;
  let bestGainPercent = -Infinity;
  let worstGainPercent = Infinity;

  assets.forEach(asset => {
    const value = asset.quantity * asset.currentPrice;
    const invested = asset.quantity * asset.purchasePrice;
    const gainPercent = asset.purchasePrice > 0 
      ? ((asset.currentPrice - asset.purchasePrice) / asset.purchasePrice) * 100 
      : 0;

    totalValue += value;
    totalInvested += invested;

    if (gainPercent > bestGainPercent) {
      bestGainPercent = gainPercent;
      bestPerformer = asset;
    }
    if (gainPercent < worstGainPercent) {
      worstGainPercent = gainPercent;
      worstPerformer = asset;
    }
  });

  const totalGain = totalValue - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalGain,
    totalGainPercent,
    assetCount: assets.length,
    bestPerformer,
    worstPerformer,
  };
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [stats, setStats] = useState<PortfolioStats>(calculateStats([]));

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAssets(parsed);
        setStats(calculateStats(parsed));
      } catch (e) {
        console.error('Failed to parse stored assets:', e);
      }
    }

    const storedWatchlist = localStorage.getItem(WATCHLIST_KEY);
    if (storedWatchlist) {
      try {
        setWatchlist(JSON.parse(storedWatchlist));
      } catch (e) {
        console.error('Failed to parse stored watchlist:', e);
      }
    }
  }, []);

  // Save to localStorage when assets change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
    setStats(calculateStats(assets));
  }, [assets]);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const addAsset = (asset: Omit<Asset, 'id'>) => {
    const newAsset: Asset = {
      ...asset,
      id: generateId(),
    };
    setAssets(prev => [...prev, newAsset]);
  };

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(asset => 
      asset.id === id ? { ...asset, ...updates } : asset
    ));
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(asset => asset.id !== id));
  };

  const addWatchlistItem = (item: Omit<WatchlistItem, 'id'>) => {
    const newItem: WatchlistItem = {
      ...item,
      id: generateId(),
    };
    setWatchlist(prev => [...prev, newItem]);
  };

  const removeWatchlistItem = (id: string) => {
    setWatchlist(prev => prev.filter(item => item.id !== id));
  };

  const importFromCSV = (csvData: string): { success: number; errors: string[] } => {
    const lines = csvData.trim().split('\n');
    const errors: string[] = [];
    let success = 0;

    // Skip header row
    const dataLines = lines.slice(1);

    const newAssets: Asset[] = [];

    dataLines.forEach((line, index) => {
      try {
        const values = line.split(';').map(v => v.trim());
        
        if (values.length < 6) {
          errors.push(`Zeile ${index + 2}: Nicht genügend Spalten`);
          return;
        }

        const [name, symbol, type, quantity, purchasePrice, currentPrice, purchaseDate, notes] = values;

        const newAsset: Asset = {
          id: generateId(),
          name: name || 'Unbekannt',
          symbol: symbol || '???',
          type: mapTypeFromBackup(type),
          quantity: parseFloat(quantity.replace(',', '.')) || 0,
          purchasePrice: parseFloat(purchasePrice.replace(',', '.')) || 0,
          currentPrice: parseFloat(currentPrice.replace(',', '.')) || 0,
          purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
          notes: notes || undefined,
        };

        newAssets.push(newAsset);
        success++;
      } catch (e) {
        errors.push(`Zeile ${index + 2}: Fehler beim Parsen`);
      }
    });

    if (newAssets.length > 0) {
      setAssets(prev => [...prev, ...newAssets]);
    }

    return { success, errors };
  };

  const importFromJSON = (jsonData: string): { success: number; errors: string[] } => {
    const errors: string[] = [];
    let success = 0;

    try {
      const data: BackupFormat = JSON.parse(jsonData);

      if (!data.portfolio || !Array.isArray(data.portfolio)) {
        errors.push('Ungültiges Backup-Format: Portfolio-Array nicht gefunden');
        return { success, errors };
      }

      const newAssets: Asset[] = [];

      data.portfolio.forEach((item, index) => {
        try {
          // Calculate current price from value and amount
          const currentPrice = item.amount > 0 ? item.value / item.amount : item.buyPrice;

          const newAsset: Asset = {
            id: generateId(),
            name: item.name || 'Unbekannt',
            symbol: item.ticker || item.wkn || '???',
            wkn: item.wkn,
            ticker: item.ticker,
            type: mapTypeFromBackup(item.type),
            category: item.category,
            quantity: item.amount || 0,
            purchasePrice: item.buyPrice || 0,
            currentPrice: currentPrice,
            purchaseDate: new Date().toISOString().split('T')[0],
            status: item.status as Asset['status'],
            autoUpdate: item.autoUpdate,
          };

          newAssets.push(newAsset);
          success++;
        } catch (e) {
          errors.push(`Position ${index + 1} (${item.name}): Fehler beim Parsen`);
        }
      });

      // Import watchlist if available
      if (data.watchlist && Array.isArray(data.watchlist)) {
        const newWatchlistItems: WatchlistItem[] = data.watchlist.map(item => ({
          id: generateId(),
          ticker: item.ticker,
          name: item.name,
          price: item.price,
          changePercent: item.changePercent,
          currency: item.currency || 'EUR',
          targetPrice: item.targetPrice,
          notes: item.notes,
        }));
        setWatchlist(prev => [...prev, ...newWatchlistItems]);
      }

      if (newAssets.length > 0) {
        // Replace all assets with imported ones
        setAssets(newAssets);
      }

      return { success, errors };
    } catch (e) {
      errors.push('JSON konnte nicht geparst werden. Bitte überprüfen Sie das Format.');
      return { success, errors };
    }
  };

  const exportToCSV = (): string => {
    const header = 'Name;Symbol;Typ;Anzahl;Kaufpreis;Aktueller Preis;Kaufdatum;Notizen';
    const rows = assets.map(asset => 
      `${asset.name};${asset.symbol};${mapTypeToGerman(asset.type)};${asset.quantity.toString().replace('.', ',')};${asset.purchasePrice.toString().replace('.', ',')};${asset.currentPrice.toString().replace('.', ',')};${asset.purchaseDate};${asset.notes || ''}`
    );
    return [header, ...rows].join('\n');
  };

  const exportToJSON = (): string => {
    const backup: BackupFormat = {
      timestamp: new Date().toISOString(),
      dashboard: { title: null },
      portfolio: assets.map(asset => ({
        wkn: asset.wkn || '',
        ticker: asset.ticker || asset.symbol,
        name: asset.name,
        type: mapTypeToGerman(asset.type),
        category: asset.category || mapTypeToGerman(asset.type),
        amount: asset.quantity,
        buyPrice: asset.purchasePrice,
        value: asset.quantity * asset.currentPrice,
        performance: asset.purchasePrice > 0 
          ? ((asset.currentPrice - asset.purchasePrice) / asset.purchasePrice) * 100 
          : 0,
        status: asset.status || 'Halten',
        autoUpdate: asset.autoUpdate ?? true,
      })),
      watchlist: watchlist.map(item => ({
        ticker: item.ticker,
        name: item.name,
        price: item.price,
        changePercent: item.changePercent,
        currency: item.currency,
        targetPrice: item.targetPrice,
        notes: item.notes,
      })),
      notes: { text: null, links: [] },
      report: null,
      settings: { manualPriceMode: 'false' },
    };
    return JSON.stringify(backup, null, 2);
  };

  const clearAllData = () => {
    setAssets([]);
    setWatchlist([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WATCHLIST_KEY);
  };

  return (
    <PortfolioContext.Provider value={{
      assets,
      watchlist,
      stats,
      addAsset,
      updateAsset,
      deleteAsset,
      addWatchlistItem,
      removeWatchlistItem,
      importFromCSV,
      importFromJSON,
      exportToCSV,
      exportToJSON,
      clearAllData,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
