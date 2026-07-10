/**
 * Dashboard Page - Finanzplaner
 * Übersicht mit Gesamtvermögen, Charts, Risiko-Warnung, Action Items
 */

import { useMemo, useState, useEffect, useRef } from 'react';
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
import { DEFAULT_TARGET_ALLOCATIONS } from '@shared/strategy';
import {
  Wallet, TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3,
  AlertTriangle, ArrowRight, Briefcase, Coins, Target,
  ArrowUpRight, ArrowDownRight, Clock, RefreshCw, Bot, Settings
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, ComposedChart, Legend,
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

// Rentenziel lag frueher nur im Browser (localStorage) - dadurch auf jedem
// Geraet ein anderer Wert. LEGACY_KEY wird nur noch fuer die einmalige
// Migration eines eventuell vorhandenen alten Werts in die Datenbank gelesen.
const LEGACY_SETTINGS_KEY = 'dashboard-settings';

const readLegacyLocalSettings = (): Partial<DashboardSettings> | null => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LEGACY_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export default function DashboardPage() {
  const [, setLocation] = useLocation();

  // Rentenziel-Einstellungen - Wert kommt aus der Datenbank (siehe useEffect
  // unten), vorher nur in localStorage und dadurch pro Geraet unterschiedlich.
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const migratedLegacyRef = useRef(false);

  // Available capital for investment suggestions
  const [availableCapital, setAvailableCapital] = useState<number>(0);

  // Fetch data from backend
  const { data: portfolio = [], isLoading: portfolioLoading, refetch: refetchPortfolio } = trpc.portfolio.list.useQuery();
  const { data: dividends = [], isLoading: dividendsLoading } = trpc.dividends.list.useQuery({});
  const { data: taxSettings } = trpc.tax.getSettings.useQuery();
  const { data: taxSources = [] } = trpc.tax.listSources.useQuery();
  const { data: totalExemptionData } = trpc.tax.getTotalExemption.useQuery();
  const totalExemptionOrder = totalExemptionData?.total || 0;

  // Rentenziel aus der Datenbank laden; falls dort noch nichts steht, einmalig
  // einen eventuell vorhandenen alten localStorage-Wert dorthin uebernehmen.
  const { data: userSettingsData } = trpc.settings.get.useQuery();
  const saveDashboardSettings = trpc.settings.save.useMutation();

  useEffect(() => {
    if (!userSettingsData) return;
    const hasDbValue = userSettingsData.retirementTargetSum !== null || userSettingsData.desiredPension !== null;
    if (hasDbValue) {
      const loaded: DashboardSettings = {
        targetSum: userSettingsData.retirementTargetSum ?? DEFAULT_SETTINGS.targetSum,
        desiredPension: userSettingsData.desiredPension ?? DEFAULT_SETTINGS.desiredPension,
      };
      setSettings(loaded);
      setTempSettings(loaded);
    } else if (!migratedLegacyRef.current) {
      migratedLegacyRef.current = true;
      const legacy = readLegacyLocalSettings();
      if (legacy && (legacy.targetSum !== undefined || legacy.desiredPension !== undefined)) {
        const merged: DashboardSettings = { ...DEFAULT_SETTINGS, ...legacy };
        setSettings(merged);
        setTempSettings(merged);
        saveDashboardSettings.mutate({
          retirementTargetSum: merged.targetSum,
          desiredPension: merged.desiredPension,
        });
      }
    }
  }, [userSettingsData]);
  
  // Check if Twelve Data API key is configured
  const { data: apiKeyStatus } = trpc.prices.hasApiKey.useQuery();

  // Vermoegensverlauf: Snapshots laden + heutigen Stand nachtragen (kein Cron noetig)
  const { data: snapshots = [], refetch: refetchSnapshots } = trpc.snapshots.list.useQuery({});
  const recordSnapshot = trpc.snapshots.recordIfNeeded.useMutation({
    onSuccess: (data) => {
      if (data.created) refetchSnapshots();
    },
  });
  const snapshotRecordedRef = useRef(false);
  
  // Fetch live prices mutation (Twelve Data) - wird in Häppchen aufgerufen,
  // siehe handleRefreshPrices. Erfolgsmeldung kommt erst dort, gesammelt.
  const fetchPricesTwelveData = trpc.prices.fetchTwelveData.useMutation();
  
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
  
  // Depot-Zielstruktur: kommt jetzt aus einer zentralen Quelle (shared/strategy.ts)
  // statt hier fest hinterlegt zu sein.
  // frozen = bewusste Wette, kein neues Geld — nie in Kaufempfehlungen aufnehmen
  const STRATEGY_TARGETS = DEFAULT_TARGET_ALLOCATIONS;

  // Calculate stats with Depot-Struktur 2026
  const stats = useMemo(() => {
    const totalValue = portfolio.reduce((sum, p) => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      return sum + value;
    }, 0);

    const totalInvested = portfolio.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    // Tax estimation
    const stockLossPot = taxSettings?.stockLossPot || 0;
    const otherLossPot = taxSettings?.otherLossPot || 0;

    let taxableGain = Math.max(0, totalGain);
    taxableGain = Math.max(0, taxableGain - stockLossPot - otherLossPot);
    taxableGain = Math.max(0, taxableGain - totalExemptionOrder);

    const taxRate = 0.26375;
    const estimatedTax = taxableGain * taxRate;
    const netGain = totalGain - estimatedTax;
    const netGainPercent = totalInvested > 0 ? (netGain / totalInvested) * 100 : 0;

    // Group by type
    const assetsByType: Record<string, number> = {};
    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      assetsByType[p.type] = (assetsByType[p.type] || 0) + value;
    });

    // Group by category
    const assetsByCategory: Record<string, number> = {};
    portfolio.forEach(p => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      const category = p.category || 'Sonstige';
      assetsByCategory[category] = (assetsByCategory[category] || 0) + value;
    });

    // Depot-Struktur 2026 Rebalancing
    const waveValues = STRATEGY_TARGETS.map(target => {
      const position = portfolio.find(p => p.wkn === target.wkn);
      const currentValue = position
        ? (position.currentPrice ? position.amount * position.currentPrice : position.amount * position.buyPrice)
        : 0;
      const targetValue = totalValue * (target.targetPercent / 100);
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

      return {
        name: target.name,
        wkn: target.wkn,
        frozen: target.frozen,
        current: currentValue,
        target: targetValue,
        diff: currentValue - targetValue,
        currentPercent,
        targetPercent: target.targetPercent,
        diffPercent: currentPercent - target.targetPercent,
      };
    });

    // ETF total (all waves combined)
    const etfTotal = waveValues.reduce((sum, w) => sum + w.current, 0);

    return {
      totalWealth: totalValue,
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      netGain,
      netGainPercent,
      estimatedTax,
      taxableGain,
      etfTotal,
      assetsByType,
      assetsByCategory,
      waveValues,
    };
  }, [portfolio, taxSettings, totalExemptionOrder, STRATEGY_TARGETS]);

  // Einmal pro Seitenaufruf den heutigen Depotwert als Snapshot nachtragen -
  // der Server verhindert per Unique-Constraint ohnehin mehr als einen Eintrag
  // pro Tag, der Ref hier spart nur den unnoetigen zusaetzlichen Aufruf.
  useEffect(() => {
    if (!snapshotRecordedRef.current && !portfolioLoading && stats.totalValue > 0) {
      snapshotRecordedRef.current = true;
      recordSnapshot.mutate({ totalValue: stats.totalValue, totalInvested: stats.totalInvested });
    }
  }, [portfolioLoading, stats.totalValue, stats.totalInvested]);

  // Investment suggestions based on Depot-Struktur 2026
  const investmentSuggestions = useMemo(() => {
    if (availableCapital <= 0 || stats.totalValue === 0) {
      return [];
    }

    // Find underweight waves and distribute capital proportionally
    // (frozen = eingefrorene Wetten bekommen nie Kaufempfehlungen)
    const underweightWaves = stats.waveValues
      .filter(w => w.diff < 0 && !w.frozen)
      .sort((a, b) => a.diff - b.diff);

    if (underweightWaves.length === 0) {
      return [];
    }

    const totalDeficit = underweightWaves.reduce((sum, w) => sum + Math.abs(w.diff), 0);

    const suggestions = underweightWaves.map(w => {
      const proportion = Math.abs(w.diff) / totalDeficit;
      const suggestedAmount = Math.min(
        Math.round(availableCapital * proportion),
        Math.abs(w.diff)
      );
      return {
        name: w.name,
        ticker: w.wkn,
        amount: suggestedAmount,
        deficit: Math.abs(w.diff),
        currentPercent: w.currentPercent,
        targetPercent: w.targetPercent,
      };
    });

    const totalSuggested = suggestions.reduce((sum, s) => sum + s.amount, 0);
    if (totalSuggested > availableCapital) {
      const ratio = availableCapital / totalSuggested;
      suggestions.forEach(s => {
        s.amount = Math.round(s.amount * ratio);
      });
    }

    return suggestions.filter(s => s.amount > 0);
  }, [availableCapital, stats]);

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
  
  // Free-Plan-Limit bei Twelve Data: 8 Credits/Minute. Statt einer einzigen,
  // minutenlangen Server-Anfrage (Timeout-Risiko bei vielen Positionen) werden
  // hier mehrere KURZE Anfragen nacheinander geschickt, mit Pause dazwischen
  // im Browser - der Server haelt dabei nie eine Verbindung laenger offen.
  const TWELVE_DATA_CHUNK_SIZE = 7;
  const CHUNK_DELAY_MS = 62000;
  const [bulkRefreshProgress, setBulkRefreshProgress] = useState<{ done: number; total: number } | null>(null);

  const handleRefreshPrices = async () => {
    const tickers = portfolio.map(p => p.ticker);
    if (tickers.length === 0) return;

    if (!apiKeyStatus?.hasKey) {
      fetchPricesYahoo.mutate({ tickers });
      return;
    }

    const chunks: string[][] = [];
    for (let i = 0; i < tickers.length; i += TWELVE_DATA_CHUNK_SIZE) {
      chunks.push(tickers.slice(i, i + TWELVE_DATA_CHUNK_SIZE));
    }

    let totalUpdated = 0;
    let totalProxyFallback = 0;
    let totalSkipped = 0;
    let hadError = false;

    for (let i = 0; i < chunks.length; i++) {
      setBulkRefreshProgress({ done: i, total: chunks.length });
      try {
        const result = await fetchPricesTwelveData.mutateAsync({ tickers: chunks[i] });
        totalUpdated += result.updatedCount;
        totalProxyFallback += result.proxyFallbackCount;
        totalSkipped += result.skippedCount;
      } catch (error) {
        hadError = true;
        console.error('Chunk-Fehler beim Kurs-Update:', error);
      }
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
      }
    }

    setBulkRefreshProgress(null);
    const parts = [`${totalUpdated} Kurse aktualisiert`];
    if (totalProxyFallback > 0) parts.push(`${totalProxyFallback} davon über Yahoo`);
    if (totalSkipped > 0) parts.push(`${totalSkipped} übersprungen`);
    if (hadError) parts.push('einzelne Häppchen fehlgeschlagen - erneut versuchen');
    toast[hadError ? 'warning' : 'success'](parts.join(', '));
    refetchPortfolio();
  };

  const isRefreshing = fetchPricesTwelveData.isPending || fetchPricesYahoo.isPending || bulkRefreshProgress !== null;

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
                      saveDashboardSettings.mutate({
                        retirementTargetSum: tempSettings.targetSum,
                        desiredPension: tempSettings.desiredPension,
                      }, {
                        onSuccess: () => toast.success('Einstellungen gespeichert'),
                        onError: (error) => toast.error('Fehler beim Speichern: ' + error.message),
                      });
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
              title={bulkRefreshProgress ? `Häppchen ${bulkRefreshProgress.done + 1} von ${bulkRefreshProgress.total} - wegen Twelve-Data-Limit mit Pausen dazwischen` : undefined}
            >
              <RefreshCw className={`w-4 h-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">
                {bulkRefreshProgress ? `${bulkRefreshProgress.done + 1}/${bulkRefreshProgress.total}...` : 'Kurse aktualisieren'}
              </span>
              <span className="sm:hidden">{bulkRefreshProgress ? `${bulkRefreshProgress.done + 1}/${bulkRefreshProgress.total}` : 'aktualisieren'}</span>
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

        {/* Fortschrittsbalken ETF-Portfolio - Rentenziel */}
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
                    <h3 className="font-semibold text-base sm:text-lg text-green-400">ETF-Portfolio - Rentenbasis</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      Ziel: {formatCurrency(settings.desiredPension)} monatliche Zusatzrente
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xl sm:text-2xl font-bold text-green-400">
                      {formatCurrency(stats.etfTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">von {formatCurrency(settings.targetSum)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Progress
                    value={(stats.etfTotal / settings.targetSum) * 100}
                    className="h-4 bg-green-950"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{((stats.etfTotal / settings.targetSum) * 100).toFixed(1)}% erreicht</span>
                    <span>{formatCurrency(settings.targetSum - stats.etfTotal)} verbleibend</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rebalancing-Empfehlung - Depot-Struktur 2026 */}
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
                    <h3 className="font-semibold text-base sm:text-lg text-cyan-400">Rebalancing - Depot-Struktur 2026</h3>
                    <p className="text-xs text-muted-foreground">
                      {STRATEGY_TARGETS.map((t: { shortLabel?: string; name: string; targetPercent: number }) => `${t.shortLabel || t.name} ${t.targetPercent}%`).join(' | ')}
                    </p>
                  </div>
                </div>

                {(() => {
                  // Eingefrorene Wetten nie zum Nachkauf empfehlen
                  const underrepresented = stats.waveValues.filter(w => w.diff < 0 && !w.frozen);

                  if (underrepresented.length === 0) {
                    return (
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="text-sm text-green-400 font-medium">
                          Portfolio ist ausgewogen! Keine Rebalancing-Maßnahmen erforderlich.
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
                                Ist: {item.currentPercent.toFixed(1)}% ({formatCurrency(item.current)})
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
                    placeholder="1400"
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
                      Empfehlung: {formatCurrency(1400)} (monatliche Sparrate)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Depot-Struktur Übersicht (6 Bausteine) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {stats.waveValues.map((wave, index) => {
            const colors = [
              { border: 'border-green-500/30', text: 'text-green-400', bg: 'bg-green-500/10' },
              { border: 'border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/10' },
              { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10' },
              { border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/10' },
              { border: 'border-pink-500/30', text: 'text-pink-400', bg: 'bg-pink-500/10' },
              { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            ];
            const color = colors[index % colors.length];

            return (
              <motion.div
                key={wave.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card className={`glass-card ${color.border}`}>
                  <CardContent className="p-3 sm:p-4">
                    <p className={`text-xs font-semibold ${color.text} truncate`}>{wave.name}</p>
                    <p className="font-mono text-sm sm:text-lg font-bold mt-1 truncate">
                      {formatCurrency(wave.current)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {wave.currentPercent.toFixed(1)}% / {wave.targetPercent}%
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
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

          {/* Net Returns After Tax Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="glass-card border-blue-500/30">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate flex items-center gap-1">
                      Netto-Rendite (nach Steuern)
                    </p>
                    <p className={`font-mono text-lg sm:text-2xl font-bold mt-1 truncate ${stats.netGain >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {formatCurrency(stats.netGain)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs sm:text-sm ${stats.netGain >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatPercent(stats.netGainPercent)}
                      </span>
                      {stats.estimatedTax > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (Steuer: ~{formatCurrency(stats.estimatedTax)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${stats.netGain >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'}`}>
                    <Target className="w-4 h-4 sm:w-6 sm:h-6 text-blue-400" />
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

        {/* Vermögensverlauf */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="glass-card">
            <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Vermögensverlauf
              </CardTitle>
              {snapshots.length >= 1 && (
                <p className="text-xs sm:text-sm text-muted-foreground pl-6">
                  Aktuell: <span className="text-foreground font-medium">{formatCurrency(snapshots[snapshots.length - 1].totalValue)}</span>
                </p>
              )}
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {snapshots.length >= 2 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={snapshots.map((s, i) => ({
                    date: new Date(s.snapshotDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                    Depotwert: s.totalValue,
                    Zuwachs: i > 0 ? s.totalValue - snapshots[i - 1].totalValue : null,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 285)" />
                    <XAxis dataKey="date" stroke="oklch(0.5 0.01 285)" />
                    <YAxis
                      yAxisId="zuwachs"
                      tickFormatter={(v) => formatCurrency(v)}
                      stroke="oklch(0.5 0.01 285)"
                      width={80}
                    />
                    <YAxis
                      yAxisId="depotwert"
                      orientation="right"
                      domain={[(min: number) => Math.floor(min * 0.95), (max: number) => Math.ceil(max * 1.05)]}
                      tickFormatter={(v) => formatCurrency(v)}
                      stroke="oklch(0.75 0.15 195)"
                      width={80}
                    />
                    <Tooltip
                      formatter={(value: number | string | Array<number | string>) => value == null ? 'keine Vortagsdaten' : formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: 'oklch(0.15 0.01 285)',
                        border: '1px solid oklch(0.3 0.01 285)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="zuwachs" dataKey="Zuwachs" name="Zuwachs zum Vortag" radius={[4, 4, 0, 0]}>
                      {snapshots.map((s, i) => {
                        const zuwachs = i > 0 ? s.totalValue - snapshots[i - 1].totalValue : 0;
                        return (
                          <Cell key={`cell-${i}`} fill={zuwachs >= 0 ? 'oklch(0.65 0.18 145)' : 'oklch(0.60 0.2 30)'} />
                        );
                      })}
                    </Bar>
                    <Line yAxisId="depotwert" type="monotone" dataKey="Depotwert" name="Depotwert" stroke="oklch(0.75 0.15 195)" strokeWidth={2} dot={{ r: 3, fill: 'oklch(0.75 0.15 195)' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-center text-sm text-muted-foreground px-4">
                  Noch nicht genug Daten für einen Verlauf — jeder Besuch des Dashboards trägt automatisch den heutigen Stand nach. In ein paar Tagen sehen Sie hier die Entwicklung.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

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
