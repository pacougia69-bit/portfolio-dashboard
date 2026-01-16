/**
 * Tax Management Component - Freibeträge & Verlusttöpfe
 * Verwaltet Sparerpauschbetrag, Freistellungsaufträge und Verlusttöpfe
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Calculator, PiggyBank, TrendingDown, Plus, Edit, Trash, RefreshCw,
  Euro, Calendar, Building, Info, CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TaxAllowance {
  id: number;
  year: number;
  amount: number;
  used: number;
  broker?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface LossCarryforward {
  id: number;
  year: number;
  category: 'general' | 'stocks' | 'other';
  amount: number;
  broker?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TaxManagement() {
  const currentYear = new Date().getFullYear();

  // State for dialogs
  const [isAllowanceDialogOpen, setIsAllowanceDialogOpen] = useState(false);
  const [isLossDialogOpen, setIsLossDialogOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<TaxAllowance | null>(null);
  const [editingLoss, setEditingLossCarryforward] = useState<LossCarryforward | null>(null);

  // Form state for Allowance
  const [allowanceYear, setAllowanceYear] = useState(String(currentYear));
  const [allowanceAmount, setAllowanceAmount] = useState('1000');
  const [allowanceUsed, setAllowanceUsed] = useState('0');
  const [allowanceBroker, setAllowanceBroker] = useState('');
  const [allowanceNotes, setAllowanceNotes] = useState('');

  // Form state for Loss Carryforward
  const [lossYear, setLossYear] = useState(String(currentYear - 1));
  const [lossCategory, setLossCategory] = useState<'general' | 'stocks' | 'other'>('stocks');
  const [lossAmount, setLossAmount] = useState('0');
  const [lossBroker, setLossBroker] = useState('');
  const [lossNotes, setLossNotes] = useState('');

  // Fetch data
  const { data: allowances = [], refetch: refetchAllowances } = trpc.tax.getAllowances.useQuery();
  const { data: lossCarryforwards = [], refetch: refetchLosses } = trpc.tax.getLossCarryforwards.useQuery();

  // Mutations for Allowances
  const createAllowance = trpc.tax.createAllowance.useMutation({
    onSuccess: () => {
      toast.success('Freibetrag wurde erstellt');
      setIsAllowanceDialogOpen(false);
      resetAllowanceForm();
      refetchAllowances();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateAllowance = trpc.tax.updateAllowance.useMutation({
    onSuccess: () => {
      toast.success('Freibetrag wurde aktualisiert');
      setIsAllowanceDialogOpen(false);
      resetAllowanceForm();
      refetchAllowances();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteAllowance = trpc.tax.deleteAllowance.useMutation({
    onSuccess: () => {
      toast.success('Freibetrag wurde gelöscht');
      refetchAllowances();
    },
    onError: (error) => toast.error(error.message),
  });

  // Mutations for Loss Carryforwards
  const createLossCarryforward = trpc.tax.createLossCarryforward.useMutation({
    onSuccess: () => {
      toast.success('Verlustvortrag wurde erstellt');
      setIsLossDialogOpen(false);
      resetLossForm();
      refetchLosses();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateLossCarryforward = trpc.tax.updateLossCarryforward.useMutation({
    onSuccess: () => {
      toast.success('Verlustvortrag wurde aktualisiert');
      setIsLossDialogOpen(false);
      resetLossForm();
      refetchLosses();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteLossCarryforward = trpc.tax.deleteLossCarryforward.useMutation({
    onSuccess: () => {
      toast.success('Verlustvortrag wurde gelöscht');
      refetchLosses();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetAllowanceForm = () => {
    setEditingAllowance(null);
    setAllowanceYear(String(currentYear));
    setAllowanceAmount('1000');
    setAllowanceUsed('0');
    setAllowanceBroker('');
    setAllowanceNotes('');
  };

  const resetLossForm = () => {
    setEditingLossCarryforward(null);
    setLossYear(String(currentYear - 1));
    setLossCategory('stocks');
    setLossAmount('0');
    setLossBroker('');
    setLossNotes('');
  };

  const handleOpenAllowanceDialog = (allowance?: TaxAllowance) => {
    if (allowance) {
      setEditingAllowance(allowance);
      setAllowanceYear(String(allowance.year));
      setAllowanceAmount(String(allowance.amount));
      setAllowanceUsed(String(allowance.used));
      setAllowanceBroker(allowance.broker || '');
      setAllowanceNotes(allowance.notes || '');
    } else {
      resetAllowanceForm();
    }
    setIsAllowanceDialogOpen(true);
  };

  const handleOpenLossDialog = (loss?: LossCarryforward) => {
    if (loss) {
      setEditingLossCarryforward(loss);
      setLossYear(String(loss.year));
      setLossCategory(loss.category);
      setLossAmount(String(Math.abs(loss.amount)));
      setLossBroker(loss.broker || '');
      setLossNotes(loss.notes || '');
    } else {
      resetLossForm();
    }
    setIsLossDialogOpen(true);
  };

  const handleSaveAllowance = () => {
    const amount = parseFloat(allowanceAmount);
    const used = parseFloat(allowanceUsed);
    const year = parseInt(allowanceYear);

    if (isNaN(amount) || amount < 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    if (isNaN(used) || used < 0 || used > amount) {
      toast.error('Der genutzte Betrag darf nicht negativ oder größer als der Freibetrag sein');
      return;
    }

    const data = {
      year,
      amount,
      used,
      broker: allowanceBroker || undefined,
      notes: allowanceNotes || undefined,
    };

    if (editingAllowance) {
      updateAllowance.mutate({ id: editingAllowance.id, ...data });
    } else {
      createAllowance.mutate(data);
    }
  };

  const handleSaveLoss = () => {
    const amount = parseFloat(lossAmount);
    const year = parseInt(lossYear);

    if (isNaN(amount) || amount < 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    const data = {
      year,
      category: lossCategory,
      amount: -Math.abs(amount), // Store as negative
      broker: lossBroker || undefined,
      notes: lossNotes || undefined,
    };

    if (editingLoss) {
      updateLossCarryforward.mutate({ id: editingLoss.id, ...data });
    } else {
      createLossCarryforward.mutate(data);
    }
  };

  const handleDeleteAllowance = (id: number) => {
    if (confirm('Möchten Sie diesen Freibetrag wirklich löschen?')) {
      deleteAllowance.mutate({ id });
    }
  };

  const handleDeleteLoss = (id: number) => {
    if (confirm('Möchten Sie diesen Verlustvortrag wirklich löschen?')) {
      deleteLossCarryforward.mutate({ id });
    }
  };

  // Calculate totals
  const currentYearAllowance = allowances.find((a: TaxAllowance) => a.year === currentYear);
  const totalAllowance = currentYearAllowance?.amount || 0;
  const usedAllowance = currentYearAllowance?.used || 0;
  const remainingAllowance = totalAllowance - usedAllowance;
  const allowanceUsagePercent = totalAllowance > 0 ? (usedAllowance / totalAllowance) * 100 : 0;

  const totalLosses = lossCarryforwards.reduce((sum: number, loss: LossCarryforward) => sum + Math.abs(loss.amount), 0);
  const stocksLosses = lossCarryforwards
    .filter((l: LossCarryforward) => l.category === 'stocks')
    .reduce((sum: number, loss: LossCarryforward) => sum + Math.abs(loss.amount), 0);
  const otherLosses = lossCarryforwards
    .filter((l: LossCarryforward) => l.category !== 'stocks')
    .reduce((sum: number, loss: LossCarryforward) => sum + Math.abs(loss.amount), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'stocks':
        return 'Aktien';
      case 'general':
        return 'Allgemein';
      case 'other':
        return 'Sonstige';
      default:
        return category;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Steuer-Zentrale
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Verwalten Sie Ihre Freibeträge und Verlustvorträge
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Year Allowance */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              Freibetrag {currentYear}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Sparerpauschbetrag / Freistellungsauftrag
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-green-600">
                    {formatCurrency(remainingAllowance)}
                  </p>
                  <p className="text-xs text-muted-foreground">noch verfügbar</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(totalAllowance)}</p>
                  <p className="text-xs text-muted-foreground">gesamt</p>
                </div>
              </div>

              {totalAllowance > 0 && (
                <>
                  <Progress value={allowanceUsagePercent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Genutzt: {formatCurrency(usedAllowance)}</span>
                    <span>{allowanceUsagePercent.toFixed(1)}%</span>
                  </div>
                </>
              )}

              {!currentYearAllowance && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Noch kein Freibetrag für {currentYear} angelegt. Erstellen Sie einen Freistellungsauftrag.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total Losses */}
        <Card className="glass-card">
          <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              Verlustvorträge
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Verrechenbare Verluste aus Vorjahren
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-red-600">
                    {formatCurrency(totalLosses)}
                  </p>
                  <p className="text-xs text-muted-foreground">gesamt</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Aktien</p>
                  <p className="font-mono text-sm font-medium">{formatCurrency(stocksLosses)}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">Sonstige</p>
                  <p className="font-mono text-sm font-medium">{formatCurrency(otherLosses)}</p>
                </div>
              </div>

              {lossCarryforwards.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Keine Verlustvorträge erfasst. Verluste können mit zukünftigen Gewinnen verrechnet werden.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Freibeträge Management */}
      <Card className="glass-card">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Freibeträge verwalten
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Sparerpauschbetrag & Freistellungsaufträge pro Jahr
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => handleOpenAllowanceDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Neu
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {allowances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Keine Freibeträge erfasst</p>
              <p className="text-xs mt-1">Erstellen Sie Ihren ersten Freistellungsauftrag</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allowances
                .sort((a: TaxAllowance, b: TaxAllowance) => b.year - a.year)
                .map((allowance: TaxAllowance) => {
                  const remaining = allowance.amount - allowance.used;
                  const usagePercent = allowance.amount > 0 ? (allowance.used / allowance.amount) * 100 : 0;

                  return (
                    <div
                      key={allowance.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">Freibetrag {allowance.year}</p>
                            {allowance.broker && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {allowance.broker}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenAllowanceDialog(allowance)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAllowance(allowance.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              disabled={deleteAllowance.isPending}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Genutzt: {formatCurrency(allowance.used)} / {formatCurrency(allowance.amount)}
                            </span>
                            <span className={`font-medium ${remaining > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {formatCurrency(remaining)} verfügbar
                            </span>
                          </div>
                          <Progress value={usagePercent} className="h-1.5" />
                        </div>

                        {allowance.notes && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                            <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {allowance.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verlustvorträge Management */}
      <Card className="glass-card">
        <CardHeader className="p-3 sm:p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Verlustvorträge verwalten
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Verrechenbare Verluste aus Vorjahren (Verlusttöpfe)
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => handleOpenLossDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Neu
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {lossCarryforwards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Keine Verlustvorträge erfasst</p>
              <p className="text-xs mt-1">Erfassen Sie Ihre Verlustvorträge aus Vorjahren</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lossCarryforwards
                .sort((a: LossCarryforward, b: LossCarryforward) => b.year - a.year)
                .map((loss: LossCarryforward) => (
                  <div
                    key={loss.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">Verlustvortrag {loss.year}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                              {getCategoryLabel(loss.category)}
                            </span>
                          </div>
                          {loss.broker && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building className="w-3 h-3" />
                              {loss.broker}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="text-right mr-2">
                            <p className="font-mono text-sm font-medium text-red-600">
                              {formatCurrency(Math.abs(loss.amount))}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenLossDialog(loss)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLoss(loss.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={deleteLossCarryforward.isPending}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {loss.notes && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                          <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {loss.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allowance Dialog */}
      <Dialog open={isAllowanceDialogOpen} onOpenChange={setIsAllowanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-primary" />
              {editingAllowance ? 'Freibetrag bearbeiten' : 'Freibetrag erstellen'}
            </DialogTitle>
            <DialogDescription>
              Sparerpauschbetrag oder Freistellungsauftrag für ein Jahr
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jahr *</Label>
                <Select value={allowanceYear} onValueChange={setAllowanceYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Broker / Bank</Label>
                <Input
                  value={allowanceBroker}
                  onChange={(e) => setAllowanceBroker(e.target.value)}
                  placeholder="z.B. Trade Republic"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Freibetrag (€) *</Label>
                <Input
                  type="number"
                  value={allowanceAmount}
                  onChange={(e) => setAllowanceAmount(e.target.value)}
                  placeholder="1000"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Bereits genutzt (€)</Label>
                <Input
                  type="number"
                  value={allowanceUsed}
                  onChange={(e) => setAllowanceUsed(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Input
                value={allowanceNotes}
                onChange={(e) => setAllowanceNotes(e.target.value)}
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAllowanceDialogOpen(false);
                resetAllowanceForm();
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveAllowance}
              disabled={createAllowance.isPending || updateAllowance.isPending}
            >
              {(createAllowance.isPending || updateAllowance.isPending) ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PiggyBank className="w-4 h-4 mr-2" />
              )}
              {editingAllowance ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss Carryforward Dialog */}
      <Dialog open={isLossDialogOpen} onOpenChange={setIsLossDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-primary" />
              {editingLoss ? 'Verlustvortrag bearbeiten' : 'Verlustvortrag erstellen'}
            </DialogTitle>
            <DialogDescription>
              Verrechenbare Verluste aus Vorjahren erfassen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jahr *</Label>
                <Select value={lossYear} onValueChange={setLossYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => currentYear - 1 - i).map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kategorie *</Label>
                <Select value={lossCategory} onValueChange={(val) => setLossCategory(val as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stocks">Aktien</SelectItem>
                    <SelectItem value="general">Allgemein</SelectItem>
                    <SelectItem value="other">Sonstige</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Verlustvortrag (€) *</Label>
              <Input
                type="number"
                value={lossAmount}
                onChange={(e) => setLossAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Positiver Betrag eingeben (wird automatisch als Verlust gespeichert)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Broker / Bank</Label>
              <Input
                value={lossBroker}
                onChange={(e) => setLossBroker(e.target.value)}
                placeholder="z.B. Trade Republic"
              />
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Input
                value={lossNotes}
                onChange={(e) => setLossNotes(e.target.value)}
                placeholder="Optionale Notizen..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsLossDialogOpen(false);
                resetLossForm();
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSaveLoss}
              disabled={createLossCarryforward.isPending || updateLossCarryforward.isPending}
            >
              {(createLossCarryforward.isPending || updateLossCarryforward.isPending) ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-2" />
              )}
              {editingLoss ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
