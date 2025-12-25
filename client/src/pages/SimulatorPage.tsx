/**
 * Simulator Page - Finanzplaner
 * Sparplan-Rechner und Zinseszins-Simulation
 */

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { motion } from 'framer-motion';
import {
  Calculator, TrendingUp, Target, PiggyBank, Calendar, Wallet
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function SimulatorPage() {
  // Sparplan-Rechner State
  const [monthlyAmount, setMonthlyAmount] = useState(500);
  const [years, setYears] = useState(20);
  const [annualReturn, setAnnualReturn] = useState(7);
  const [initialInvestment, setInitialInvestment] = useState(10000);

  // Ziel-Rechner State
  const [targetAmount, setTargetAmount] = useState(100000);
  const [targetYears, setTargetYears] = useState(15);
  const [targetReturn, setTargetReturn] = useState(7);

  // Get current portfolio value
  const { data: portfolio = [] } = trpc.portfolio.list.useQuery();
  const currentPortfolioValue = useMemo(() => {
    return portfolio.reduce((sum, p) => {
      const amount = parseFloat(String(p.amount)) || 0;
      const price = parseFloat(String(p.currentPrice || p.buyPrice)) || 0;
      return sum + (amount * price);
    }, 0);
  }, [portfolio]);

  // Sparplan-Berechnung
  const sparplanResult = useMemo(() => {
    const monthlyReturn = annualReturn / 100 / 12;
    const months = years * 12;
    
    let balance = initialInvestment;
    let totalInvested = initialInvestment;
    const data = [{ year: 'Start', total: balance, deposits: totalInvested, gains: 0 }];
    
    for (let year = 1; year <= years; year++) {
      for (let month = 0; month < 12; month++) {
        balance = balance * (1 + monthlyReturn) + monthlyAmount;
        totalInvested += monthlyAmount;
      }
      data.push({
        year: `Jahr ${year}`,
        total: Math.round(balance),
        deposits: Math.round(totalInvested),
        gains: Math.round(balance - totalInvested),
      });
    }
    
    return {
      finalValue: Math.round(balance),
      totalInvested,
      totalReturn: Math.round(balance - totalInvested),
      returnPercent: ((balance - totalInvested) / totalInvested * 100).toFixed(1),
      data,
    };
  }, [monthlyAmount, years, annualReturn, initialInvestment]);

  // Ziel-Berechnung (wie viel monatlich sparen?)
  const targetResult = useMemo(() => {
    const monthlyReturn = targetReturn / 100 / 12;
    const months = targetYears * 12;
    
    // Formel: PMT = (FV * r) / ((1 + r)^n - 1)
    const requiredMonthly = (targetAmount * monthlyReturn) / 
      (Math.pow(1 + monthlyReturn, months) - 1);
    
    return {
      requiredMonthly: Math.round(requiredMonthly),
      totalInvested: Math.round(requiredMonthly * months),
      totalReturn: Math.round(targetAmount - (requiredMonthly * months)),
    };
  }, [targetAmount, targetYears, targetReturn]);

  // Szenarien-Vergleich
  const scenarios = useMemo(() => {
    const calculateFV = (rate: number) => {
      let balance = initialInvestment;
      const monthlyRate = rate / 100 / 12;
      
      for (let year = 0; year < years; year++) {
        for (let month = 0; month < 12; month++) {
          balance = balance * (1 + monthlyRate) + monthlyAmount;
        }
      }
      return balance;
    };

    return [
      { name: 'Pessimistisch (4%)', value: calculateFV(4), rate: 4 },
      { name: 'Realistisch (7%)', value: calculateFV(7), rate: 7 },
      { name: 'Optimistisch (10%)', value: calculateFV(10), rate: 10 },
    ];
  }, [initialInvestment, monthlyAmount, years]);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="pt-12 sm:pt-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Simulator
          </h1>
          <p className="text-muted-foreground text-xs sm:text-base">
            Sparplan-Rechner und Simulation
          </p>
        </div>

        {/* Current Portfolio Info */}
        {currentPortfolioValue > 0 && (
          <Card className="glass-card border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Aktuelles Portfolio</p>
                    <p className="font-mono text-base sm:text-lg font-bold">{formatCurrency(currentPortfolioValue)}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs sm:text-sm touch-target"
                  onClick={() => setInitialInvestment(Math.round(currentPortfolioValue))}
                >
                  Als Startkapital
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="sparplan" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="sparplan" className="text-xs sm:text-sm py-2">
              <TrendingUp className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sparplan-</span>Rechner
            </TabsTrigger>
            <TabsTrigger value="ziel" className="text-xs sm:text-sm py-2">
              <Target className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Ziel-</span>Rechner
            </TabsTrigger>
          </TabsList>

          {/* Sparplan-Rechner */}
          <TabsContent value="sparplan" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Parameter</CardTitle>
                  <CardDescription>Passen Sie Ihre Sparplan-Parameter an</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Startkapital</Label>
                      <span className="font-mono text-sm">{formatCurrency(initialInvestment)}</span>
                    </div>
                    <Input
                      type="number"
                      value={initialInvestment}
                      onChange={(e) => setInitialInvestment(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Monatliche Sparrate</Label>
                      <span className="font-mono text-sm">{formatCurrency(monthlyAmount)}</span>
                    </div>
                    <Slider
                      value={[monthlyAmount]}
                      onValueChange={([v]) => setMonthlyAmount(v)}
                      min={50}
                      max={5000}
                      step={50}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Anlagedauer</Label>
                      <span className="font-mono text-sm">{years} Jahre</span>
                    </div>
                    <Slider
                      value={[years]}
                      onValueChange={([v]) => setYears(v)}
                      min={1}
                      max={40}
                      step={1}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Erwartete Rendite p.a.</Label>
                      <span className="font-mono text-sm">{annualReturn}%</span>
                    </div>
                    <Slider
                      value={[annualReturn]}
                      onValueChange={([v]) => setAnnualReturn(v)}
                      min={1}
                      max={15}
                      step={0.5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card className="glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle>Vermögensentwicklung über {years} Jahre</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10">
                      <p className="text-xs text-muted-foreground">Endvermögen</p>
                      <p className="font-mono text-xl font-bold text-primary">
                        {formatCurrency(sparplanResult.finalValue)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/50">
                      <p className="text-xs text-muted-foreground">Eingezahlt</p>
                      <p className="font-mono text-xl font-bold">
                        {formatCurrency(sparplanResult.totalInvested)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10">
                      <p className="text-xs text-muted-foreground">Gewinn</p>
                      <p className="font-mono text-xl font-bold text-green-400">
                        {formatCurrency(sparplanResult.totalReturn)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500/10">
                      <p className="text-xs text-muted-foreground">Rendite</p>
                      <p className="font-mono text-xl font-bold text-amber-400">
                        +{sparplanResult.returnPercent}%
                      </p>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparplanResult.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 285)" />
                        <XAxis 
                          dataKey="year" 
                          stroke="oklch(0.5 0.01 285)"
                        />
                        <YAxis 
                          stroke="oklch(0.5 0.01 285)" 
                          tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            name === 'deposits' ? 'Eingezahlt' : name === 'gains' ? 'Rendite' : 'Gesamt'
                          ]}
                          contentStyle={{ 
                            backgroundColor: 'oklch(0.2 0.01 285)',
                            border: '1px solid oklch(0.3 0.01 285)',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend formatter={(value) => value === 'deposits' ? 'Einzahlungen' : value === 'gains' ? 'Rendite' : 'Gesamt'} />
                        <Area 
                          type="monotone" 
                          dataKey="deposits" 
                          stackId="1"
                          stroke="oklch(0.65 0.18 220)" 
                          fill="oklch(0.65 0.18 220 / 0.5)"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="gains" 
                          stackId="1"
                          stroke="oklch(0.65 0.18 145)" 
                          fill="oklch(0.65 0.18 145 / 0.5)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scenarios */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Szenarien-Vergleich</CardTitle>
                <CardDescription>
                  Verschiedene Rendite-Annahmen nach {years} Jahren
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {scenarios.map((scenario, index) => (
                    <motion.div
                      key={scenario.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-4 rounded-lg border ${
                        scenario.rate === annualReturn 
                          ? 'bg-primary/10 border-primary/50' 
                          : 'bg-accent/50 border-border'
                      }`}
                    >
                      <p className="text-sm text-muted-foreground mb-1">{scenario.name}</p>
                      <p className="font-mono text-xl font-bold">
                        {formatCurrency(scenario.value)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ziel-Rechner */}
          <TabsContent value="ziel" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Ihr Ziel</CardTitle>
                  <CardDescription>Wie viel möchten Sie erreichen?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Zielbetrag</Label>
                      <span className="font-mono text-sm">{formatCurrency(targetAmount)}</span>
                    </div>
                    <Input
                      type="number"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Zeitraum</Label>
                      <span className="font-mono text-sm">{targetYears} Jahre</span>
                    </div>
                    <Slider
                      value={[targetYears]}
                      onValueChange={([v]) => setTargetYears(v)}
                      min={1}
                      max={40}
                      step={1}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Erwartete Rendite p.a.</Label>
                      <span className="font-mono text-sm">{targetReturn}%</span>
                    </div>
                    <Slider
                      value={[targetReturn]}
                      onValueChange={([v]) => setTargetReturn(v)}
                      min={1}
                      max={15}
                      step={0.5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Results Card */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Benötigte Sparrate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center p-6 rounded-xl bg-primary/10">
                    <p className="text-sm text-muted-foreground mb-2">Monatlich sparen</p>
                    <p className="font-mono text-4xl font-bold text-primary">
                      {formatCurrency(targetResult.requiredMonthly)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-accent/50">
                      <p className="text-xs text-muted-foreground">Gesamt eingezahlt</p>
                      <p className="font-mono text-lg font-bold">
                        {formatCurrency(targetResult.totalInvested)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10">
                      <p className="text-xs text-muted-foreground">Zinsgewinn</p>
                      <p className="font-mono text-lg font-bold text-green-400">
                        {formatCurrency(targetResult.totalReturn)}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Zusammenfassung</span>
                    </div>
                    <p className="text-sm">
                      Um in <strong>{targetYears} Jahren</strong> ein Vermögen von{' '}
                      <strong className="text-primary">{formatCurrency(targetAmount)}</strong> zu erreichen,
                      müssen Sie monatlich <strong className="text-primary">{formatCurrency(targetResult.requiredMonthly)}</strong> sparen
                      (bei {targetReturn}% Rendite p.a.).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
