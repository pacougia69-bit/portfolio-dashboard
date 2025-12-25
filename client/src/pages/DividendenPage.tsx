/**
 * Dividenden Page - Finanzplaner
 * Dividenden-Tracking und Jahresübersicht
 */

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Coins, Plus, Pencil, Trash2, Calendar, TrendingUp, ArrowUpRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

interface DividendFormData {
  ticker: string;
  name: string;
  amount: string;
  taxAmount: string;
  date: string;
  notes: string;
}

const emptyForm: DividendFormData = {
  ticker: '',
  name: '',
  amount: '',
  taxAmount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function DividendenPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<DividendFormData>(emptyForm);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // tRPC queries and mutations
  const { data: dividends = [], isLoading, refetch } = trpc.dividends.list.useQuery();
  const { data: portfolio = [] } = trpc.portfolio.list.useQuery();
  
  const createDividend = trpc.dividends.create.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Dividende hinzugefügt');
      setIsAddDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Note: Update not implemented in backend - delete and recreate instead

  const deleteDividend = trpc.dividends.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Dividende gelöscht');
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const yearDividends = dividends.filter(d => 
      new Date(d.paymentDate).getFullYear().toString() === selectedYear
    );
    
    const totalYear = yearDividends.reduce((sum, d) => sum + d.amount, 0);
    const taxYear = yearDividends.reduce((sum, d) => sum + (d.taxAmount || 0), 0);
    const totalAll = dividends.reduce((sum, d) => sum + d.amount, 0);
    
    // Monthly breakdown
    const monthlyData = MONTHS.map((month, index) => {
      const monthDividends = yearDividends.filter(d => 
        new Date(d.paymentDate).getMonth() === index
      );
      return {
        name: month,
        amount: monthDividends.reduce((sum, d) => sum + d.amount, 0),
      };
    });
    
    return {
      totalYear,
      taxYear,
      totalAll,
      monthlyData,
      count: yearDividends.length,
    };
  }, [dividends, selectedYear]);

  // Available years
  const years = useMemo(() => {
    const yearSet = new Set(dividends.map(d => new Date(d.paymentDate).getFullYear()));
    yearSet.add(new Date().getFullYear());
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [dividends]);

  // Filter dividends by year
  const filteredDividends = useMemo(() => {
    return dividends
      .filter(d => new Date(d.paymentDate).getFullYear().toString() === selectedYear)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [dividends, selectedYear]);

  // Get unique tickers from portfolio for autocomplete
  const portfolioTickers = useMemo(() => {
    return portfolio.map(p => ({ ticker: p.ticker, name: p.name }));
  }, [portfolio]);

  const handleSubmit = () => {
    if (!formData.name || !formData.amount) {
      toast.error('Name und Betrag sind erforderlich');
      return;
    }

    const data = {
      ticker: formData.ticker.toUpperCase() || 'MANUAL',
      name: formData.name,
      amount: parseFloat(formData.amount),
      taxAmount: parseFloat(formData.taxAmount) || 0,
      paymentDate: formData.date,
    };

    if (editingItem) {
      // Delete old and create new since update is not implemented
      deleteDividend.mutate({ id: editingItem.id }, {
        onSuccess: () => {
          createDividend.mutate(data);
        }
      });
    } else {
      createDividend.mutate(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      ticker: item.ticker,
      name: item.name,
      amount: item.amount.toString(),
      taxAmount: item.taxAmount?.toString() || '',
      date: typeof item.paymentDate === 'string' ? item.paymentDate : new Date(item.paymentDate).toISOString().split('T')[0],
      notes: '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Dividende wirklich löschen?')) {
      deleteDividend.mutate({ id });
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingItem(null);
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
  };

  const DividendForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="grid gap-4 py-4">
      <div className="space-y-2">
        <Label>Aktie/ETF</Label>
        <Input
          value={formData.ticker}
          onChange={(e) => {
            const ticker = e.target.value.toUpperCase();
            setFormData({ ...formData, ticker });
            // Auto-fill name from portfolio
            const match = portfolioTickers.find(p => p.ticker === ticker);
            if (match) {
              setFormData(prev => ({ ...prev, ticker, name: match.name }));
            }
          }}
          placeholder="AAPL"
          list="ticker-list"
        />
        <datalist id="ticker-list">
          {portfolioTickers.map(p => (
            <option key={p.ticker} value={p.ticker}>{p.name}</option>
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="z.B. Apple Inc."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brutto-Betrag (€) *</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Steuer (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.taxAmount}
            onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Datum</Label>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={resetForm}>
          Abbrechen
        </Button>
        <Button onClick={onSubmit} disabled={!formData.name || !formData.amount || createDividend.isPending || deleteDividend.isPending}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
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
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              Dividenden
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              Tracking Ihrer Dividenden
            </p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] sm:w-[120px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="touch-target text-xs sm:text-sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Dividende </span>erfassen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Neue Dividende</DialogTitle>
                  <DialogDescription>
                    Erfassen Sie eine erhaltene Dividende.
                  </DialogDescription>
                </DialogHeader>
                <DividendForm onSubmit={handleSubmit} submitLabel="Hinzufügen" />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedYear} Brutto</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold text-amber-400 truncate">
                      {formatCurrency(stats.totalYear)}
                    </p>
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
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <ArrowUpRight className="w-4 h-4 sm:w-6 sm:h-6 text-green-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{selectedYear} Netto</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold text-green-400 truncate">
                      {formatCurrency(stats.totalYear - stats.taxYear)}
                    </p>
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
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Steuer {selectedYear}</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold text-red-400 truncate">
                      {formatCurrency(stats.taxYear)}
                    </p>
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
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Ausschüttungen</p>
                    <p className="font-mono text-lg sm:text-2xl font-bold">
                      {stats.count}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Chart */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="text-sm sm:text-lg">Übersicht {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 285)" />
                  <XAxis dataKey="name" stroke="oklch(0.5 0.01 285)" />
                  <YAxis stroke="oklch(0.5 0.01 285)" tickFormatter={(v) => `${v}€`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'oklch(0.2 0.01 285)',
                      border: '1px solid oklch(0.3 0.01 285)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="amount" fill="oklch(0.75 0.15 80)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Dividends List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Dividenden {selectedYear}</CardTitle>
            <CardDescription>{filteredDividends.length} Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDividends.length > 0 ? (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {filteredDividends.map((dividend, index) => (
                    <motion.div
                      key={dividend.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Coins className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">{dividend.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(dividend.paymentDate).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono font-bold text-amber-400">
                            {formatCurrency(dividend.amount)}
                          </p>
                          {dividend.taxAmount && dividend.taxAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Steuer: {formatCurrency(dividend.taxAmount)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(dividend)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(dividend.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12">
                <Coins className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Keine Dividenden {selectedYear}</h3>
                <p className="text-muted-foreground mb-4">
                  Erfassen Sie Ihre erste Dividende für dieses Jahr.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Dividende erfassen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsEditDialogOpen(open);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Dividende bearbeiten</DialogTitle>
              <DialogDescription>
                Aktualisieren Sie die Dividendendetails.
              </DialogDescription>
            </DialogHeader>
            <DividendForm onSubmit={handleSubmit} submitLabel="Speichern" />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
