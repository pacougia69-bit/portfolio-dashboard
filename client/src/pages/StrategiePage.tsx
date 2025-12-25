/**
 * Strategie Page - Finanzplaner
 * ETF-Fokus mit individuellen Sparraten pro ETF
 * Mit persistenter Speicherung und KI-Empfehlungen
 */

import { useState, useMemo, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Target, Pencil, TrendingUp, PieChart, 
  ArrowRight, Wallet, ArrowUpRight, ArrowDownRight, Scale,
  CheckCircle2, AlertTriangle, Info, Sparkles, Loader2, Save
} from 'lucide-react';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

const COLORS = [
  'oklch(0.75 0.15 195)', // cyan
  'oklch(0.65 0.18 145)', // green
  'oklch(0.70 0.15 60)',  // orange
  'oklch(0.55 0.2 280)',  // purple
  'oklch(0.65 0.18 220)', // blue
  'oklch(0.60 0.2 30)',   // red
  'oklch(0.70 0.12 90)',  // yellow
  'oklch(0.60 0.15 320)', // pink
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
  return `${value.toFixed(1)}%`;
};

// Vordefinierte ETF-Kategorien mit Ziel-Allokationen
const DEFAULT_ALLOCATIONS = [
  { category: 'Welt-ETF', targetPercent: 50, description: 'Breite Diversifikation (MSCI World, FTSE All-World)' },
  { category: 'EM-ETF', targetPercent: 20, description: 'Emerging Markets für Wachstum' },
  { category: 'Tech-ETF', targetPercent: 15, description: 'Technologie & Innovation' },
  { category: 'Themen-ETF', targetPercent: 10, description: 'Thematische ETFs (Clean Energy, Defence, etc.)' },
  { category: 'Sonstige', targetPercent: 5, description: 'Andere ETFs' },
];

export default function StrategiePage() {
  const [isEditTargetOpen, setIsEditTargetOpen] = useState(false);
  const [targetAllocations, setTargetAllocations] = useState(DEFAULT_ALLOCATIONS);
  const [monthlyBudget, setMonthlyBudget] = useState(1400);
  const [tempBudget, setTempBudget] = useState(1400);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Individuelle ETF-Sparraten (Ticker -> Betrag)
  const [etfSparRates, setEtfSparRates] = useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Fetch portfolio data
  const { data: portfolio = [], isLoading } = trpc.portfolio.list.useQuery();
  
  // Fetch user settings
  const { data: settings, isLoading: settingsLoading } = trpc.settings.get.useQuery();
  
  // Fetch savings plans
  const { data: savingsPlans = [], isLoading: savingsLoading } = trpc.savingsPlans.list.useQuery();
  
  // Save settings mutation
  const saveSettings = trpc.settings.save.useMutation({
    onSuccess: () => {
      toast.success('Einstellungen gespeichert');
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern: ' + error.message);
    },
  });
  
  // Savings plan mutations
  const createSavingsPlan = trpc.savingsPlans.create.useMutation();
  const updateSavingsPlan = trpc.savingsPlans.update.useMutation();
  const deleteSavingsPlan = trpc.savingsPlans.delete.useMutation();
  
  const utils = trpc.useUtils();
  
  // Load settings when available
  useEffect(() => {
    if (settings) {
      if (settings.monthlyBudget) {
        const budget = Number(settings.monthlyBudget);
        setMonthlyBudget(budget);
        setTempBudget(budget);
      }
      if (settings.targetAllocations) {
        try {
          const allocations = typeof settings.targetAllocations === 'string' 
            ? JSON.parse(settings.targetAllocations) 
            : settings.targetAllocations;
          if (Array.isArray(allocations) && allocations.length > 0) {
            setTargetAllocations(allocations);
          }
        } catch (e) {
          console.error('Error parsing target allocations:', e);
        }
      }
    }
  }, [settings]);
  
  // Load savings plans into etfSparRates
  useEffect(() => {
    if (savingsPlans.length > 0) {
      const rates: Record<string, number> = {};
      savingsPlans.forEach(plan => {
        rates[plan.ticker] = Number(plan.monthlyAmount);
      });
      setEtfSparRates(rates);
    }
  }, [savingsPlans]);
  
  // Filter ETF positions
  const etfPositions = useMemo(() => {
    return portfolio.filter(p => p.type === 'ETF');
  }, [portfolio]);
  
  // Calculate totals
  const totalValue = useMemo(() => {
    return etfPositions.reduce((sum, p) => {
      const value = Number(p.amount) * (Number(p.currentPrice) || Number(p.buyPrice));
      return sum + value;
    }, 0);
  }, [etfPositions]);
  
  const totalPortfolioValue = useMemo(() => {
    return portfolio.reduce((sum, p) => {
      const value = Number(p.amount) * (Number(p.currentPrice) || Number(p.buyPrice));
      return sum + value;
    }, 0);
  }, [portfolio]);
  
  const etfPercent = totalPortfolioValue > 0 ? (totalValue / totalPortfolioValue) * 100 : 0;
  
  // Summe der eingetragenen Sparraten
  const totalSparRate = useMemo(() => {
    return Object.values(etfSparRates).reduce((sum, rate) => sum + (rate || 0), 0);
  }, [etfSparRates]);
  
  // Differenz zur Ziel-Sparrate
  const sparRateDifference = monthlyBudget - totalSparRate;
  
  // Group ETFs by category for charts
  const allocationComparison = useMemo(() => {
    const categoryMap: Record<string, { current: number; target: number; etfs: typeof etfPositions }> = {};
    
    // Initialize with target allocations
    targetAllocations.forEach(t => {
      categoryMap[t.category] = { current: 0, target: t.targetPercent, etfs: [] };
    });
    
    // Calculate current allocation
    etfPositions.forEach(etf => {
      const category = etf.category || 'Sonstige';
      if (!categoryMap[category]) {
        categoryMap[category] = { current: 0, target: 0, etfs: [] };
      }
      const value = Number(etf.amount) * (Number(etf.currentPrice) || Number(etf.buyPrice));
      categoryMap[category].current += totalValue > 0 ? (value / totalValue) * 100 : 0;
      categoryMap[category].etfs.push(etf);
    });
    
    return Object.entries(categoryMap).map(([category, data]) => ({
      category,
      current: data.current,
      target: data.target,
      difference: data.current - data.target,
      etfs: data.etfs,
    }));
  }, [etfPositions, targetAllocations, totalValue]);
  
  // Rebalancing suggestions
  const rebalancingSuggestions = useMemo(() => {
    return allocationComparison
      .filter(a => Math.abs(a.difference) > 1)
      .map(a => ({
        category: a.category,
        action: a.difference > 0 ? 'reduce' : 'increase',
        amount: Math.abs(a.difference * totalValue / 100),
        percentDiff: a.difference,
      }))
      .sort((a, b) => Math.abs(b.percentDiff) - Math.abs(a.percentDiff));
  }, [allocationComparison, totalValue]);
  
  // Handle budget change
  const handleBudgetSave = () => {
    setMonthlyBudget(tempBudget);
    saveSettings.mutate({
      monthlyBudget: tempBudget,
      targetAllocations: targetAllocations,
    });
  };
  
  // Handle individual ETF rate change
  const handleEtfRateChange = (ticker: string, value: number) => {
    setEtfSparRates(prev => ({
      ...prev,
      [ticker]: value,
    }));
    setHasUnsavedChanges(true);
  };
  
  // Save all ETF rates
  const handleSaveAllRates = async () => {
    try {
      // Get existing plans
      const existingPlans = savingsPlans;
      
      for (const etf of etfPositions) {
        const rate = etfSparRates[etf.ticker] || 0;
        const existingPlan = existingPlans.find(p => p.ticker === etf.ticker);
        
        if (rate > 0) {
          if (existingPlan) {
            // Update existing plan
            await updateSavingsPlan.mutateAsync({
              id: existingPlan.id,
              monthlyAmount: rate,
            });
          } else {
            // Create new plan
            await createSavingsPlan.mutateAsync({
              ticker: etf.ticker,
              name: etf.name,
              monthlyAmount: rate,
            });
          }
        } else if (existingPlan) {
          // Delete plan if rate is 0
          await deleteSavingsPlan.mutateAsync({ id: existingPlan.id });
        }
      }
      
      // Invalidate and refetch
      await utils.savingsPlans.list.invalidate();
      setHasUnsavedChanges(false);
      toast.success('Sparraten gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern der Sparraten');
      console.error(error);
    }
  };
  
  // Handle target allocation change
  const handleTargetChange = (index: number, value: number) => {
    const newAllocations = [...targetAllocations];
    newAllocations[index].targetPercent = value;
    setTargetAllocations(newAllocations);
  };
  
  // Save target allocations
  const handleSaveTargets = () => {
    const total = targetAllocations.reduce((sum, a) => sum + a.targetPercent, 0);
    if (Math.abs(total - 100) > 0.1) {
      toast.error('Die Summe der Ziel-Allokationen muss 100% ergeben');
      return;
    }
    
    saveSettings.mutate({
      monthlyBudget: monthlyBudget,
      targetAllocations: targetAllocations,
    });
    setIsEditTargetOpen(false);
  };
  
  // Generate AI suggestion for savings plan
  const handleGenerateAiSuggestion = async () => {
    setIsAiLoading(true);
    try {
      const portfolioSummary = etfPositions.map(p => ({
        name: p.name,
        ticker: p.ticker,
        wkn: p.wkn || '',
        category: p.category || 'Sonstige',
        value: Number(p.amount) * (Number(p.currentPrice) || Number(p.buyPrice)),
        currentRate: etfSparRates[p.ticker] || 0,
      }));
      
      const prompt = `Analysiere mein ETF-Portfolio und empfehle eine optimale Verteilung meiner monatlichen Sparrate von ${monthlyBudget}€.

Meine ETFs:
${portfolioSummary.map(p => `- ${p.name} (WKN: ${p.wkn || 'N/A'}, Ticker: ${p.ticker}): Wert ${p.value.toFixed(0)}€, Kategorie: ${p.category}, Aktuelle Sparrate: ${p.currentRate}€`).join('\n')}

Meine Ziel-Allokation:
${targetAllocations.map(t => `- ${t.category}: ${t.targetPercent}%`).join('\n')}

Bitte empfehle für JEDEN einzelnen ETF einen konkreten monatlichen Betrag in Euro.
Berücksichtige dabei:
1. Die Ziel-Allokation nach Kategorien
2. Welche ETFs unter- oder übergewichtet sind
3. Praktische Beträge (runde auf 25€ oder 50€)

Format: Liste jeden ETF mit dem empfohlenen monatlichen Betrag.`;

      // Use the AI chat endpoint
      const response = await utils.client.ai.chat.mutate({
        message: prompt,
      });
      
      setAiSuggestion(response.analysis);
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Fehler bei der KI-Analyse');
    } finally {
      setIsAiLoading(false);
    }
  };
  
  // Pie chart data for current allocation
  const pieChartData = allocationComparison
    .filter(a => a.current > 0)
    .map(a => ({
      name: a.category,
      value: a.current,
    }));
  
  // Bar chart data for comparison
  const barChartData = allocationComparison.map(a => ({
    category: a.category.replace('-ETF', ''),
    Ist: a.current,
    Soll: a.target,
  }));
  
  if (isLoading || settingsLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
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
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6" />
              ETF-Strategie
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              Ziel-Allokation und Rebalancing
            </p>
          </div>
          
          <Dialog open={isEditTargetOpen} onOpenChange={setIsEditTargetOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 touch-target text-xs sm:text-sm">
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Ziel-Allokation </span>bearbeiten
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ziel-Allokation bearbeiten</DialogTitle>
                <DialogDescription>
                  Passen Sie Ihre gewünschte ETF-Verteilung an. Die Summe muss 100% ergeben.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {targetAllocations.map((alloc, index) => (
                  <div key={alloc.category} className="flex items-center gap-4">
                    <Label className="w-32">{alloc.category}</Label>
                    <Input
                      type="number"
                      value={alloc.targetPercent}
                      onChange={(e) => handleTargetChange(index, Number(e.target.value))}
                      className="w-20"
                      min={0}
                      max={100}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 border-t">
                  <Label className="w-32 font-bold">Summe</Label>
                  <span className={`font-mono ${Math.abs(targetAllocations.reduce((s, a) => s + a.targetPercent, 0) - 100) > 0.1 ? 'text-destructive' : 'text-green-500'}`}>
                    {targetAllocations.reduce((s, a) => s + a.targetPercent, 0)}%
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditTargetOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSaveTargets}>
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="glass-card">
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">ETF-Vermögen</p>
                  <p className="text-lg sm:text-2xl font-bold font-mono truncate">{formatCurrency(totalValue)}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{formatPercent(etfPercent)} vom Portfolio</p>
                </div>
                <PieChart className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">ETF-Positionen</p>
                  <p className="text-lg sm:text-2xl font-bold font-mono">{etfPositions.length}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">in {allocationComparison.filter(a => a.etfs.length > 0).length} Kategorien</p>
                </div>
                <Target className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Sparrate/Monat</p>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Input
                      type="number"
                      value={tempBudget}
                      onChange={(e) => setTempBudget(Number(e.target.value))}
                      className="w-16 sm:w-24 font-mono text-sm sm:text-lg"
                    />
                    <span className="text-sm sm:text-lg">€</span>
                    {tempBudget !== monthlyBudget && (
                      <Button size="sm" onClick={handleBudgetSave} className="h-7 w-7 p-0">
                        <Save className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50 flex-shrink-0 hidden sm:block" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="p-3 sm:pt-6 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Rebalancing</p>
                  <p className="text-lg sm:text-2xl font-bold font-mono">{rebalancingSuggestions.length}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">Anpassungen empfohlen</p>
                </div>
                <Scale className="w-6 h-6 sm:w-8 sm:h-8 text-primary opacity-50 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content Tabs */}
        <Tabs defaultValue="sparplan" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2 px-1 sm:px-3">Übersicht</TabsTrigger>
            <TabsTrigger value="rebalancing" className="text-xs sm:text-sm py-2 px-1 sm:px-3">Rebal.</TabsTrigger>
            <TabsTrigger value="sparplan" className="text-xs sm:text-sm py-2 px-1 sm:px-3">Sparplan</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs sm:text-sm py-2 px-1 sm:px-3">KI</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* Pie Chart */}
              <Card className="glass-card">
                <CardHeader className="p-3 sm:p-6 pb-2">
                  <CardTitle className="text-sm sm:text-lg">Aktuelle Allokation</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="h-[200px] sm:h-[300px]">
                    {pieChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                          >
                            {pieChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Keine ETF-Daten vorhanden
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Bar Chart Comparison */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-lg">Ist vs. Soll</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis type="number" domain={[0, 60]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="category" width={80} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Legend />
                        <Bar dataKey="Ist" fill="oklch(0.75 0.15 195)" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="Soll" fill="oklch(0.65 0.18 145)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Rebalancing Tab */}
          <TabsContent value="rebalancing" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Rebalancing-Empfehlungen
                </CardTitle>
                <CardDescription>
                  Anpassungen um Ihre Ziel-Allokation zu erreichen
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rebalancingSuggestions.length > 0 ? (
                  <div className="space-y-3">
                    {rebalancingSuggestions.map((suggestion, index) => (
                      <div 
                        key={suggestion.category}
                        className={`flex items-center justify-between p-4 rounded-lg ${
                          suggestion.action === 'increase' 
                            ? 'bg-green-500/10 border border-green-500/20' 
                            : 'bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {suggestion.action === 'increase' ? (
                            <ArrowUpRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium">{suggestion.category}</p>
                            <p className="text-sm text-muted-foreground">
                              {suggestion.action === 'increase' ? 'Untergewichtet' : 'Übergewichtet'} um {Math.abs(suggestion.percentDiff).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-mono font-bold ${suggestion.action === 'increase' ? 'text-green-500' : 'text-amber-500'}`}>
                            {suggestion.action === 'increase' ? '+' : '-'}{formatCurrency(suggestion.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.action === 'increase' ? 'nachkaufen' : 'reduzieren'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">Portfolio ist ausbalanciert</p>
                    <p className="text-sm">Keine Anpassungen erforderlich</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sparplan Tab - NEUE VERSION mit Eingabefeldern */}
          <TabsContent value="sparplan" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Monatliche Sparplan-Verteilung
                    </CardTitle>
                    <CardDescription>
                      Tragen Sie für jeden ETF Ihren monatlichen Sparbetrag ein
                    </CardDescription>
                  </div>
                  {hasUnsavedChanges && (
                    <Button onClick={handleSaveAllRates} className="gap-2">
                      <Save className="w-4 h-4" />
                      Alle speichern
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Summen-Anzeige oben */}
                  <div className={`p-4 rounded-lg mb-4 ${
                    sparRateDifference === 0 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : sparRateDifference > 0 
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : 'bg-red-500/10 border border-red-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sparRateDifference === 0 ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : sparRateDifference > 0 ? (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          {sparRateDifference === 0 
                            ? 'Sparrate vollständig verteilt' 
                            : sparRateDifference > 0 
                              ? `Noch ${formatCurrency(sparRateDifference)} zu verteilen`
                              : `${formatCurrency(Math.abs(sparRateDifference))} über Budget`
                          }
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-lg font-bold">{formatCurrency(totalSparRate)}</span>
                        <span className="text-muted-foreground"> / {formatCurrency(monthlyBudget)}</span>
                      </div>
                    </div>
                    <Progress 
                      value={Math.min((totalSparRate / monthlyBudget) * 100, 100)} 
                      className="mt-2 h-2"
                    />
                  </div>
                  
                  {/* Einzelne ETFs mit Eingabefeldern */}
                  {etfPositions.length > 0 ? (
                    etfPositions.map((etf, index) => {
                      const currentRate = etfSparRates[etf.ticker] || 0;
                      const percentOfBudget = monthlyBudget > 0 ? (currentRate / monthlyBudget) * 100 : 0;
                      
                      return (
                        <div 
                          key={etf.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-accent/30 hover:bg-accent/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: `${COLORS[index % COLORS.length]}30` }}
                            >
                              <span className="font-mono text-xs font-bold">
                                {percentOfBudget.toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{etf.name}</p>
                              <div className="flex items-center gap-2">
                                {etf.wkn && <Badge variant="secondary" className="text-xs font-mono">{etf.wkn}</Badge>}
                                <Badge variant="outline" className="text-xs">{etf.ticker}</Badge>
                                <span className="text-xs text-muted-foreground">{etf.category || 'Sonstige'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={currentRate || ''}
                              onChange={(e) => handleEtfRateChange(etf.ticker, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-24 font-mono text-right"
                              min={0}
                              step={25}
                            />
                            <span className="text-muted-foreground">€</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Keine ETFs im Portfolio</p>
                      <p className="text-sm">Fügen Sie ETFs hinzu, um die Sparplan-Verteilung zu sehen</p>
                    </div>
                  )}
                  
                  {etfPositions.length > 0 && (
                    <div className="flex justify-between pt-4 border-t border-border">
                      <span className="font-medium">Gesamt ({etfPositions.length} ETFs)</span>
                      <span className={`font-mono text-xl font-bold ${
                        sparRateDifference === 0 ? 'text-green-500' : 
                        sparRateDifference > 0 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {formatCurrency(totalSparRate)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* AI Suggestion Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  KI-Empfehlung für Sparplan
                </CardTitle>
                <CardDescription>
                  Die KI analysiert Ihr Portfolio und Ihre Watchlist-ETFs und schlägt eine optimale Verteilung Ihrer {formatCurrency(monthlyBudget)} vor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={handleGenerateAiSuggestion}
                    disabled={isAiLoading}
                    className="w-full gap-2"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analysiere Portfolio...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Sparplan-Empfehlung generieren
                      </>
                    )}
                  </Button>
                  
                  {aiSuggestion && (
                    <div className="p-4 rounded-lg bg-accent/30 border border-amber-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                          <h4 className="font-medium">KI-Empfehlung</h4>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(aiSuggestion);
                            toast.success('Empfehlung in Zwischenablage kopiert');
                          }}
                          className="gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          Kopieren
                        </Button>
                      </div>
                      <ScrollArea className="h-[500px]">
                        <div className="prose prose-sm prose-invert max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: aiSuggestion
                            .replace(/### (.*?)\n/g, '<h3 class="text-cyan-400 font-bold mt-6 mb-3 text-base">$1</h3>')
                            .replace(/#### (.*?)\n/g, '<h4 class="text-amber-400 font-semibold mt-4 mb-2 text-sm">$1</h4>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                            .replace(/\| (.*?) \|/g, (match) => {
                              const cells = match.split('|').filter(c => c.trim());
                              return '<tr>' + cells.map(c => `<td class="border border-border/50 px-3 py-2 text-sm">${c.trim()}</td>`).join('') + '</tr>';
                            })
                            .replace(/\n\n/g, '</p><p class="mb-3">')
                            .replace(/\n/g, '<br/>')
                            .replace(/\* (.*?)<br\/>/g, '<li class="ml-4 mb-1">$1</li>')
                          }} />
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  
                  {!aiSuggestion && !isAiLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Klicken Sie auf den Button, um eine personalisierte Empfehlung zu erhalten</p>
                      <p className="text-sm mt-2">
                        Die KI analysiert Ihr Portfolio <strong>und Ihre Watchlist-ETFs</strong> und schlägt für jeden ETF einen konkreten Betrag vor.
                        ETFs aus der Watchlist werden bewertet und bei Eignung in den Sparplan aufgenommen.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
