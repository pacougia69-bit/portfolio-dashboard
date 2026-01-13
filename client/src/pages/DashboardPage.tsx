/**
 * Dashboard Page - Finanzplaner
 * Übersicht mit Gesamtvermögen, Charts, Risiko-Warnung, Action Items
 */

import { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import {
  Wallet, TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3,
  AlertTriangle, ArrowRight, Briefcase, Coins, Target,
  ArrowUpRight, ArrowDownRight, Clock, RefreshCw, Bot, Settings
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';

const COLORS = [
  'oklch(0.75 0.15 195)', // cyan
  'oklch(0.65 0.18 145)', // green
  'oklch(0.70 0.15 60)',  // orange
  'oklch(0.55 0.2 280)',  // purple
  'oklch(0.65 0.18 220)', // blue
  'oklch(0.60 0.2 30)',   // red
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

// Settings interface
interface DashboardSettings {
  targetSum: number;
  desiredPension: number;
}

const DEFAULT_SETTINGS: DashboardSettings = {
  targetSum: 180000,
  desiredPension: 1000,
};

// LocalStorage helpers
const SETTINGS_KEY = 'dashboard-settings';

const loadSettings = (): DashboardSettings => {
  // Check if localStorage is available (client-side only)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: DashboardSettings) => {
  // Check if localStorage is available (client-side only)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();

  // Settings state
  const [settings, setSettings] = useState<DashboardSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<DashboardSettings>(settings);

  // Available capital for investment suggestions
  const [availableCapital, setAvailableCapital] = useState<number>(0);

  // Save settings to localStorage when changed
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  
  // Fetch data from backend
  const { data: portfolio = [], isLoading: portfolioLoading, refetch: refetchPortfolio } = trpc.portfolio.list.useQuery();
  const { data: dividends = [], isLoading: dividendsLoading } = trpc.dividends.list.useQuery({});
  
  // Check if Twelve Data API key is configured
  const { data: apiKeyStatus } = trpc.prices.hasApiKey.useQuery();
  
  // Fetch live prices mutation (Twelve Data)
  const fetchPricesTwelveData = trpc.prices.fetchTwelveData.useMutation({
    onSuccess: (data) => {
      const msg = data.skippedCount > 0 
        ? `${data.updatedCount} Kurse aktualisiert, ${data.skippedCount} manuelle übersprungen (Twelve Data)`
        : `${data.updatedCount} Kurse aktualisiert (Twelve Data)`;
      toast.success(msg);
      refetchPortfolio();
    },
    onError: (error) => {
      toast.error("Fehler beim Abrufen der Kurse: " + error.message);
    },
  });
  
  // Fallback: Yahoo Finance
  const fetchPricesYahoo = trpc.prices.fetch.useMutation({
    onSuccess: (data) => {
      const msg = data.skippedCount > 0 
        ? `${data.updatedCount} Kurse aktualisiert, ${data.skippedCount} manuelle übersprungen (Yahoo)`
        : `${data.updatedCount} Kurse aktualisiert (Yahoo)`;
      toast.success(msg);
      refetchPortfolio();
    },
    onError: (error) => {
      toast.error("Fehler beim Abrufen der Kurse: " + error.message);
    },
  });
  
  // Calculate stats with 3-pillar system
  const stats = useMemo(() => {
    const totalValue = portfolio.reduce((sum, p) => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      return sum + value;
    }, 0);

    const totalInvested = portfolio.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    // Group by pillar (A, B, C)
    let pillarA = 0;
    let pillarB = 0;
    let pillarC = 0;
    let msciWorldValue = 0;
    let emergingMarketsValue = 0;

    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      const pillar = p.category?.toUpperCase();

      if (pillar === 'A') {
        pillarA += value;
      } else if (pillar === 'B') {
        pillarB += value;
      } else if (pillar === 'C') {
        pillarC += value;
      } else {
        // Default uncategorized to pillar A for now
        pillarA += value;
      }

      // Identify MSCI World and Emerging Markets within Pillar A
      const name = p.name.toLowerCase();
      const ticker = p.ticker.toLowerCase();
      if (name.includes('msci world') || ticker.includes('msci world') || name.includes('world') && name.includes('etf')) {
        msciWorldValue += value;
      }
      if (name.includes('emerging') || name.includes('em ') || ticker.includes('em ')) {
        emergingMarketsValue += value;
      }
    });

    // Group by type
    const assetsByType: Record<string, number> = {};
    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      assetsByType[p.type] = (assetsByType[p.type] || 0) + value;
    });

    // Group by category (old grouping, keeping for compatibility)
    const assetsByCategory: Record<string, number> = {};
    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      const category = p.category || 'Sonstige';
      assetsByCategory[category] = (assetsByCategory[category] || 0) + value;
    });

    // Rebalancing calculations
    const targetPillarA = totalValue * 0.80; // 80%
    const targetPillarB = totalValue * 0.05; // 5%
    const targetPillarC = totalValue * 0.15; // 15%
    const targetMSCIWorld = totalValue * 0.60; // 60% of total portfolio
    const targetEM = totalValue * 0.20; // 20% of total portfolio

    const rebalancing = {
      pillarA: {
        current: pillarA,
        target: targetPillarA,
        diff: pillarA - targetPillarA,
        diffPercent: totalValue > 0 ? ((pillarA / totalValue) * 100) - 80 : 0,
      },
      pillarB: {
        current: pillarB,
        target: targetPillarB,
        diff: pillarB - targetPillarB,
        diffPercent: totalValue > 0 ? ((pillarB / totalValue) * 100) - 5 : 0,
      },
      pillarC: {
        current: pillarC,
        target: targetPillarC,
        diff: pillarC - targetPillarC,
        diffPercent: totalValue > 0 ? ((pillarC / totalValue) * 100) - 15 : 0,
      },
      msciWorld: {
        current: msciWorldValue,
        target: targetMSCIWorld,
        diff: msciWorldValue - targetMSCIWorld,
        diffPercent: totalValue > 0 ? ((msciWorldValue / totalValue) * 100) - 60 : 0,
      },
      emergingMarkets: {
        current: emergingMarketsValue,
        target: targetEM,
        diff: emergingMarketsValue - targetEM,
        diffPercent: totalValue > 0 ? ((emergingMarketsValue / totalValue) * 100) - 20 : 0,
      },
    };

    return {
      totalWealth: totalValue,
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      pillarA,
      pillarB,
      pillarC,
      assetsByType,
      assetsByCategory,
      rebalancing,
    };
  }, [portfolio]);

  // Investment suggestions based on available capital - focused on individual ETFs
  const investmentSuggestions = useMemo(() => {
    if (availableCapital <= 0 || stats.totalValue === 0) {
      return [];
    }

    // Define target allocations for specific ETFs (% of total portfolio)
    const targetAllocations: Record<string, number> = {
      'MSCI World': 0.60, // 60% of total portfolio
      'Emerging Markets': 0.20, // 20% of total portfolio
      'EM': 0.20, // Alternative name for Emerging Markets
    };

    // Track which ETF types we've found and their values
    let msciWorldFound = false;
    let emergingMarketsFound = false;
    let msciWorldValue = 0;
    let emergingMarketsValue = 0;

    // Find matching ETFs in portfolio and calculate their deficits
    const etfDeficits: Array<{
      name: string;
      ticker: string;
      currentValue: number;
      targetValue: number;
      deficit: number;
      currentPercent: number;
      targetPercent: number;
      priority: number;
    }> = [];

    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      const name = p.name;
      const nameLower = name.toLowerCase();
      const tickerLower = p.ticker.toLowerCase();

      // Check if this is a MSCI World ETF
      if (nameLower.includes('msci world') || tickerLower.includes('msci world') ||
          (nameLower.includes('world') && nameLower.includes('etf'))) {
        msciWorldFound = true;
        msciWorldValue = value;
        const targetValue = stats.totalValue * targetAllocations['MSCI World'];
        const deficit = targetValue - value;
        if (deficit > 0) {
          etfDeficits.push({
            name: name,
            ticker: p.ticker,
            currentValue: value,
            targetValue: targetValue,
            deficit: deficit,
            currentPercent: (value / stats.totalValue) * 100,
            targetPercent: targetAllocations['MSCI World'] * 100,
            priority: 1,
          });
        }
      }

      // Check if this is an Emerging Markets ETF
      else if (nameLower.includes('emerging') || nameLower.includes('em ') ||
               tickerLower.includes('em ') || nameLower.includes('schwellenländer')) {
        emergingMarketsFound = true;
        emergingMarketsValue = value;
        const targetValue = stats.totalValue * targetAllocations['Emerging Markets'];
        const deficit = targetValue - value;
        if (deficit > 0) {
          etfDeficits.push({
            name: name,
            ticker: p.ticker,
            currentValue: value,
            targetValue: targetValue,
            deficit: deficit,
            currentPercent: (value / stats.totalValue) * 100,
            targetPercent: targetAllocations['Emerging Markets'] * 100,
            priority: 1,
          });
        }
      }

      // Check for crypto assets in Pillar B
      else if (p.category?.toUpperCase() === 'B' || p.type === 'Krypto') {
        // For crypto, we check if Pillar B overall is under 5%
        const pillarBPercent = (stats.pillarB / stats.totalValue) * 100;
        if (pillarBPercent < 5) {
          const targetValueForB = stats.totalValue * 0.05;
          const currentB = stats.pillarB;
          const deficitB = targetValueForB - currentB;

          // Only add this crypto if we haven't added one yet
          if (deficitB > 0 && !etfDeficits.some(d => d.name.includes('Krypto'))) {
            etfDeficits.push({
              name: name,
              ticker: p.ticker,
              currentValue: currentB,
              targetValue: targetValueForB,
              deficit: deficitB,
              currentPercent: pillarBPercent,
              targetPercent: 5,
              priority: 2,
            });
          }
        }
      }
    });

    // Check if all primary ETF targets are actually met (not just not found)
    const msciWorldTargetMet = msciWorldFound && msciWorldValue >= stats.totalValue * targetAllocations['MSCI World'];
    const emTargetMet = emergingMarketsFound && emergingMarketsValue >= stats.totalValue * targetAllocations['Emerging Markets'];

    // Only return empty if both primary ETFs exist AND meet their targets
    if (etfDeficits.length === 0 && msciWorldTargetMet && emTargetMet) {
      return [];
    }

    // If we have no deficits but ETFs don't meet targets (edge case), return empty for now
    if (etfDeficits.length === 0) {
      return [];
    }

    // Sort by priority (1 = highest), then by deficit
    etfDeficits.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.deficit - a.deficit;
    });

    // Calculate total deficit
    const totalDeficit = etfDeficits.reduce((sum, d) => sum + d.deficit, 0);

    // Distribute available capital proportionally to deficits
    const suggestions = etfDeficits.map(d => {
      const proportion = d.deficit / totalDeficit;
      const suggestedAmount = Math.min(
        Math.round(availableCapital * proportion),
        d.deficit
      );
      return {
        name: d.name,
        ticker: d.ticker,
        amount: suggestedAmount,
        deficit: d.deficit,
        currentPercent: d.currentPercent,
        targetPercent: d.targetPercent,
      };
    });

    // Adjust if total suggested exceeds available capital
    const totalSuggested = suggestions.reduce((sum, s) => sum + s.amount, 0);
    if (totalSuggested > availableCapital) {
      const ratio = availableCapital / totalSuggested;
      suggestions.forEach(s => {
        s.amount = Math.round(s.amount * ratio);
      });
    }

    return suggestions.filter(s => s.amount > 0);
  }, [availableCapital, stats, portfolio]);

  // Dividend stats
  const dividendStats = useMemo(() => {
    const thisYear = dividends.reduce((sum, d) => sum + d.amount, 0);
    return { thisYear, expectedAnnual: thisYear * 1.1 };
  }, [dividends]);
  
  // Prepare chart data
  const allocationData = Object.entries(stats.assetsByType)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  const categoryData = Object.entries(stats.assetsByCategory)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Top performers
  const topPerformers = useMemo(() => {
    return [...portfolio]
      .map(p => ({
        ...p,
        performance: p.currentPrice ? ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0,
      }))
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5);
  }, [portfolio]);

  const worstPerformers = useMemo(() => {
    return [...portfolio]
      .map(p => ({
        ...p,
        performance: p.currentPrice ? ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0,
      }))
      .sort((a, b) => a.performance - b.performance)
      .slice(0, 5);
  }, [portfolio]);

  // Action items based on status
  const actionItems = portfolio.filter(a => a.status === 'Kaufen' || a.status === 'Verkaufen').slice(0, 5);

  // Risk categories
  const riskyAssets = portfolio.filter(a => 
    a.category === 'Biotech' || a.category === 'Krypto' || a.type === 'Krypto'
  );
  const riskyValue = riskyAssets.reduce((sum, a) => {
    const value = a.currentPrice ? a.amount * a.currentPrice : a.amount * a.buyPrice;
    return sum + value;
  }, 0);
  const riskPercent = stats.totalValue > 0 ? (riskyValue / stats.totalValue) * 100 : 0;
  
  // Handle refresh prices - prefer Twelve Data if API key is configured
  const handleRefreshPrices = () => {
    const tickers = portfolio.map(p => p.ticker);
    if (tickers.length > 0) {
      if (apiKeyStatus?.hasKey) {
        fetchPricesTwelveData.mutate({ tickers });
      } else {
        fetchPricesYahoo.mutate({ tickers });
      }
    }
  };
  
  const isRefreshing = fetchPricesTwelveData.isPending || fetchPricesYahoo.isPending;

  const isLoading = portfolioLoading || dividendsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-12 sm:pt-0">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Übersicht Ihrer Finanzen</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="touch-target text-xs sm:text-sm"
                >
                  <Settings className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Einstellungen</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Dashboard Einstellungen</DialogTitle>
                  <DialogDescription>
                    Passen Sie Ihre Rentenziele an
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="targetSum">Zielsumme (€)</Label>
                    <Input
                      id="targetSum"
                      type="number"
                      value={tempSettings.targetSum}
                      onChange={(e) => setTempSettings({ ...tempSettings, targetSum: Number(e.target.value) })}
                      placeholder="180000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Benötigtes Kapital für Ihre Zusatzrente
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desiredPension">Wunsch-Rente (€/Monat)</Label>
                    <Input
                      id="desiredPension"
                      type="number"
                      value={tempSettings.desiredPension}
                      onChange={(e) => setTempSettings({ ...tempSettings, desiredPension: Number(e.target.value) })}
                      placeholder="1000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Monatliche Zusatzrente (bei 4% Entnahmerate)
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTempSettings(settings);
                      setSettingsOpen(false);
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => {
                      setSettings(tempSettings);
                      setSettingsOpen(false);
                      toast.success('Einstellungen gespeichert');
                    }}
                  >
                    Speichern
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshPrices}
              disabled={isRefreshing}
              className="touch-target text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Kurse </span>aktualisieren
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setLocation('/ki-assistent')}
              className="touch-target text-xs sm:text-sm"
            >
              <Bot className="w-4 h-4 mr-1 sm:mr-2" />
              KI-Analyse
            </Button>
          </div>
        </div>

        {/* Net Worth - Ganz oben */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card border-2 border-primary/30">
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-base text-muted-foreground">Gesamtvermögen (Net Worth)</p>
                  <p className="font-mono text-3xl sm:text-5xl font-bold mt-2 text-primary">
                    {formatCurrency(stats.totalWealth)}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <Badge variant={stats.totalGainPercent >= 0 ? 'default' : 'destructive'} className="font-mono text-base px-3 py-1">
                      {formatPercent(stats.totalGainPercent)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {stats.totalGain >= 0 ? '+' : ''}{formatCurrency(stats.totalGain)}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Fortschrittsbalken Säule A - Rentenziel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card border-2 border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg text-green-400">Säule A - Rentenbasis</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Ziel: {formatCurrency(settings.desiredPension)} monatliche Zusatzrente
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl sm:text-2xl font-bold text-green-400">
                      {formatCurrency(stats.pillarA)}
                    </p>
                    <p className="text-xs text-muted-foreground">von {formatCurrency(settings.targetSum)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress
                    value={(stats.pillarA / settings.targetSum) * 100}
                    className="h-4 bg-green-950"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{((stats.pillarA / settings.targetSum) * 100).toFixed(1)}% erreicht</span>
                    <span>{formatCurrency(settings.targetSum - stats.pillarA)} verbleibend</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rebalancing-Empfehlung */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="glass-card border-2 border-cyan-500/30 bg-cyan-500/5">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg text-cyan-400">Rebalancing-Empfehlung</h3>
                    <p className="text-xs text-muted-foreground">Zielallokation: A(80%), B(5%), C(15%) | MSCI World(60%), EM(20%)</p>
                  </div>
                </div>

                {/* Check for underrepresented areas */}
                {(() => {
                  const underrepresented = [];

                  if (stats.rebalancing.pillarA.diff < 0) {
                    underrepresented.push({
                      name: 'Säule A (Renten-Basis)',
                      current: stats.rebalancing.pillarA.current,
                      target: stats.rebalancing.pillarA.target,
                      diff: stats.rebalancing.pillarA.diff,
                      diffPercent: stats.rebalancing.pillarA.diffPercent,
                      targetPercent: 80,
                    });
                  }

                  if (stats.rebalancing.pillarB.diff < 0) {
                    underrepresented.push({
                      name: 'Säule B (Krypto)',
                      current: stats.rebalancing.pillarB.current,
                      target: stats.rebalancing.pillarB.target,
                      diff: stats.rebalancing.pillarB.diff,
                      diffPercent: stats.rebalancing.pillarB.diffPercent,
                      targetPercent: 5,
                    });
                  }

                  if (stats.rebalancing.pillarC.diff < 0) {
                    underrepresented.push({
                      name: 'Säule C (Zocker/Verkauf)',
                      current: stats.rebalancing.pillarC.current,
                      target: stats.rebalancing.pillarC.target,
                      diff: stats.rebalancing.pillarC.diff,
                      diffPercent: stats.rebalancing.pillarC.diffPercent,
                      targetPercent: 15,
                    });
                  }

                  if (stats.rebalancing.msciWorld.diff < 0) {
                    underrepresented.push({
                      name: 'MSCI World ETF',
                      current: stats.rebalancing.msciWorld.current,
                      target: stats.rebalancing.msciWorld.target,
                      diff: stats.rebalancing.msciWorld.diff,
                      diffPercent: stats.rebalancing.msciWorld.diffPercent,
                      targetPercent: 60,
                    });
                  }

                  if (stats.rebalancing.emergingMarkets.diff < 0) {
                    underrepresented.push({
                      name: 'Emerging Markets ETF',
                      current: stats.rebalancing.emergingMarkets.current,
                      target: stats.rebalancing.emergingMarkets.target,
                      diff: stats.rebalancing.emergingMarkets.diff,
                      diffPercent: stats.rebalancing.emergingMarkets.diffPercent,
                      targetPercent: 20,
                    });
                  }

                  if (underrepresented.length === 0) {
                    return (
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-sm text-green-400 font-medium">
                          ✓ Portfolio ist ausgewogen! Keine Rebalancing-Maßnahmen erforderlich.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {underrepresented.map((item, index) => (
                        <div key={index} className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-cyan-300 text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Ist: {((item.current / stats.totalValue) * 100).toFixed(1)}% ({formatCurrency(item.current)})
                                {' → '}
                                Soll: {item.targetPercent}% ({formatCurrency(item.target)})
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                                {formatCurrency(Math.abs(item.diff))}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">zu investieren</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Investment-Vorschläge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card border-2 border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base sm:text-lg text-purple-400">Investment-Vorschläge</h3>
                    <p className="text-xs text-muted-foreground">Optimale Verteilung Ihres verfügbaren Kapitals</p>
                  </div>
                </div>

                {/* Available Capital Input */}
                <div className="space-y-2">
                  <Label htmlFor="availableCapital" className="text-sm font-medium">
                    Verfügbares Kapital (€)
                  </Label>
                  <Input
                    id="availableCapital"
                    type="number"
                    min="0"
                    step="100"
                    value={availableCapital || ''}
                    onChange={(e) => setAvailableCapital(Number(e.target.value) || 0)}
                    placeholder="1350"
                    className="text-lg font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Monatliche Sparrate oder Einmalanlage
                  </p>
                </div>

                {/* Investment Suggestions - Concrete Purchase List */}
                {availableCapital > 0 && investmentSuggestions.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-sm pb-2 border-b border-purple-500/20">
                      <span className="font-semibold text-purple-300">Kaufempfehlungen</span>
                      <span className="font-semibold text-purple-300">
                        Gesamt: {formatCurrency(investmentSuggestions.reduce((sum, s) => sum + s.amount, 0))}
                      </span>
                    </div>
                    {investmentSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
                      >
                        <div className="space-y-2">
                          {/* Main buy recommendation */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-purple-200 text-sm leading-tight">
                                Kauf {suggestion.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                WKN: {suggestion.ticker}
                              </p>
                            </div>
                            <Badge variant="outline" className="bg-purple-500/30 text-purple-100 border-purple-400/40 text-base font-mono font-bold shrink-0">
                              {formatCurrency(suggestion.amount)}
                            </Badge>
                          </div>

                          {/* Progress and percentage info */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Progress
                                value={(suggestion.currentPercent / suggestion.targetPercent) * 100}
                                className="h-1.5 flex-1 bg-purple-950"
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {suggestion.currentPercent.toFixed(1)}% → {suggestion.targetPercent.toFixed(0)}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Aktuell {suggestion.currentPercent.toFixed(1)}% vom Portfolio, Ziel: {suggestion.targetPercent.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : availableCapital > 0 ? (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-400 font-medium text-center">
                      ✓ Portfolio ist optimal allokiert!
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Alle ETFs haben ihre Zielgewichtung erreicht
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground text-center">
                      Geben Sie Ihr verfügbares Kapital ein, um konkrete Kaufempfehlungen zu erhalten
                    </p>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      Empfehlung: {formatCurrency(1350)} (monatliche Sparrate)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3-Säulen Übersicht */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card border-green-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-green-400 font-semibold truncate">Säule A - Renten-Basis</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold mt-2 truncate">
                      {formatCurrency(stats.pillarA)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      ETFs + Behalten-Aktien
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Target className="w-5 h-5 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card border-blue-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-blue-400 font-semibold truncate">Säule B - Krypto</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold mt-2 truncate">
                      {formatCurrency(stats.pillarB)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      BTC, ETH, SOL, ICP
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="glass-card border-amber-500/30">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-amber-400 font-semibold truncate">Säule C - Zocker/Verkauf</p>
                    <p className="font-mono text-xl sm:text-2xl font-bold mt-2 truncate">
                      {formatCurrency(stats.pillarC)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Biotech-Werte
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Stats Cards - Zusätzliche Infos */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Depot-Wert</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold mt-1 truncate">
                      {formatCurrency(stats.totalValue)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                      {portfolio.length} Positionen
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-4 h-4 sm:w-6 sm:h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Gewinn/Verlust</p>
                    <p className={`font-mono text-lg sm:text-2xl font-bold mt-1 truncate ${stats.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(stats.totalGain)}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {stats.totalGain >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                      )}
                      <span className={`text-xs sm:text-sm ${stats.totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(stats.totalGainPercent)}
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${stats.totalGain >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {stats.totalGain >= 0 ? (
                      <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Dividenden {new Date().getFullYear()}</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold mt-1 text-amber-400 truncate">
                      {formatCurrency(dividendStats.thisYear)}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 truncate">
                      Erwartet: {formatCurrency(dividendStats.expectedAnnual)}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Risk Warning */}
        {riskPercent > 30 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-amber-400 text-sm sm:text-base">Risiko-Warnung</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Ihr Portfolio enthält {riskPercent.toFixed(0)}% risikoreiche Positionen (Biotech, Krypto).
                      <span className="hidden sm:inline"> Empfohlen sind maximal 30% für eine ausgewogene Diversifikation.</span>
                    </p>
                    <Progress value={riskPercent} className="mt-3 h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Allocation Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="glass-card">
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Allokation nach Typ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {allocationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {allocationData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'oklch(0.15 0.01 285)',
                          border: '1px solid oklch(0.3 0.01 285)',
                          borderRadius: '8px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Keine Daten vorhanden
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Category Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="glass-card">
              <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Top Kategorien
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 285)" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} stroke="oklch(0.5 0.01 285)" />
                      <YAxis type="category" dataKey="name" width={80} stroke="oklch(0.5 0.01 285)" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'oklch(0.15 0.01 285)',
                          border: '1px solid oklch(0.3 0.01 285)',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="value" fill="oklch(0.75 0.15 195)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Keine Daten vorhanden
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Top/Worst Performers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <TrendingUp className="w-5 h-5" />
                Top Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topPerformers.map((asset, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-green-500/5">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">{asset.ticker}</p>
                    </div>
                    <Badge variant="default" className="bg-green-500/20 text-green-400">
                      {formatPercent(asset.performance)}
                    </Badge>
                  </div>
                ))}
                {topPerformers.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">Keine Daten</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <TrendingDown className="w-5 h-5" />
                Schlechteste Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {worstPerformers.map((asset, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-red-500/5">
                    <div>
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">{asset.ticker}</p>
                    </div>
                    <Badge variant="destructive" className="bg-red-500/20 text-red-400">
                      {formatPercent(asset.performance)}
                    </Badge>
                  </div>
                ))}
                {worstPerformers.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">Keine Daten</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Nächste Schritte
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actionItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={item.status === 'Kaufen' ? 'default' : 'destructive'}>
                        {item.status}
                      </Badge>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.ticker}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setLocation('/portfolio')}>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
