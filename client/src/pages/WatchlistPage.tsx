/**
 * Watchlist Page - Finanzplaner
 * Beobachtete Aktien mit Zielpreisen
 * Mit automatischem Datenabruf per WKN und Transfer ins Portfolio
 */

import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Eye, Plus, Pencil, Trash2, Target, ShoppingCart, AlertCircle, Search, Loader2, ArrowRight
} from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface WatchlistFormData {
  ticker: string;
  wkn: string;
  name: string;
  currentPrice: string;
  targetPrice: string;
  changePercent: string;
  notes: string;
}

interface TransferFormData {
  amount: string;
  buyPrice: string;
  type: 'Aktie' | 'ETF' | 'Krypto' | 'Anleihe' | 'Fonds';
  category: string;
  status: 'Kaufen' | 'Halten' | 'Verkaufen';
}

const emptyForm: WatchlistFormData = {
  ticker: '',
  wkn: '',
  name: '',
  currentPrice: '',
  targetPrice: '',
  changePercent: '',
  notes: '',
};

const emptyTransferForm: TransferFormData = {
  amount: '1',
  buyPrice: '',
  type: 'Aktie',
  category: '',
  status: 'Halten',
};

export default function WatchlistPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [transferItem, setTransferItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<WatchlistFormData>(emptyForm);
  const [transferFormData, setTransferFormData] = useState<TransferFormData>(emptyTransferForm);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // tRPC queries and mutations
  const { data: watchlist = [], isLoading, refetch } = trpc.watchlist.list.useQuery();
  
  const createItem = trpc.watchlist.create.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Zur Watchlist hinzugefügt');
      setIsAddDialogOpen(false);
      setFormData(emptyForm);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const updateItem = trpc.watchlist.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Watchlist-Eintrag aktualisiert');
      setIsEditDialogOpen(false);
      setEditingItem(null);
      setFormData(emptyForm);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteItem = trpc.watchlist.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Von Watchlist entfernt');
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // State for refreshing prices
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  // WKN Lookup mutation
  const lookupByWKN = trpc.lookup.byWKN.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          ticker: result.data!.ticker,
          name: result.data!.name,
          currentPrice: result.data!.currentPrice.toFixed(2),
        }));
        toast.success(`Daten für ${result.data.name} geladen`);
      } else {
        toast.error(result.error || 'Keine Daten gefunden');
      }
      setIsLookingUp(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
      setIsLookingUp(false);
    },
  });

  // Transfer to Portfolio mutation
  const transferToPortfolio = trpc.transfer.watchlistToPortfolio.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Position ins Portfolio übertragen');
      setIsTransferDialogOpen(false);
      setTransferItem(null);
      setTransferFormData(emptyTransferForm);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Handle WKN lookup
  const handleWKNLookup = () => {
    if (!formData.wkn || formData.wkn.length < 5) {
      toast.error('Bitte geben Sie eine gültige WKN ein (min. 5 Zeichen)');
      return;
    }
    setIsLookingUp(true);
    lookupByWKN.mutate({ wkn: formData.wkn });
  };

  // Refresh prices for all watchlist items with WKN
  const handleRefreshPrices = async () => {
    const itemsWithWKN = watchlist.filter(item => item.wkn && item.wkn.length >= 5);
    if (itemsWithWKN.length === 0) {
      toast.error('Keine Einträge mit WKN gefunden');
      return;
    }

    setIsRefreshingPrices(true);
    let updatedCount = 0;
    let errorCount = 0;

    for (const item of itemsWithWKN) {
      try {
        const result = await lookupByWKN.mutateAsync({ wkn: item.wkn! });
        if (result.success && result.data && result.data.currentPrice > 0) {
          await updateItem.mutateAsync({
            id: item.id,
            ticker: item.ticker,
            name: item.name,
            currentPrice: result.data.currentPrice,
            targetPrice: item.targetPrice || 0,
            notes: item.notes || undefined,
            wkn: item.wkn || undefined,
          });
          updatedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setIsRefreshingPrices(false);
    if (updatedCount > 0) {
      toast.success(`${updatedCount} Kurse aktualisiert`);
      refetch();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} Kurse konnten nicht abgerufen werden`);
    }
  };

  const handleSubmit = () => {
    if (!formData.ticker || !formData.name) {
      toast.error('Ticker und Name sind erforderlich');
      return;
    }

    const data = {
      ticker: formData.ticker.toUpperCase(),
      wkn: formData.wkn || undefined,
      name: formData.name,
      currentPrice: parseFloat(formData.currentPrice) || 0,
      targetPrice: parseFloat(formData.targetPrice) || 0,
      notes: formData.notes || undefined,
    };

    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, ...data });
    } else {
      createItem.mutate(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      ticker: item.ticker,
      wkn: item.wkn || '',
      name: item.name,
      currentPrice: item.currentPrice?.toString() || '',
      targetPrice: item.targetPrice?.toString() || '',
      changePercent: '',
      notes: item.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Eintrag wirklich löschen?')) {
      deleteItem.mutate({ id });
    }
  };

  const handleOpenTransfer = (item: any) => {
    setTransferItem(item);
    setTransferFormData({
      ...emptyTransferForm,
      buyPrice: item.currentPrice?.toString() || '',
    });
    setIsTransferDialogOpen(true);
  };

  const handleTransfer = () => {
    if (!transferItem) return;
    
    const amount = parseFloat(transferFormData.amount);
    const buyPrice = parseFloat(transferFormData.buyPrice);
    
    if (!amount || amount <= 0) {
      toast.error('Bitte geben Sie eine gültige Stückzahl ein');
      return;
    }
    if (!buyPrice || buyPrice <= 0) {
      toast.error('Bitte geben Sie einen gültigen Kaufpreis ein');
      return;
    }

    transferToPortfolio.mutate({
      watchlistId: transferItem.id,
      amount,
      buyPrice,
      type: transferFormData.type,
      category: transferFormData.category || undefined,
      status: transferFormData.status,
    });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingItem(null);
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
  };

  const WatchlistForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="grid gap-4 py-4">
      {/* WKN Lookup Row */}
      <div className="space-y-2">
        <Label>WKN (automatische Suche)</Label>
        <div className="flex gap-2">
          <Input
            value={formData.wkn}
            onChange={(e) => setFormData({ ...formData, wkn: e.target.value.toUpperCase() })}
            placeholder="z.B. 865985 oder A0RPWH"
            className="flex-1"
          />
          <Button 
            type="button" 
            variant="secondary" 
            onClick={handleWKNLookup}
            disabled={isLookingUp || !formData.wkn}
          >
            {isLookingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Geben Sie die WKN ein und klicken Sie auf Suchen, um Name, Ticker und Kurs automatisch zu laden
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ticker/Symbol *</Label>
          <Input
            value={formData.ticker}
            onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
            placeholder="z.B. AAPL"
          />
        </div>
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="z.B. Apple Inc."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Aktueller Preis (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.currentPrice}
            onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Zielpreis (€)</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.targetPrice}
            onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notizen</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Warum beobachten Sie diese Aktie?"
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={resetForm}>
          Abbrechen
        </Button>
        <Button onClick={onSubmit} disabled={!formData.ticker || !formData.name || createItem.isPending || updateItem.isPending}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
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
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              Watchlist
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              {watchlist.length} Aktien unter Beobachtung
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshPrices}
              disabled={isRefreshingPrices || watchlist.length === 0}
              className="touch-target text-xs sm:text-sm"
            >
              {isRefreshingPrices ? (
                <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Kurse aktualisieren</span>
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="touch-target text-xs sm:text-sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Aktie </span>hinzufügen
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Zur Watchlist hinzufügen</DialogTitle>
                <DialogDescription>
                  Geben Sie die WKN ein, um Daten automatisch zu laden, oder füllen Sie die Felder manuell aus.
                </DialogDescription>
              </DialogHeader>
              <WatchlistForm onSubmit={handleSubmit} submitLabel="Hinzufügen" />
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Watchlist Grid */}
        {watchlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {watchlist.map((item, index) => {
              const currentPrice = item.currentPrice || 0;
              const targetPrice = item.targetPrice || 0;
              const distanceToTarget = targetPrice > 0 && currentPrice > 0
                ? ((targetPrice - currentPrice) / currentPrice) * 100
                : 0;
              const isNearTarget = Math.abs(distanceToTarget) < 5;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`glass-card ${isNearTarget ? 'border-amber-500/50' : ''}`}>
                    <CardHeader className="p-3 sm:p-6 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-lg truncate">{item.name}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">
                          {item.ticker}{item.wkn && ` · ${item.wkn}`}
                        </p>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs ml-2 flex-shrink-0">
                          {item.ticker}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0">
                      <div className="space-y-3 sm:space-y-4">
                        {/* Prices */}
                        <div className="grid grid-cols-2 gap-2 sm:gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Aktuell</p>
                            <p className="font-mono text-sm sm:text-lg font-bold">
                              {currentPrice > 0 ? formatCurrency(currentPrice) : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              Ziel
                            </p>
                            <p className="font-mono text-sm sm:text-lg font-bold text-primary">
                              {targetPrice > 0 ? formatCurrency(targetPrice) : '-'}
                            </p>
                          </div>
                        </div>

                        {/* Distance to Target */}
                        {targetPrice > 0 && currentPrice > 0 && (
                          <div className={`p-2 rounded-lg ${isNearTarget ? 'bg-amber-500/10' : 'bg-accent/50'}`}>
                            <div className="flex items-center gap-2">
                              {isNearTarget && <AlertCircle className="w-4 h-4 text-amber-400" />}
                              <span className="text-sm">
                                {distanceToTarget > 0 
                                  ? `${distanceToTarget.toFixed(1)}% unter Zielpreis`
                                  : `${Math.abs(distanceToTarget).toFixed(1)}% über Zielpreis`
                                }
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {item.notes}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleOpenTransfer(item)}
                          >
                            <ShoppingCart className="w-3 h-3 mr-1" />
                            Kaufen
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-12 text-center">
              <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Watchlist ist leer</h3>
              <p className="text-muted-foreground mb-4">
                Fügen Sie Aktien hinzu, die Sie beobachten möchten.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Erste Aktie hinzufügen
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsEditDialogOpen(open);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Watchlist-Eintrag bearbeiten</DialogTitle>
              <DialogDescription>
                Aktualisieren Sie die Details dieses Eintrags.
              </DialogDescription>
            </DialogHeader>
            <WatchlistForm onSubmit={handleSubmit} submitLabel="Speichern" />
          </DialogContent>
        </Dialog>

        {/* Transfer to Portfolio Dialog */}
        <Dialog open={isTransferDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setTransferItem(null);
            setTransferFormData(emptyTransferForm);
          }
          setIsTransferDialogOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Position kaufen
              </DialogTitle>
              <DialogDescription>
                Übertragen Sie {transferItem?.name} ins Portfolio
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              {/* Info */}
              <div className="p-3 rounded-lg bg-accent/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{transferItem?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {transferItem?.ticker}{transferItem?.wkn && ` · WKN: ${transferItem.wkn}`}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stückzahl *</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={transferFormData.amount}
                    onChange={(e) => setTransferFormData({ ...transferFormData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kaufpreis (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={transferFormData.buyPrice}
                    onChange={(e) => setTransferFormData({ ...transferFormData, buyPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select 
                    value={transferFormData.type} 
                    onValueChange={(value: any) => setTransferFormData({ ...transferFormData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktie">Aktie</SelectItem>
                      <SelectItem value="ETF">ETF</SelectItem>
                      <SelectItem value="Krypto">Krypto</SelectItem>
                      <SelectItem value="Anleihe">Anleihe</SelectItem>
                      <SelectItem value="Fonds">Fonds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Kategorie</Label>
                  <Input
                    value={transferFormData.category}
                    onChange={(e) => setTransferFormData({ ...transferFormData, category: e.target.value })}
                    placeholder="z.B. Tech, Biotech"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={transferFormData.status} 
                  onValueChange={(value: any) => setTransferFormData({ ...transferFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kaufen">Kaufen</SelectItem>
                    <SelectItem value="Halten">Halten</SelectItem>
                    <SelectItem value="Verkaufen">Verkaufen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary */}
              {transferFormData.amount && transferFormData.buyPrice && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Gesamtwert</p>
                  <p className="text-xl font-bold font-mono">
                    {formatCurrency(parseFloat(transferFormData.amount) * parseFloat(transferFormData.buyPrice))}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleTransfer} disabled={transferToPortfolio.isPending}>
                {transferToPortfolio.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                Ins Portfolio übertragen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
