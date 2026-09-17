/**
 * Musterdepot (Spielgeld) - komplett getrennt vom echten Depot (PortfolioPage).
 * Gleiche Tabellen-/Card-Optik wie /portfolio, aber eigene Datenquelle
 * (musterdepot_* Tabellen), keine Steuer-Logik, kein DKB-Import.
 */

import React, { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { parseGermanNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { Gamepad2, Plus, RefreshCw, Loader2, Banknote, Search, RotateCcw, Wallet, TrendingUp, Pencil, ArrowRightLeft } from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const formatAmount = (value: number) => {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(4).replace(/\.?0+$/, '');
};

const EMPTY_BUY_FORM = {
  type: 'Aktie' as 'Aktie' | 'ETF' | 'Krypto' | 'Hebelprodukt',
  wkn: '',
  ticker: '',
  name: '',
  issuer: '',
  direction: 'CALL' as 'CALL' | 'PUT',
  gearing: '',
  koThreshold: '',
  koPufferPct: '',
  amount: '',
  price: '',
};

// Gleiche Felder wie EMPTY_BUY_FORM, zusaetzlich der aktuelle Kurs - fuers
// Bearbeiten einer bereits angelegten Position (keine Cash-Buchung).
const EMPTY_EDIT_FORM = {
  ...EMPTY_BUY_FORM,
  currentPrice: '',
};

// Fuers Uebertragen einer Musterdepot-Position ins echte Portfolio -
// Stueckzahl/Kaufpreis muss der echte Kauf sein, nicht die virtuellen Werte.
const EMPTY_TRANSFER_FORM = {
  amount: '',
  buyPrice: '',
  category: '',
};

export default function MusterdepotPage() {
  const { data: settings, refetch: refetchSettings } = trpc.musterdepot.settings.get.useQuery();
  const { data: positions = [], isLoading, refetch: refetchPositions } = trpc.musterdepot.positions.list.useQuery();

  const [isBuyDialogOpen, setIsBuyDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetStartkapital, setResetStartkapital] = useState('10000');
  const [sellingPosition, setSellingPosition] = useState<any>(null);
  const [sellForm, setSellForm] = useState({ quantity: '', price: '' });
  const [buyForm, setBuyForm] = useState(EMPTY_BUY_FORM);
  const [isLookingUpHebel, setIsLookingUpHebel] = useState(false);
  const [isLookingUpTicker, setIsLookingUpTicker] = useState(false);
  const [isCashDialogOpen, setIsCashDialogOpen] = useState(false);
  const [cashInput, setCashInput] = useState('');

  // Bearbeiten einer bereits angelegten Position
  const [editingPosition, setEditingPosition] = useState<any>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  // Uebertragen einer Musterdepot-Position ins echte Portfolio
  const [transferringPosition, setTransferringPosition] = useState<any>(null);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER_FORM);

  const refetchAll = () => {
    refetchSettings();
    refetchPositions();
  };

  const buyMutation = trpc.musterdepot.positions.buy.useMutation({
    onSuccess: () => {
      toast.success('Kauf gebucht');
      setIsBuyDialogOpen(false);
      setBuyForm(EMPTY_BUY_FORM);
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const sellMutation = trpc.musterdepot.positions.sell.useMutation({
    onSuccess: () => {
      toast.success('Verkauf gebucht');
      setSellingPosition(null);
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.musterdepot.positions.update.useMutation({
    onSuccess: () => {
      toast.success('Position aktualisiert');
      setEditingPosition(null);
      setEditForm(EMPTY_EDIT_FORM);
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  // Kopiert eine Musterdepot-Position ins echte Portfolio (trpc.portfolio.create) -
  // WKN/Name/Typ/Kenndaten kommen 1:1 rueber, Stueckzahl/Kaufpreis traegt Rafael
  // als echten Kauf ein. Die Musterdepot-Position selbst bleibt unangetastet.
  const transferMutation = trpc.portfolio.create.useMutation({
    onSuccess: () => {
      toast.success('Ins echte Portfolio übernommen');
      setTransferringPosition(null);
      setTransferForm(EMPTY_TRANSFER_FORM);
    },
    onError: (error) => toast.error(error.message),
  });

  const resetMutation = trpc.musterdepot.settings.reset.useMutation({
    onSuccess: () => {
      toast.success('Musterdepot zurückgesetzt');
      setIsResetDialogOpen(false);
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshPrices = trpc.musterdepot.refreshPrices.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.failedCount > 0
          ? `${data.updatedCount} Kurse aktualisiert, ${data.failedCount} fehlgeschlagen`
          : `${data.updatedCount} Kurse aktualisiert`
      );
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const lookupHebel = trpc.musterdepot.lookupHebel.useMutation({
    onSuccess: (detail) => {
      setBuyForm((prev) => ({
        ...prev,
        name: detail.name,
        issuer: detail.issuer,
        direction: detail.direction,
        gearing: detail.gearing !== null ? String(detail.gearing) : '',
        koThreshold: detail.koThreshold !== null ? String(detail.koThreshold) : '',
        koPufferPct: detail.koPufferPct !== null ? String(detail.koPufferPct) : '',
        price: detail.ask !== null ? String(detail.ask) : prev.price,
      }));
      toast.success(`${detail.name} geladen${detail.ask !== null ? ` (Ask ${detail.ask}€)` : ''}`);
      setIsLookingUpHebel(false);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsLookingUpHebel(false);
    },
  });

  const handleHebelLookup = () => {
    if (!buyForm.wkn) {
      toast.error('Bitte WKN eingeben');
      return;
    }
    setIsLookingUpHebel(true);
    lookupHebel.mutate({ wkn: buyForm.wkn });
  };

  // Gleicher WKN-Lookup wie im echten Portfolio (trpc.lookup.byWKN) - fuer
  // Aktie/ETF/Krypto, wo man meist die WKN statt des Tickers zur Hand hat.
  const lookupByWkn = trpc.lookup.byWKN.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setBuyForm((prev) => ({
          ...prev,
          ticker: result.data!.ticker,
          name: result.data!.name,
          price: result.data!.currentPrice.toFixed(2),
        }));
        toast.success(`Daten für ${result.data.name} geladen`);
      } else {
        toast.error(result.error || 'Keine Daten gefunden');
      }
      setIsLookingUpTicker(false);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
      setIsLookingUpTicker(false);
    },
  });

  const handleTickerWknLookup = () => {
    if (!buyForm.wkn || buyForm.wkn.length < 5) {
      toast.error('Bitte eine gültige WKN eingeben (min. 5 Zeichen)');
      return;
    }
    setIsLookingUpTicker(true);
    lookupByWkn.mutate({ wkn: buyForm.wkn });
  };

  const setCashMutation = trpc.musterdepot.settings.setCash.useMutation({
    onSuccess: () => {
      toast.success('Cash-Betrag aktualisiert');
      setIsCashDialogOpen(false);
      refetchAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleBuySubmit = () => {
    const amount = parseGermanNumber(buyForm.amount);
    const price = parseGermanNumber(buyForm.price);
    if (!amount || !price) {
      toast.error('Bitte Stückzahl und Kurs eintragen');
      return;
    }
    if (buyForm.type === 'Hebelprodukt' && !buyForm.wkn) {
      toast.error('Hebelprodukte brauchen eine WKN');
      return;
    }
    if (buyForm.type !== 'Hebelprodukt' && !buyForm.ticker) {
      toast.error('Bitte Ticker eintragen');
      return;
    }
    buyMutation.mutate({
      wkn: buyForm.wkn || undefined,
      ticker: buyForm.type === 'Hebelprodukt' ? buyForm.wkn : buyForm.ticker,
      name: buyForm.name || buyForm.ticker || buyForm.wkn,
      type: buyForm.type,
      issuer: buyForm.type === 'Hebelprodukt' ? buyForm.issuer || undefined : undefined,
      direction: buyForm.type === 'Hebelprodukt' ? buyForm.direction : undefined,
      gearing: buyForm.gearing ? parseGermanNumber(buyForm.gearing) ?? undefined : undefined,
      koThreshold: buyForm.koThreshold ? parseGermanNumber(buyForm.koThreshold) ?? undefined : undefined,
      koPufferPct: buyForm.koPufferPct ? parseGermanNumber(buyForm.koPufferPct) ?? undefined : undefined,
      amount,
      price,
    });
  };

  const handleOpenSell = (pos: any) => {
    setSellingPosition(pos);
    setSellForm({
      quantity: formatAmount(pos.amount),
      price: pos.currentPrice ? String(pos.currentPrice) : String(pos.buyPrice),
    });
  };

  const handleSellSubmit = () => {
    if (!sellingPosition) return;
    const quantity = parseGermanNumber(sellForm.quantity);
    const price = parseGermanNumber(sellForm.price);
    if (!quantity || !price) {
      toast.error('Bitte Stückzahl und Kurs eintragen');
      return;
    }
    sellMutation.mutate({ positionId: sellingPosition.id, quantity, price });
  };

  const handleOpenEdit = (pos: any) => {
    setEditingPosition(pos);
    setEditForm({
      type: pos.type,
      wkn: pos.wkn || '',
      ticker: pos.ticker,
      name: pos.name,
      issuer: pos.issuer || '',
      direction: pos.direction || 'CALL',
      gearing: pos.gearing !== null && pos.gearing !== undefined ? String(pos.gearing) : '',
      koThreshold: pos.koThreshold !== null && pos.koThreshold !== undefined ? String(pos.koThreshold) : '',
      koPufferPct: pos.koPufferPct !== null && pos.koPufferPct !== undefined ? String(pos.koPufferPct) : '',
      amount: formatAmount(pos.amount),
      price: String(pos.buyPrice),
      currentPrice: pos.currentPrice !== null && pos.currentPrice !== undefined ? String(pos.currentPrice) : '',
    });
  };

  const handleEditSubmit = () => {
    if (!editingPosition) return;
    const amount = parseGermanNumber(editForm.amount);
    const buyPrice = parseGermanNumber(editForm.price);
    if (!amount || !buyPrice) {
      toast.error('Bitte Stückzahl und Kaufpreis eintragen');
      return;
    }
    if (editForm.type === 'Hebelprodukt' && !editForm.wkn) {
      toast.error('Hebelprodukte brauchen eine WKN');
      return;
    }
    if (editForm.type !== 'Hebelprodukt' && !editForm.ticker) {
      toast.error('Bitte Ticker eintragen');
      return;
    }
    updateMutation.mutate({
      id: editingPosition.id,
      wkn: editForm.wkn || undefined,
      ticker: editForm.type === 'Hebelprodukt' ? editForm.wkn : editForm.ticker,
      name: editForm.name || editForm.ticker || editForm.wkn,
      type: editForm.type,
      issuer: editForm.type === 'Hebelprodukt' ? (editForm.issuer || undefined) : undefined,
      direction: editForm.type === 'Hebelprodukt' ? editForm.direction : undefined,
      gearing: editForm.gearing ? parseGermanNumber(editForm.gearing) ?? undefined : undefined,
      koThreshold: editForm.koThreshold ? parseGermanNumber(editForm.koThreshold) ?? undefined : undefined,
      koPufferPct: editForm.koPufferPct ? parseGermanNumber(editForm.koPufferPct) ?? undefined : undefined,
      amount,
      buyPrice,
      currentPrice: editForm.currentPrice ? parseGermanNumber(editForm.currentPrice) ?? undefined : undefined,
    });
  };

  const handleOpenTransfer = (pos: any) => {
    setTransferringPosition(pos);
    setTransferForm({
      amount: formatAmount(pos.amount),
      buyPrice: String(pos.currentPrice ?? pos.buyPrice),
      category: '',
    });
  };

  const handleTransferSubmit = () => {
    if (!transferringPosition) return;
    const amount = parseGermanNumber(transferForm.amount);
    const buyPrice = parseGermanNumber(transferForm.buyPrice);
    if (!amount || !buyPrice) {
      toast.error('Bitte Stückzahl und echten Kaufpreis eintragen');
      return;
    }
    const pos = transferringPosition;
    transferMutation.mutate({
      wkn: pos.wkn || undefined,
      ticker: pos.type === 'Hebelprodukt' ? (pos.wkn || pos.ticker) : pos.ticker,
      name: pos.name,
      type: pos.type,
      category: transferForm.category || undefined,
      amount,
      buyPrice,
      issuer: pos.type === 'Hebelprodukt' ? pos.issuer || undefined : undefined,
      direction: pos.type === 'Hebelprodukt' ? pos.direction || undefined : undefined,
      gearing: pos.type === 'Hebelprodukt' ? pos.gearing ?? undefined : undefined,
      koThreshold: pos.type === 'Hebelprodukt' ? pos.koThreshold ?? undefined : undefined,
      koPufferPct: pos.type === 'Hebelprodukt' ? pos.koPufferPct ?? undefined : undefined,
    });
  };

  const positionsValue = useMemo(
    () => positions.reduce((sum, p) => sum + p.amount * (p.currentPrice ?? p.buyPrice), 0),
    [positions]
  );
  const cashBalance = settings?.cashBalance ?? 0;
  const startkapital = settings?.startkapital ?? 0;
  const depotwert = cashBalance + positionsValue;
  const gesamtPerformancePct = startkapital > 0 ? ((depotwert - startkapital) / startkapital) * 100 : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-12 sm:pt-0">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
              Musterdepot (Spielgeld)
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              {positions.length} Positionen • Depotwert {formatCurrency(depotwert)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshPrices.mutate()}
              disabled={refreshPrices.isPending}
              className="text-xs sm:text-sm"
            >
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${refreshPrices.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Kurse aktualisieren</span>
            </Button>

            <Dialog
              open={isCashDialogOpen}
              onOpenChange={(open) => {
                setIsCashDialogOpen(open);
                if (open) setCashInput(String(cashBalance));
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                  <Pencil className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cash bearbeiten</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Virtuelles Cash bearbeiten</DialogTitle>
                  <DialogDescription>
                    Ändert nur den Cash-Betrag — Positionen und Transaktionshistorie bleiben unverändert.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Label>Cash-Betrag (€)</Label>
                  <Input value={cashInput} onChange={(e) => setCashInput(e.target.value)} placeholder="10000" className="mt-1" />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCashDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => {
                      const value = parseGermanNumber(cashInput);
                      if (value === null || value === undefined || value < 0) {
                        toast.error('Bitte gültigen Betrag eintragen');
                        return;
                      }
                      setCashMutation.mutate({ cashBalance: value });
                    }}
                    disabled={setCashMutation.isPending}
                  >
                    Speichern
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                  <RotateCcw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Neu starten</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Musterdepot zurücksetzen</DialogTitle>
                  <DialogDescription>
                    Löscht alle Positionen und Transaktionen unwiderruflich und setzt das virtuelle Cash neu.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Label>Neues Startkapital (€)</Label>
                  <Input
                    value={resetStartkapital}
                    onChange={(e) => setResetStartkapital(e.target.value)}
                    placeholder="10000"
                    className="mt-1"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const value = parseGermanNumber(resetStartkapital);
                      if (!value) {
                        toast.error('Bitte gültiges Startkapital eintragen');
                        return;
                      }
                      resetMutation.mutate({ startkapital: value });
                    }}
                    disabled={resetMutation.isPending}
                  >
                    Zurücksetzen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isBuyDialogOpen}
              onOpenChange={(open) => {
                setIsBuyDialogOpen(open);
                if (!open) setBuyForm(EMPTY_BUY_FORM);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="text-xs sm:text-sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Position </span>kaufen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Virtueller Kauf</DialogTitle>
                  <DialogDescription>
                    Bucht den Einsatz vom virtuellen Cash ab ({formatCurrency(cashBalance)} verfügbar).
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <Label>Typ *</Label>
                    <Select
                      value={buyForm.type}
                      onValueChange={(v: any) => setBuyForm({ ...EMPTY_BUY_FORM, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aktie">Aktie</SelectItem>
                        <SelectItem value="ETF">ETF</SelectItem>
                        <SelectItem value="Krypto">Krypto</SelectItem>
                        <SelectItem value="Hebelprodukt">Hebelprodukt (Knock-Out)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {buyForm.type === 'Hebelprodukt' ? (
                    <>
                      <div>
                        <Label>WKN * (lädt Kenndaten automatisch)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={buyForm.wkn}
                            onChange={(e) => setBuyForm({ ...buyForm, wkn: e.target.value.toUpperCase() })}
                            placeholder="z.B. BY3405"
                            className="flex-1"
                          />
                          <Button type="button" variant="secondary" onClick={handleHebelLookup} disabled={isLookingUpHebel || !buyForm.wkn}>
                            {isLookingUpHebel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Name</Label>
                          <Input value={buyForm.name} onChange={(e) => setBuyForm({ ...buyForm, name: e.target.value })} />
                        </div>
                        <div>
                          <Label>Emittent</Label>
                          <Input value={buyForm.issuer} onChange={(e) => setBuyForm({ ...buyForm, issuer: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Richtung</Label>
                          <Select value={buyForm.direction} onValueChange={(v: any) => setBuyForm({ ...buyForm, direction: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CALL">CALL</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Hebel</Label>
                          <Input value={buyForm.gearing} onChange={(e) => setBuyForm({ ...buyForm, gearing: e.target.value })} placeholder="5.2" />
                        </div>
                        <div>
                          <Label>K.O.-Puffer %</Label>
                          <Input value={buyForm.koPufferPct} onChange={(e) => setBuyForm({ ...buyForm, koPufferPct: e.target.value })} placeholder="19.1" />
                        </div>
                      </div>
                      <div>
                        <Label>K.O.-Schwelle</Label>
                        <Input value={buyForm.koThreshold} onChange={(e) => setBuyForm({ ...buyForm, koThreshold: e.target.value })} placeholder="7.35" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>WKN (automatische Suche)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={buyForm.wkn}
                            onChange={(e) => setBuyForm({ ...buyForm, wkn: e.target.value.toUpperCase() })}
                            placeholder="z.B. 865985 oder A3D7QX"
                            className="flex-1"
                          />
                          <Button type="button" variant="secondary" onClick={handleTickerWknLookup} disabled={isLookingUpTicker || !buyForm.wkn}>
                            {isLookingUpTicker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Laedt Ticker, Name und aktuellen Kurs automatisch.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Ticker *</Label>
                          <Input
                            value={buyForm.ticker}
                            onChange={(e) => setBuyForm({ ...buyForm, ticker: e.target.value.toUpperCase() })}
                            placeholder="AAPL"
                          />
                        </div>
                        <div>
                          <Label>Name</Label>
                          <Input value={buyForm.name} onChange={(e) => setBuyForm({ ...buyForm, name: e.target.value })} placeholder="Apple Inc." />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Stückzahl *</Label>
                      <Input value={buyForm.amount} onChange={(e) => setBuyForm({ ...buyForm, amount: e.target.value })} placeholder="10" />
                    </div>
                    <div>
                      <Label>Kurs (€) *</Label>
                      <Input value={buyForm.price} onChange={(e) => setBuyForm({ ...buyForm, price: e.target.value })} placeholder="150.00" />
                    </div>
                  </div>

                  {buyForm.amount && buyForm.price && (
                    <p className="text-xs text-muted-foreground">
                      Einsatz: {formatCurrency((parseGermanNumber(buyForm.amount) || 0) * (parseGermanNumber(buyForm.price) || 0))}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBuyDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleBuySubmit} disabled={buyMutation.isPending}>
                    {buyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Kaufen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="glass-card">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Virtuelles Cash</p>
              <p className="text-sm sm:text-lg font-mono font-bold mt-1">{formatCurrency(cashBalance)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Positionswert</p>
              <p className="text-sm sm:text-lg font-mono font-bold mt-1">{formatCurrency(positionsValue)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground">Depotwert</p>
              <p className="text-sm sm:text-lg font-mono font-bold mt-1">{formatCurrency(depotwert)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Performance</p>
              <p className={`text-sm sm:text-lg font-mono font-bold mt-1 ${gesamtPerformancePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(gesamtPerformancePct)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm">Name</th>
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">WKN</th>
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm">Typ</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">Anz.</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">Kauf</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">Aktuell</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">Wert</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">+/-</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">K.O.-Puffer</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">Akt.</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => {
                  const currentPrice = pos.currentPrice ?? pos.buyPrice;
                  const value = pos.amount * currentPrice;
                  const performance = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
                  return (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-2 sm:p-4">
                        <div>
                          <p className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{pos.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {pos.ticker}
                            {pos.type === 'Hebelprodukt' && pos.issuer ? ` · ${pos.issuer}` : ''}
                          </p>
                        </div>
                      </td>
                      <td className="p-2 sm:p-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{pos.wkn || '-'}</td>
                      <td className="p-2 sm:p-4">
                        <Badge variant="outline" className="text-xs">
                          {pos.type === 'Hebelprodukt' ? `${pos.direction ?? ''} ${pos.gearing ? pos.gearing.toFixed(1) + 'x' : ''}`.trim() : pos.type}
                        </Badge>
                      </td>
                      <td className="p-2 sm:p-4 text-right font-mono text-xs sm:text-sm">{formatAmount(pos.amount)}</td>
                      <td className="p-2 sm:p-4 text-right font-mono text-xs hidden sm:table-cell">{formatCurrency(pos.buyPrice)}</td>
                      <td className="p-2 sm:p-4 text-right font-mono text-xs hidden sm:table-cell">
                        {pos.currentPrice ? formatCurrency(pos.currentPrice) : '-'}
                      </td>
                      <td className="p-2 sm:p-4 text-right font-mono font-medium text-xs sm:text-sm">{formatCurrency(value)}</td>
                      <td className={`p-2 sm:p-4 text-right font-mono text-xs sm:text-sm ${performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(performance)}
                      </td>
                      <td className="p-2 sm:p-4 text-right font-mono text-xs hidden md:table-cell">
                        {pos.type === 'Hebelprodukt' && pos.koPufferPct !== null ? (
                          <span className={pos.koPufferPct < 5 ? 'text-red-400' : pos.koPufferPct < 10 ? 'text-amber-400' : 'text-green-400'}>
                            {pos.koPufferPct.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-2 sm:p-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => handleOpenEdit(pos)} className="h-8 w-8">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Ins echte Portfolio übernehmen" onClick={() => handleOpenTransfer(pos)} className="h-8 w-8">
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Verkaufen" onClick={() => handleOpenSell(pos)} className="h-8 w-8">
                            <Banknote className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && positions.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      Noch keine Positionen — kaufe deine erste virtuelle Position.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Verkaufen-Dialog */}
      <Dialog open={!!sellingPosition} onOpenChange={(open) => !open && setSellingPosition(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Verkaufen: {sellingPosition?.name}</DialogTitle>
            <DialogDescription>Verkaufserlös wird dem virtuellen Cash gutgeschrieben.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Stückzahl (max. {sellingPosition ? formatAmount(sellingPosition.amount) : ''})</Label>
              <Input value={sellForm.quantity} onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Verkaufskurs (€)</Label>
              <Input value={sellForm.price} onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellingPosition(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleSellSubmit} disabled={sellMutation.isPending}>
              {sellMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verkaufen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bearbeiten-Dialog - reine Korrektur einer bereits angelegten Position,
          keine Cash-Buchung */}
      <Dialog open={!!editingPosition} onOpenChange={(open) => !open && setEditingPosition(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bearbeiten: {editingPosition?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Typ</Label>
              <Select value={editForm.type} onValueChange={(v: any) => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aktie">Aktie</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="Krypto">Krypto</SelectItem>
                  <SelectItem value="Hebelprodukt">Hebelprodukt (Knock-Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.type === 'Hebelprodukt' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>WKN *</Label>
                    <Input value={editForm.wkn} onChange={(e) => setEditForm({ ...editForm, wkn: e.target.value.toUpperCase() })} />
                  </div>
                  <div>
                    <Label>Emittent</Label>
                    <Input value={editForm.issuer} onChange={(e) => setEditForm({ ...editForm, issuer: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Richtung</Label>
                    <Select value={editForm.direction} onValueChange={(v: any) => setEditForm({ ...editForm, direction: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CALL">CALL</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hebel</Label>
                    <Input value={editForm.gearing} onChange={(e) => setEditForm({ ...editForm, gearing: e.target.value })} />
                  </div>
                  <div>
                    <Label>K.O.-Puffer %</Label>
                    <Input value={editForm.koPufferPct} onChange={(e) => setEditForm({ ...editForm, koPufferPct: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>K.O.-Schwelle</Label>
                  <Input value={editForm.koThreshold} onChange={(e) => setEditForm({ ...editForm, koThreshold: e.target.value })} />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ticker *</Label>
                  <Input value={editForm.ticker} onChange={(e) => setEditForm({ ...editForm, ticker: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Stückzahl *</Label>
                <Input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>Kaufpreis (€) *</Label>
                <Input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              </div>
              <div>
                <Label>Aktueller Kurs (€)</Label>
                <Input value={editForm.currentPrice} onChange={(e) => setEditForm({ ...editForm, currentPrice: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPosition(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uebertragen-Dialog - kopiert die Position ins echte Portfolio, aendert
          nichts am Musterdepot */}
      <Dialog open={!!transferringPosition} onOpenChange={(open) => !open && setTransferringPosition(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ins echte Portfolio: {transferringPosition?.name}</DialogTitle>
            <DialogDescription>
              WKN/Name/Typ{transferringPosition?.type === 'Hebelprodukt' ? '/Emittent/Richtung/Hebel/K.O.-Puffer' : ''} werden
              übernommen. Trag hier die echte Stückzahl und deinen echten Kaufpreis ein. Die Musterdepot-Position bleibt unverändert.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stückzahl *</Label>
                <Input value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>Echter Kaufpreis (€) *</Label>
                <Input value={transferForm.buyPrice} onChange={(e) => setTransferForm({ ...transferForm, buyPrice: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Säule / Kategorie (optional)</Label>
              <Select value={transferForm.category} onValueChange={(value) => setTransferForm({ ...transferForm, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Säule wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Renten-Basis</SelectItem>
                  <SelectItem value="B">B - Krypto</SelectItem>
                  <SelectItem value="C">C - Zocker/Verkauf</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferringPosition(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleTransferSubmit} disabled={transferMutation.isPending}>
              {transferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
