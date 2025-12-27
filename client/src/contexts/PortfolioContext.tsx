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
  targetPrice?:

 number;
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
    currentPrice?: number;
    value?: number;
    performance?: number;
    status?: string;
    autoUpdate?: boolean;
    notes?: string;
  }>;
  watchlist?: Array<{
    ticker: string;
    name: string;
    currentPrice?: number;
    price?: number;
    changePercent?: number;
    currency?: string;
    targetPrice?: number;
    notes?: string;
  }>;
  notes?: { text: string | null; links: string[] };
  report?: string | null;
  settings?: { manualPriceMode?: string };
}

interface

 PortfolioContextType {
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
    'akt

ie': 'stock',
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
  let bestGainPercent = -

Infinity;
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
  const totalGainPercent = totalIn

Generation cancelled
