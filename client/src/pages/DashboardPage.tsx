/**
 * Dashboard Page - Finanzplaner
 * Übersicht mit Gesamtvermögen, Charts, Risiko-Warnung, Action Items
 */

import { useMemo } from 'react';
import { useLocation } from 'wouter';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import {
  Wallet, TrendingUp, TrendingDown, PieChart as PieChartIcon, BarChart3,
  AlertTriangle, ArrowRight, Briefcase, Coins, Target,
  ArrowUpRight, ArrowDownRight, Clock, RefreshCw, Bot
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

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  
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
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = portfolio.reduce((sum, p) => {
      const value = p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice;
      return sum + value;
    }, 0);
    
    const totalInvested = portfolio.reduce((sum, p) => sum + p.amount * p.buyPrice, 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    
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
    
    return {
      totalWealth: totalValue,
      totalValue,
      totalInvested,
      totalGain,
      totalGainPercent,
      assetsByType,
      assetsByCategory,
    };
  }, [portfolio]);
  
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Gesamtvermögen</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold mt-1 truncate">
                      {formatCurrency(stats.totalWealth)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={stats.totalGainPercent >= 0 ? 'default' : 'destructive'} className="font-mono">
                        {formatPercent(stats.totalGainPercent)}
                      </Badge>
                    </div>
                  </div>
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

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
