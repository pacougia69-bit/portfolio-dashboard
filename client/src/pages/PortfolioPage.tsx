/**
 * Portfolio Page - Finanzplaner
 * Vollständige Tabelle mit Filter, Sortierung, Suche
 */

import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Briefcase, Search, Plus, ArrowUpDown, ArrowUp, ArrowDown,
  Edit, Trash2, RefreshCw, FileJson, Upload, Loader2
} from 'lucide-react';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

type SortField = 'name' | 'value' | 'performance' | 'type' | 'category';
type SortDirection = 'asc' | 'desc';

export default function PortfolioPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    wkn: '',
    ticker: '',
    name: '',
    type: 'Aktie' as const,
    category: '',
    amount: '',
    buyPrice: '',
    currentPrice: '',
    status: 'Halten' as const,
    notes: '',
    autoUpdate: true,
  });
  
  // Fetch portfolio data
  const { data: portfolio = [], isLoading, refetch } = trpc.portfolio.list.useQuery();
  
  // Mutations
  const createPosition = trpc.portfolio.create.useMutation({
    onSuccess: () => {
      toast.success('Position hinzugefügt');
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const updatePosition = trpc.portfolio.update.useMutation({
    onSuccess: () => {
      toast.success('Position aktualisiert');
      setEditingAsset(null);
      resetForm();
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const deletePosition = trpc.portfolio.delete.useMutation({
    onSuccess: () => {
      toast.success('Position gelöscht');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const fetchPrices = trpc.prices.fetch.useMutation({
    onSuccess: (data) => {
      const msg = data.skippedCount > 0 
        ? `${data.updatedCount} Kurse aktualisiert, ${data.skippedCount} manuelle übersprungen`
        : `${data.updatedCount} Kurse aktualisiert`;
      toast.success(msg);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const importPortfolio = trpc.portfolio.import.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.imported} Positionen importiert`);
      setIsImportDialogOpen(false);
      setJsonInput('');
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const resetForm = () => {
    setFormData({
      wkn: '',
      ticker: '',
      name: '',
      type: 'Aktie',
      category: '',
      amount: '',
      buyPrice: '',
      currentPrice: '',
      status: 'Halten',
      notes: '',
      autoUpdate: true,
    });
  };
  
  // WKN Lookup mutation
  const [isLookingUp, setIsLookingUp] = useState(false);
  const lookupByWKN = trpc.lookup.byWKN.useMutation({
    onSuccess: (result) => {
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          ticker: result.data!.ticker,
          name: result.data!.name,
          currentPrice: result.data!.currentPrice.toFixed(2),
          type: result.data!.type as any,
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

  // Handle WKN lookup
  const handleWKNLookup = () => {
    if (!formData.wkn || formData.wkn.length < 5) {
      toast.error('Bitte geben Sie eine gültige WKN ein (min. 5 Zeichen)');
      return;
    }
    setIsLookingUp(true);
    lookupByWKN.mutate({ wkn: formData.wkn });
  };
  
  // Format amount - show integers without decimals
  const formatAmount = (value: number) => {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    // Remove trailing zeros
    return value.toFixed(4).replace(/\.?0+$/, '');
  };
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(portfolio.map(p => p.category).filter(Boolean));
    return Array.from(cats);
  }, [portfolio]);
  
  // Filter and sort
  const filteredPortfolio = useMemo(() => {
    let result = [...portfolio];
    
    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.ticker.toLowerCase().includes(searchLower) ||
        (p.wkn && p.wkn.toLowerCase().includes(searchLower))
      );
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(p => p.type === typeFilter);
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    
    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }
    
    // Add calculated fields
    result = result.map(p => ({
      ...p,
      value: p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice,
      performance: p.currentPrice ? ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100 : 0,
    }));
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      const aValue = a.currentPrice ? a.amount * a.currentPrice : a.amount * a.buyPrice;
      const bValue = b.currentPrice ? b.amount * b.currentPrice : b.amount * b.buyPrice;
      const aPerf = a.currentPrice ? ((a.currentPrice - a.buyPrice) / a.buyPrice) * 100 : 0;
      const bPerf = b.currentPrice ? ((b.currentPrice - b.buyPrice) / b.buyPrice) * 100 : 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'value':
          comparison = aValue - bValue;
          break;
        case 'performance':
          comparison = aPerf - bPerf;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [portfolio, search, typeFilter, statusFilter, categoryFilter, sortField, sortDirection]);
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const handleSubmit = () => {
    const data = {
      wkn: formData.wkn || undefined,
      ticker: formData.ticker,
      name: formData.name,
      type: formData.type,
      category: formData.category || undefined,
      amount: parseFloat(formData.amount),
      buyPrice: parseFloat(formData.buyPrice),
      currentPrice: formData.currentPrice ? parseFloat(formData.currentPrice) : undefined,
      status: formData.status,
      notes: formData.notes || undefined,
      autoUpdate: formData.autoUpdate,
    };
    
    if (editingAsset) {
      updatePosition.mutate({ id: editingAsset.id, ...data });
    } else {
      createPosition.mutate(data);
    }
  };
  
  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setFormData({
      wkn: asset.wkn || '',
      ticker: asset.ticker,
      name: asset.name,
      type: asset.type,
      category: asset.category || '',
      amount: String(asset.amount),
      buyPrice: String(asset.buyPrice),
      currentPrice: asset.currentPrice ? String(asset.currentPrice) : '',
      status: asset.status || 'Halten',
      notes: asset.notes || '',
      autoUpdate: asset.autoUpdate !== false, // Default true
    });
  };
  
  const handleRefreshPrices = () => {
    const tickers = portfolio.map(p => p.ticker);
    if (tickers.length > 0) {
      fetchPrices.mutate({ tickers });
    }
  };
  
  const handleImportJSON = () => {
    if (!jsonInput.trim()) {
      toast.error('Bitte JSON-Daten eingeben');
      return;
    }
    
    try {
      const data = JSON.parse(jsonInput);
      importPortfolio.mutate({
        portfolio: data.portfolio || data.assets || [],
        watchlist: data.watchlist || [],
      });
    } catch (e) {
      toast.error('Ungültiges JSON-Format');
    }
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target?.result as string);
    };
    reader.readAsText(file);
  };
  
  const handleExportJSON = () => {
    const exportData = {
      portfolio: portfolio,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzplaner_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Backup exportiert');
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
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
              <Briefcase className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
              Portfolio
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              {portfolio.length} Positionen • {formatCurrency(filteredPortfolio.reduce((sum, p) => sum + (p.currentPrice ? p.amount * p.currentPrice : p.amount * p.buyPrice), 0))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshPrices} disabled={fetchPrices.isPending} className="touch-target text-xs sm:text-sm">
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${fetchPrices.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Kurse aktualisieren</span>
            </Button>
            
            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="touch-target text-xs sm:text-sm">
                  <Upload className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Backup laden</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Backup importieren</DialogTitle>
                  <DialogDescription>
                    Laden Sie ein Finanzplaner-Backup (JSON-Datei).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center w-full h-24 border-2 border-dashed border-primary/30 rounded-lg hover:border-primary/60 transition-colors bg-primary/5">
                        <div className="text-center">
                          <FileJson className="w-8 h-8 mx-auto mb-2 text-primary/60" />
                          <p className="text-sm text-muted-foreground">JSON-Datei auswählen</p>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <Textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder="Oder JSON hier einfügen..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleImportJSON} disabled={!jsonInput.trim() || importPortfolio.isPending}>
                    Importieren
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" size="sm" onClick={handleExportJSON} className="touch-target text-xs sm:text-sm">
              <FileJson className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">JSON Backup</span>
            </Button>
            
            <Dialog open={isAddDialogOpen || !!editingAsset} onOpenChange={(open) => {
              if (!open) {
                setIsAddDialogOpen(false);
                setEditingAsset(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddDialogOpen(true)} className="touch-target text-xs sm:text-sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Position </span>hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingAsset ? 'Position bearbeiten' : 'Neue Position'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* WKN Lookup Row */}
                  <div>
                    <Label>WKN (automatische Suche)</Label>
                    <div className="flex gap-2 mt-1">
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Geben Sie die WKN ein und klicken Sie auf Suchen, um Name, Ticker und Kurs automatisch zu laden
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Ticker *</Label>
                      <Input
                        value={formData.ticker}
                        onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                        placeholder="AAPL"
                      />
                    </div>
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Apple Inc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Typ *</Label>
                      <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
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
                    <div>
                      <Label>Kategorie</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Tech, Biotech..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Anzahl *</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <Label>Kaufpreis (€) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.buyPrice}
                        onChange={(e) => setFormData({ ...formData, buyPrice: e.target.value })}
                        placeholder="150.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Aktueller Kurs (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.currentPrice}
                        onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                        placeholder="175.00"
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Halten">Halten</SelectItem>
                          <SelectItem value="Kaufen">Kaufen</SelectItem>
                          <SelectItem value="Verkaufen">Verkaufen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Notizen</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Ihre Notizen..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <input
                      type="checkbox"
                      id="manualPrice"
                      checked={!formData.autoUpdate}
                      onChange={(e) => setFormData({ ...formData, autoUpdate: !e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <label htmlFor="manualPrice" className="text-sm font-medium cursor-pointer">
                        Manueller Kurs
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Wenn aktiviert, wird der Kurs bei "Kurse aktualisieren" nicht überschrieben
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingAsset(null);
                    resetForm();
                  }}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.ticker || !formData.name || !formData.amount || !formData.buyPrice}
                  >
                    {editingAsset ? 'Speichern' : 'Hinzufügen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:gap-4">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                  <SelectValue placeholder="Typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  <SelectItem value="Aktie">Aktie</SelectItem>
                  <SelectItem value="ETF">ETF</SelectItem>
                  <SelectItem value="Krypto">Krypto</SelectItem>
                  <SelectItem value="Anleihe">Anleihe</SelectItem>
                  <SelectItem value="Fonds">Fonds</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="Kaufen">Kaufen</SelectItem>
                  <SelectItem value="Halten">Halten</SelectItem>
                  <SelectItem value="Verkaufen">Verkaufen</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm">
                    <button className="flex items-center gap-1 hover:text-primary" onClick={() => handleSort('name')}>
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">WKN</th>
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm">
                    <button className="flex items-center gap-1 hover:text-primary" onClick={() => handleSort('type')}>
                      Typ <SortIcon field="type" />
                    </button>
                  </th>
                  <th className="text-left p-2 sm:p-4 text-xs sm:text-sm hidden lg:table-cell">
                    <button className="flex items-center gap-1 hover:text-primary" onClick={() => handleSort('category')}>
                      Kategorie <SortIcon field="category" />
                    </button>
                  </th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">Anz.</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">Kauf</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">Aktuell</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">
                    <button className="flex items-center gap-1 hover:text-primary ml-auto" onClick={() => handleSort('value')}>
                      Wert <SortIcon field="value" />
                    </button>
                  </th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">
                    <button className="flex items-center gap-1 hover:text-primary ml-auto" onClick={() => handleSort('performance')}>
                      +/- <SortIcon field="performance" />
                    </button>
                  </th>
                  <th className="text-center p-2 sm:p-4 text-xs sm:text-sm hidden sm:table-cell">Status</th>
                  <th className="text-right p-2 sm:p-4 text-xs sm:text-sm">Akt.</th>
                </tr>
              </thead>
              <tbody>
                {filteredPortfolio.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-2 sm:p-4">
                      <div>
                        <p className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">{asset.ticker}</p>
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {asset.wkn || '-'}
                    </td>
                    <td className="p-2 sm:p-4">
                      <Badge variant="outline" className="text-xs">{asset.type}</Badge>
                    </td>
                    <td className="p-2 sm:p-4 text-muted-foreground text-xs hidden lg:table-cell">{asset.category || '-'}</td>
                    <td className="p-2 sm:p-4 text-right font-mono text-xs sm:text-sm">{formatAmount(asset.amount)}</td>
                    <td className="p-2 sm:p-4 text-right font-mono text-xs hidden sm:table-cell">{formatCurrency(asset.buyPrice)}</td>
                    <td className="p-2 sm:p-4 text-right font-mono text-xs hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {asset.currentPrice ? formatCurrency(asset.currentPrice) : '-'}
                        {asset.autoUpdate === false && (
                          <span title="Manueller Kurs" className="text-amber-400 text-xs">M</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 sm:p-4 text-right font-mono font-medium text-xs sm:text-sm">{formatCurrency(asset.currentPrice ? asset.amount * asset.currentPrice : asset.amount * asset.buyPrice)}</td>
                    <td className={`p-2 sm:p-4 text-right font-mono text-xs sm:text-sm ${(asset.currentPrice ? ((asset.currentPrice - asset.buyPrice) / asset.buyPrice) * 100 : 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(asset.currentPrice ? ((asset.currentPrice - asset.buyPrice) / asset.buyPrice) * 100 : 0)}
                    </td>
                    <td className="p-2 sm:p-4 text-center hidden sm:table-cell">
                      <Badge
                        variant={asset.status === 'Kaufen' ? 'default' : asset.status === 'Verkaufen' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {asset.status || 'Halten'}
                      </Badge>
                    </td>
                    <td className="p-2 sm:p-4">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(asset)} className="h-8 w-8">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => {
                            if (confirm('Position wirklich löschen?')) {
                              deletePosition.mutate({ id: asset.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPortfolio.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      Keine Positionen gefunden
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
